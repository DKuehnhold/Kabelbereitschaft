import { createClient } from "@/lib/supabase/server";
import type { MovementType, StorageLocationType } from "@/lib/status";

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
export async function listMaterials(): Promise<MaterialRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("materials")
    .select("id, material_no, name, category, manufacturer, unit, min_stock, purchase_price, note, is_active")
    .order("name", { ascending: true });
  return (data ?? []).map((m) => ({
    ...(m as unknown as MaterialRow),
    min_stock: nOrNull((m as { min_stock: unknown }).min_stock),
    purchase_price: nOrNull((m as { purchase_price: unknown }).purchase_price),
  }));
}

export async function getActiveMaterials(): Promise<MaterialRow[]> {
  return (await listMaterials()).filter((m) => m.is_active);
}

export async function listLocations(): Promise<LocationRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("storage_locations")
    .select("id, name, location_type, address, responsible_person, note, is_active")
    .order("name", { ascending: true });
  return (data ?? []) as unknown as LocationRow[];
}

export async function getActiveLocations(): Promise<LocationRow[]> {
  return (await listLocations()).filter((l) => l.is_active);
}

// ---------------------------------------------------------------------
// Bestand (ausschließlich aus der View material_stock)
// ---------------------------------------------------------------------
async function stockAndMasters() {
  const supabase = await createClient();
  const [stockRes, matRes, locRes] = await Promise.all([
    supabase.from("material_stock").select("material_id, location_id, quantity"),
    supabase.from("materials").select("id, material_no, name, unit, min_stock, is_active"),
    supabase.from("storage_locations").select("id, name, location_type, is_active"),
  ]);
  const stock = (stockRes.data ?? []) as { material_id: string; location_id: string; quantity: unknown }[];
  const mats = (matRes.data ?? []) as {
    id: string; material_no: string | null; name: string; unit: string; min_stock: unknown; is_active: boolean;
  }[];
  const locs = (locRes.data ?? []) as {
    id: string; name: string; location_type: StorageLocationType; is_active: boolean;
  }[];

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
const MOVEMENT_SELECT = `
  id, created_at, movement_type, quantity, unit, note, created_by, incident_id,
  material:materials(id, material_no, name, unit),
  source:storage_locations!source_location_id(id, name),
  target:storage_locations!target_location_id(id, name),
  incident:incidents(id, incident_no)
`;

async function profileNameMap(): Promise<Map<string, string>> {
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("id, full_name");
  const map = new Map<string, string>();
  for (const p of (data ?? []) as { id: string; full_name: string | null }[]) {
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
  const supabase = await createClient();
  const [{ data }, names] = await Promise.all([
    supabase.from("inventory_movements").select(MOVEMENT_SELECT).order("created_at", { ascending: false }),
    profileNameMap(),
  ]);
  return mapMovements(data, names);
}

export async function getIncidentMovements(incidentId: string): Promise<MovementRow[]> {
  const supabase = await createClient();
  const [{ data }, names] = await Promise.all([
    supabase
      .from("inventory_movements")
      .select(MOVEMENT_SELECT)
      .eq("incident_id", incidentId)
      .order("created_at", { ascending: false }),
    profileNameMap(),
  ]);
  return mapMovements(data, names);
}

// Rückgabefähige Menge = entnommen − bereits zurückgegeben (je Vorgang+Material)
export async function returnableQuantity(incidentId: string, materialId: string): Promise<number> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("inventory_movements")
    .select("movement_type, quantity")
    .eq("incident_id", incidentId)
    .eq("material_id", materialId);
  let taken = 0;
  let returned = 0;
  for (const r of (data ?? []) as { movement_type: MovementType; quantity: unknown }[]) {
    if (r.movement_type === "entnahme_vorgang") taken += n(r.quantity);
    else if (r.movement_type === "rueckgabe") returned += n(r.quantity);
  }
  return taken - returned;
}
