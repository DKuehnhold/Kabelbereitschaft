import { getSessionProfile } from "@/lib/auth";
import { isUuid, withUserTransaction, type DatabaseClient } from "@/lib/db";
import type { MovementType, StorageLocationType } from "@/lib/status";

// =====================================================================
// AP3 – Material, Lagerorte, Bestand und Bewegungen: Typen und Reads.
//
// AP14/B: die Reads laufen auf PostgreSQL (ADR-011 / 2.5) über
// withUserTransaction(); die Identität stammt ausschließlich aus der
// serverseitig geprüften Auth.js-Sitzung. Fehlt sie, wird kein SQL ausgeführt –
// das Ergebnis ist dasselbe wie bisher (ohne Identität liefert die RLS keine
// Zeile), der Abbruch erfolgt aber schon vor dem Verbindungsaufbau. Ein echter
// Datenbankfehler wird dagegen NICHT gefangen: ein fehlendes Tabellenrecht muss
// laut scheitern und darf nicht still eine leere Liste ergeben (Vorbild
// tasks.ts).
//
// Alles, was fachlich zusammengehört, liegt in GENAU EINER Transaktion: die drei
// Abfragen der Bestandsfassade ebenso wie Bewegungsliste samt Namensauflösung.
// Die Abfragen laufen darin sequenziell – eine Transaktion ist eine Verbindung,
// und die Fassade führt keine nebenläufigen Abfragen aus.
//
// Die Bewegungschronik public.inventory_movements ist unveränderbar: dieses
// Modul liest sie ausschließlich, es gibt kein update und kein delete. Der
// Bestandswächter (Trigger check_inventory_nonnegative) und die Auditfelder
// created_by/created_at bleiben Sache der Datenbank.
//
// Die View public.material_stock bleibt unverändert die einzige Bestandsquelle
// und wird hier nicht angetastet.
//
// Die Projektionen liefern bewusst genau die bisherige Zeilenform – auch die
// verschachtelten Embeds (material, source, target, incident). json_build_object
// gibt der Treiber als fertiges Objekt heraus und nicht als Text; die Mapper
// unten bleiben dadurch unverändert. Ein fehlender LEFT-JOIN-Partner wird über
// `case when ... is null` zu NULL, weil json_build_object sonst ein Objekt aus
// lauter NULL-Werten liefern würde und nicht das bisherige NULL.
//
// Der SQL-Text besteht ausschließlich aus Modulkonstanten; Eingabewerte sind
// stets Parameter ($1, $2), jede `order by`-Klausel ist festes Literal.
// =====================================================================

// ---------------------------------------------------------------------
// Sichtmodelle (Ergebnisse werden gecastet – entkoppelt von Embed-Typen)
// ---------------------------------------------------------------------
export type MaterialRow = {
  id: string;
  material_no: string | null;
  name: string;
  category: string | null;
  manufacturer: string | null;
  unit: string;
  min_stock: number | null;
  purchase_price: number | null;
  note: string | null;
  is_active: boolean;
};

export type LocationRow = {
  id: string;
  name: string;
  location_type: StorageLocationType;
  address: string | null;
  responsible_person: string | null;
  note: string | null;
  is_active: boolean;
};

export type StockRow = {
  material_id: string;
  material_no: string | null;
  material_name: string;
  unit: string;
  min_stock: number | null;
  location_id: string;
  location_name: string;
  location_type: StorageLocationType | null;
  quantity: number;
  material_total: number;
  below_min: boolean;
};

export type MovementRow = {
  id: string;
  created_at: string;
  movement_type: MovementType;
  quantity: number;
  unit: string;
  note: string | null;
  material: { id: string; material_no: string | null; name: string; unit: string } | null;
  source: { id: string; name: string } | null;
  target: { id: string; name: string } | null;
  incident: { id: string; incident_no: number } | null;
  created_by: string | null;
  created_by_name: string;
};

export type LowStockRow = {
  id: string;
  material_no: string | null;
  name: string;
  unit: string;
  total: number;
  min_stock: number | null;
};

const n = (v: unknown): number => {
  const x = typeof v === "string" ? Number(v) : (v as number);
  return Number.isFinite(x) ? x : 0;
};
const nOrNull = (v: unknown): number | null =>
  v === null || v === undefined ? null : n(v);

// ---------------------------------------------------------------------
// Stammdaten
// ---------------------------------------------------------------------
const LIST_MATERIALS_SQL = `
  select id, material_no, name, category, manufacturer, unit, min_stock,
         purchase_price, note, is_active
    from public.materials
   order by name asc`;

export async function listMaterials(): Promise<MaterialRow[]> {
  const session = await getSessionProfile();
  if (!session) return [];
  const rows = await withUserTransaction(session.userId, async (client) => {
    // Offene Zeilenform wie bisher (`data as Record<string, unknown>[]`), damit
    // die Nachbehandlung unten unverändert bleiben kann.
    const result = await client.query<Record<string, unknown>>(LIST_MATERIALS_SQL);
    return result.rows;
  });
  // min_stock und purchase_price sind numeric; der Treiber gibt sie als Text
  // heraus. nOrNull deckt Text und Zahl ab und bleibt deshalb unverändert.
  return rows.map((m) => ({
    ...(m as unknown as MaterialRow),
    min_stock: nOrNull((m as { min_stock: unknown }).min_stock),
    purchase_price: nOrNull((m as { purchase_price: unknown }).purchase_price),
  }));
}

export async function getActiveMaterials(): Promise<MaterialRow[]> {
  return (await listMaterials()).filter((m) => m.is_active);
}

const LIST_LOCATIONS_SQL = `
  select id, name, location_type, address, responsible_person, note, is_active
    from public.storage_locations
   order by name asc`;

export async function listLocations(): Promise<LocationRow[]> {
  const session = await getSessionProfile();
  if (!session) return [];
  return withUserTransaction(session.userId, async (client) => {
    const result = await client.query<LocationRow>(LIST_LOCATIONS_SQL);
    return result.rows;
  });
}

export async function getActiveLocations(): Promise<LocationRow[]> {
  return (await listLocations()).filter((l) => l.is_active);
}

// ---------------------------------------------------------------------
// Bestand (ausschließlich aus der View material_stock)
// ---------------------------------------------------------------------
// material_stock bleibt unverändert die einzige Bestandsquelle. Sie ist bewusst
// KEINE security_invoker-View: als Aggregat-View läuft sie mit den Rechten des
// Owners, damit alle Berechtigten den korrekten Gesamtbestand sehen (Begründung
// in 0001_init.sql direkt unter ihrer Definition). Sie wird hier nicht
// angetastet – auch nicht durch eine eigene Summenbildung über die Chronik.
const STOCK_SQL = `
  select material_id, location_id, quantity
    from public.material_stock`;

const STOCK_MATERIALS_SQL = `
  select id, material_no, name, unit, min_stock, is_active
    from public.materials`;

const STOCK_LOCATIONS_SQL = `
  select id, name, location_type, is_active
    from public.storage_locations`;

type StockQueryRow = { material_id: string; location_id: string; quantity: unknown };
type StockMaterialRow = {
  id: string;
  material_no: string | null;
  name: string;
  unit: string;
  min_stock: unknown;
  is_active: boolean;
};
type StockLocationRow = {
  id: string;
  name: string;
  location_type: StorageLocationType;
  is_active: boolean;
};

type StockAndMasters = {
  stock: StockQueryRow[];
  mats: StockMaterialRow[];
  locs: StockLocationRow[];
  totalByMaterial: Map<string, number>;
};

/**
 * Bestand und die zugehörigen Stammdaten in GENAU EINER Transaktion.
 *
 * Die drei Abfragen laufen sequenziell und nicht über Promise.all: die Fassade
 * gehört zu einer Verbindung, nebenläufige Abfragen darauf sind kein zulässiger
 * Weg. Ohne Sitzung entsteht dieselbe leere Struktur wie bisher, damit getStock()
 * und getLowStockMaterials() unverändert eine leere Liste liefern.
 */
async function stockAndMasters(): Promise<StockAndMasters> {
  const session = await getSessionProfile();
  const { stock, mats, locs } = session
    ? await withUserTransaction(session.userId, async (client) => {
        const stockResult = await client.query<StockQueryRow>(STOCK_SQL);
        const matResult = await client.query<StockMaterialRow>(STOCK_MATERIALS_SQL);
        const locResult = await client.query<StockLocationRow>(STOCK_LOCATIONS_SQL);
        return { stock: stockResult.rows, mats: matResult.rows, locs: locResult.rows };
      })
    : { stock: [] as StockQueryRow[], mats: [] as StockMaterialRow[], locs: [] as StockLocationRow[] };

  const totalByMaterial = new Map<string, number>();
  for (const s of stock) {
    totalByMaterial.set(s.material_id, (totalByMaterial.get(s.material_id) ?? 0) + n(s.quantity));
  }
  return { stock, mats, locs, totalByMaterial };
}

export async function getStock(): Promise<StockRow[]> {
  const { stock, mats, locs, totalByMaterial } = await stockAndMasters();
  const matMap = new Map(mats.map((m) => [m.id, m]));
  const locMap = new Map(locs.map((l) => [l.id, l]));

  const rows: StockRow[] = [];
  for (const s of stock) {
    const m = matMap.get(s.material_id);
    const l = locMap.get(s.location_id);
    if (!m || !l) continue;
    const min = nOrNull(m.min_stock);
    const total = totalByMaterial.get(m.id) ?? 0;
    rows.push({
      material_id: m.id,
      material_no: m.material_no,
      material_name: m.name,
      unit: m.unit,
      min_stock: min,
      location_id: l.id,
      location_name: l.name,
      location_type: l.location_type,
      quantity: n(s.quantity),
      material_total: total,
      below_min: total <= (min ?? 0),
    });
  }
  rows.sort((a, b) => a.material_name.localeCompare(b.material_name) || a.location_name.localeCompare(b.location_name));
  return rows;
}

export async function getLowStockMaterials(): Promise<LowStockRow[]> {
  const { mats, totalByMaterial } = await stockAndMasters();
  return mats
    .filter((m) => m.is_active)
    .map((m) => ({
      id: m.id,
      material_no: m.material_no,
      name: m.name,
      unit: m.unit,
      total: totalByMaterial.get(m.id) ?? 0,
      min_stock: nOrNull(m.min_stock),
    }))
    .filter((m) => m.total <= (m.min_stock ?? 0))
    .sort((a, b) => a.name.localeCompare(b.name));
}

// ---------------------------------------------------------------------
// Bewegungen
// ---------------------------------------------------------------------
// Nur diese Bausteine werden zusammengesetzt; alle sind Modulkonstanten, es
// gelangt kein Eingabewert in den SQL-Text.
const MOVEMENT_SELECT = `
    select mv.id, mv.created_at, mv.movement_type, mv.quantity, mv.unit, mv.note,
           mv.created_by, mv.incident_id,
           case
             when m.id is null then null
             else json_build_object('id', m.id, 'material_no', m.material_no,
                                    'name', m.name, 'unit', m.unit)
           end as material,
           case
             when sl.id is null then null
             else json_build_object('id', sl.id, 'name', sl.name)
           end as source,
           case
             when tl.id is null then null
             else json_build_object('id', tl.id, 'name', tl.name)
           end as target,
           case
             when i.id is null then null
             else json_build_object('id', i.id, 'incident_no', i.incident_no)
           end as incident
      from public.inventory_movements mv
      left join public.materials m on m.id = mv.material_id
      left join public.storage_locations sl on sl.id = mv.source_location_id
      left join public.storage_locations tl on tl.id = mv.target_location_id
      left join public.incidents i on i.id = mv.incident_id`;

// Die Zeile wird über eine Unterabfrage mit to_json projiziert (Muster aus
// tasks.ts): created_at ist timestamptz und käme vom Treiber sonst als JS-Date,
// während MovementRow.created_at eine ISO-8601-Zeichenkette ist. Die Sortierung
// steht deshalb außen und entspricht der bisherigen absteigenden Ordnung.
const LIST_MOVEMENTS_SQL = `
  select to_json(r) as movement
  from (
${MOVEMENT_SELECT}
  ) r
  order by r.created_at desc`;

const LIST_INCIDENT_MOVEMENTS_SQL = `
  select to_json(r) as movement
  from (
${MOVEMENT_SELECT}
     where mv.incident_id = $1::uuid
  ) r
  order by r.created_at desc`;

const PROFILE_NAMES_SQL = `
  select id, full_name
    from public.profiles`;

type MovementResult = { movement: Record<string, unknown> };
type ProfileNameRow = { id: string; full_name: string | null };

/**
 * Namensauflösung der Urheber.
 *
 * Nimmt den Client als Parameter, damit die Bewegungsliste wie bisher mit GENAU
 * EINER Transaktion auskommt: keine zweite Transaktion, kein Promise.all über
 * zwei Verbindungen.
 */
async function profileNameMap(client: DatabaseClient): Promise<Map<string, string>> {
  const result = await client.query<ProfileNameRow>(PROFILE_NAMES_SQL);
  const map = new Map<string, string>();
  for (const p of result.rows) {
    map.set(p.id, p.full_name ?? "—");
  }
  return map;
}

function mapMovements(
  data: unknown,
  names: Map<string, string>,
): MovementRow[] {
  return ((data as Record<string, unknown>[]) ?? []).map((r) => ({
    id: r.id as string,
    created_at: r.created_at as string,
    movement_type: r.movement_type as MovementType,
    quantity: n(r.quantity),
    unit: r.unit as string,
    note: (r.note as string | null) ?? null,
    material: (r.material as MovementRow["material"]) ?? null,
    source: (r.source as MovementRow["source"]) ?? null,
    target: (r.target as MovementRow["target"]) ?? null,
    incident: (r.incident as MovementRow["incident"]) ?? null,
    created_by: (r.created_by as string | null) ?? null,
    created_by_name: r.created_by ? names.get(r.created_by as string) ?? "—" : "—",
  }));
}

export async function listMovements(): Promise<MovementRow[]> {
  const session = await getSessionProfile();
  if (!session) return [];
  return withUserTransaction(session.userId, async (client) => {
    const result = await client.query<MovementResult>(LIST_MOVEMENTS_SQL);
    const names = await profileNameMap(client);
    return mapMovements(result.rows.map((row) => row.movement), names);
  });
}

export async function getIncidentMovements(incidentId: string): Promise<MovementRow[]> {
  const session = await getSessionProfile();
  if (!session || !isUuid(incidentId)) return [];
  return withUserTransaction(session.userId, async (client) => {
    const result = await client.query<MovementResult>(LIST_INCIDENT_MOVEMENTS_SQL, [incidentId]);
    const names = await profileNameMap(client);
    return mapMovements(result.rows.map((row) => row.movement), names);
  });
}

// Rückgabefähige Menge = entnommen − bereits zurückgegeben (je Vorgang+Material)
const RETURNABLE_MOVEMENTS_SQL = `
  select movement_type, quantity
    from public.inventory_movements
   where incident_id = $1::uuid
     and material_id = $2::uuid`;

type ReturnableRow = { movement_type: MovementType; quantity: unknown };

/**
 * Rückgabefähige Menge INNERHALB einer bereits offenen Transaktion.
 *
 * Additiv und bewusst ohne eigene Transaktion: die Rückgabebuchung muss Prüfung
 * und Insert atomar ausführen, sonst könnte zwischen beiden eine weitere
 * Rückgabe die Restmenge verändern. Es entsteht dadurch keine zweite
 * SQL-Fassung – returnableQuantity() unten benutzt dieselbe Funktion.
 */
export async function returnableQuantityIn(
  client: DatabaseClient,
  incidentId: string,
  materialId: string,
): Promise<number> {
  const result = await client.query<ReturnableRow>(RETURNABLE_MOVEMENTS_SQL, [incidentId, materialId]);
  let taken = 0;
  let returned = 0;
  for (const r of result.rows) {
    if (r.movement_type === "entnahme_vorgang") taken += n(r.quantity);
    else if (r.movement_type === "rueckgabe") returned += n(r.quantity);
  }
  return taken - returned;
}

export async function returnableQuantity(incidentId: string, materialId: string): Promise<number> {
  const session = await getSessionProfile();
  // Fail-closed wie bisher: ohne Sitzung oder mit unbrauchbarer Kennung ist die
  // rückgabefähige Menge 0 und es läuft kein SQL.
  if (!session || !isUuid(incidentId) || !isUuid(materialId)) return 0;
  return withUserTransaction(session.userId, async (client) =>
    returnableQuantityIn(client, incidentId, materialId),
  );
}
