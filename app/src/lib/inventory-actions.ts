"use server";

import { revalidatePath } from "next/cache";
import { isUuid, withUserTransaction, type DatabaseClient } from "@/lib/db";
import {
  isPgError,
  PG_CHECK_VIOLATION,
  PG_FOREIGN_KEY_VIOLATION,
  PG_INSUFFICIENT_PRIVILEGE,
  PG_UNIQUE_VIOLATION,
} from "@/lib/db/pg-errors";
import { getSessionProfile } from "@/lib/auth";
import { STORAGE_LOCATION_TYPES, type MovementType } from "@/lib/status";
import type { FormState } from "@/lib/incidents";
import { returnableQuantityIn } from "@/lib/inventory";

// =====================================================================
// AP3 – Server-Actions für Material, Lagerorte und Lagerbewegungen.
//
// AP14/B: jede Aktion läuft über withUserTransaction() mit der Identität aus der
// serverseitig geprüften Auth.js-Sitzung (ADR-011 / 2.5). Kennungen aus dem
// Formular werden vor dem SQL mit isUuid() geprüft; ist eine erforderliche
// Kennung unbrauchbar, wird kein SQL ausgeführt. In den SQL-Text gelangt kein
// Eingabewert – alle Werte sind Parameter ($1, $2, …).
//
// Jede der vier Buchungsaktionen liegt in GENAU EINER Transaktion: die Abfrage
// des Materials (Einheit, Aktivstatus) und der Insert gehören zusammen, bei der
// Rückgabe zusätzlich die Prüfung der rückgabefähigen Menge. Ohne gemeinsame
// Transaktion könnte zwischen Prüfung und Buchung eine andere Bewegung die
// Grundlage verändern.
//
// Die gemeinsame Transaktion allein genügt dabei nicht: unter READ COMMITTED
// sieht eine Prüfung eine gleichzeitige, noch nicht festgeschriebene Buchung
// nicht. Die drei vorgangsbezogenen Wege (Entnahme, Rückgabe, Verbrauch)
// sperren deshalb als ERSTE Anweisung ihrer Transaktion die Vorgangszeile
// (lockIncident()); gleichzeitige Buchungen auf DEMSELBEN Vorgang laufen
// dadurch nacheinander statt gegeneinander. Begründung, Sperrreihenfolge und
// die ausdrücklich verbleibende Lücke stehen bei returnMaterial().
//
// Die Bewegungschronik public.inventory_movements ist unveränderbar: es gibt
// hier ausschließlich Inserts, kein update und kein delete. Die Spalten
// created_by und created_at werden NIEMALS aus einer Eingabe gesetzt – sie
// bleiben Spaltendefault der Datenbank. Der Bestandswächter (Trigger
// check_inventory_nonnegative) und das Audit bleiben ebenso Sache der Datenbank;
// die View public.material_stock bleibt unverändert die einzige Bestandsquelle.
//
// Eine Datenbankmeldung gelangt nie in ein Aktionsergebnis (verbindliche Regel
// aus @/lib/db/pg-errors): klassifiziert wird ausschließlich über den SQLSTATE,
// die Originalmeldung geht allein ins Serverprotokoll.
// =====================================================================

function str(fd: FormData, key: string): string {
  return String(fd.get(key) ?? "").trim();
}
function strOrNull(fd: FormData, key: string): string | null {
  const v = str(fd, key);
  return v === "" ? null : v;
}
function num(fd: FormData, key: string): number | null {
  const v = str(fd, key).replace(",", ".");
  if (v === "") return null;
  const x = Number(v);
  return Number.isFinite(x) ? x : null;
}
function revalidateInventory(incidentId?: string) {
  revalidatePath("/material");
  revalidatePath("/lager");
  revalidatePath("/bestand");
  revalidatePath("/materialhistorie");
  revalidatePath("/dashboard");
  if (incidentId) revalidatePath(`/vorgaenge/${incidentId}`);
}

async function requireAdmin() {
  const s = await getSessionProfile();
  return s && s.role === "admin" ? s : null;
}

/**
 * Allowlist der buchungsberechtigten Rollen (admin, disponent).
 *
 * Bewusst eine Allowlist und keine Verbotsliste: die frühere Prüfung
 * `role === "monteur"` hätte JEDE künftige Rolle durch Schweigen zugelassen –
 * eine neue Rolle wäre ohne eigene Änderung an dieser Stelle buchungsberechtigt
 * gewesen. Die Menge deckt sich mit public.is_staff() (admin, disponent –
 * 0001_init.sql:63-65) und damit mit der Policy movements_insert
 * (0001_init.sql:594-602), die für alle übrigen Rollen ohnehin nur die
 * vorgangsbezogenen Bewegungsarten zulässt. Gleiche Form wie requireStaff() in
 * @/lib/masterdata-actions.
 */
async function requireStaff() {
  const s = await getSessionProfile();
  return s && (s.role === "admin" || s.role === "disponent") ? s : null;
}

// ---------------------------------------------------------------------
// Fehlerabbildung
// ---------------------------------------------------------------------
// Die sichtbaren Präfixe bleiben wörtlich wie bisher; ersetzt wird
// ausschließlich die früher interpolierte Datenbankmeldung.
const SAVE_PREFIX = "Speichern fehlgeschlagen";
const MOVEMENT_PREFIX = "Buchung fehlgeschlagen";
const TAKEOUT_PREFIX = "Entnahme fehlgeschlagen (evtl. Bestand zu gering)";
const RETURN_PREFIX = "Rückgabe fehlgeschlagen";
const CONSUME_PREFIX = "Verbrauch fehlgeschlagen (evtl. Bestand zu gering)";

/**
 * Ein unbrauchbarer Verweis – ein Text für BEIDE Wege dorthin.
 *
 * Denselben Sachverhalt melden jetzt zwei Stellen: die fachliche Vorprüfung in
 * den Buchungswegen (fehlende Materialzeile, fehlender oder nicht sichtbarer
 * Vorgang) und der gefangene Fremdschlüsselfehler in dbError(). Der sichtbare
 * Text bleibt dadurch wörtlich der bisherige und existiert nur einmal; die
 * Vorprüfung kann nicht unbemerkt von der Fehlerabbildung abweichen.
 */
const REFERENCE_INVALID = "Verweis auf Material, Lager oder Vorgang ist ungültig.";

/** Neutraler Sammelfall – nennt bewusst keinen Datenbankinhalt. */
function unexpectedDbError(prefix: string): FormState {
  return { ok: false, error: `${prefix}: unerwarteter Datenbankfehler.` };
}

/**
 * Fachliche Meldung aus einem gefangenen Datenbankfehler.
 *
 * @/lib/db/pg-errors verbietet verbindlich, dass eine Datenbankmeldung in das
 * Ergebnis einer Server Action gelangt: sie nennt Tabellen-, Spalten- und
 * Constraint-Namen, Teile von Abfragen und im Zweifel Werte. Eingeordnet wird
 * deshalb allein über den SQLSTATE, die Originalmeldung geht ausschließlich ins
 * Serverprotokoll.
 *
 * 23514 ist mehrdeutig und deshalb der einzige Fall, dessen Text die
 * Aufrufstelle vorgibt: mit diesem SQLSTATE meldet einerseits der
 * Bestandswächter check_inventory_nonnegative() einen nicht gedeckten Abgang,
 * andererseits melden ihn die Check-Constraints der Stammdatentabellen (etwa
 * `materials.min_stock >= 0`). Ein pauschales "Bestand nicht ausreichend."
 * wäre im Pflegeweg sachlich falsch: dort geht es um einen unzulässigen
 * Eingabewert und nicht um einen Lagerbestand. Der Vorgabewert gilt für die
 * vier Buchungswege, die Pflegewege übergeben ihren eigenen Text.
 */
function dbError(
  prefix: string,
  error: unknown,
  checkViolationText = "Bestand nicht ausreichend.",
): FormState {
  console.error(
    `${prefix} (Datenbankfehler)`,
    error instanceof Error ? error.message : "unbekannter Fehler",
  );
  if (isPgError(error, PG_UNIQUE_VIOLATION))
    return { ok: false, error: `${prefix}: Eintrag ist bereits vorhanden (Eindeutigkeit verletzt).` };
  if (isPgError(error, PG_CHECK_VIOLATION))
    return { ok: false, error: `${prefix}: ${checkViolationText}` };
  if (isPgError(error, PG_FOREIGN_KEY_VIOLATION))
    return { ok: false, error: `${prefix}: ${REFERENCE_INVALID}` };
  if (isPgError(error, PG_INSUFFICIENT_PRIVILEGE))
    return { ok: false, error: `${prefix}: keine Berechtigung.` };
  return unexpectedDbError(prefix);
}

/**
 * Gemeinsamer Ablauf der Aktiv/Inaktiv-Schalter.
 *
 * `sql` ist an jeder Aufrufstelle ein festes Literal; übergeben wird die fertige
 * Anweisung und nicht etwa ein Tabellenname, damit nichts in den SQL-Text
 * hineingebaut wird. Die Signatur bleibt Promise<void>: ein Wurf würde eine
 * sichtbare Fehleroberfläche erzeugen, deshalb wird ein Datenbankfehler
 * serverseitig protokolliert und die Aktion kehrt still zurück – ohne
 * revalidateInventory(), weil sich nichts geändert hat.
 */
async function setActive(fd: FormData, sql: string): Promise<void> {
  const admin = await requireAdmin();
  if (!admin) return;
  const id = str(fd, "id");
  if (!isUuid(id)) return;
  const active = str(fd, "active") === "true";
  try {
    await withUserTransaction(admin.userId, async (client) => {
      await client.query(sql, [active, id]);
    });
  } catch (error) {
    console.error(
      "Aktivkennzeichen setzen fehlgeschlagen",
      error instanceof Error ? error.message : "unbekannter Fehler",
    );
    return;
  }
  revalidateInventory();
}

// =====================================================================
// Materialstammdaten (Administrator)
// =====================================================================
export async function saveMaterial(_prev: FormState, fd: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  if (!admin) return { ok: false, error: "Nur Administratoren dürfen Material verwalten." };

  const id = strOrNull(fd, "id");
  const name = str(fd, "name");
  if (!name) return { ok: false, error: "Bezeichnung ist erforderlich." };
  if (id && !isUuid(id)) return unexpectedDbError(SAVE_PREFIX);

  // Geschrieben werden genau die bisherigen Spalten: manufacturer und
  // purchase_price bleiben ausdrücklich ungeschrieben.
  const payload = {
    material_no: strOrNull(fd, "material_no"),
    name,
    note: strOrNull(fd, "note"),
    unit: str(fd, "unit") || "Stk",
    category: strOrNull(fd, "category"),
    min_stock: num(fd, "min_stock"),
    is_active: str(fd, "is_active") !== "false",
  };

  try {
    await withUserTransaction(admin.userId, async (client) => {
      if (id) {
        await client.query(
          `update public.materials
              set material_no = $1, name = $2, note = $3, unit = $4, category = $5,
                  min_stock = $6::numeric, is_active = $7
            where id = $8::uuid`,
          [
            payload.material_no,
            payload.name,
            payload.note,
            payload.unit,
            payload.category,
            payload.min_stock,
            payload.is_active,
            id,
          ],
        );
      } else {
        await client.query(
          `insert into public.materials
             (material_no, name, note, unit, category, min_stock, is_active)
           values ($1, $2, $3, $4, $5, $6::numeric, $7)`,
          [
            payload.material_no,
            payload.name,
            payload.note,
            payload.unit,
            payload.category,
            payload.min_stock,
            payload.is_active,
          ],
        );
      }
    });
  } catch (error) {
    // Im Pflegeweg meldet 23514 eine verletzte Check-Bedingung der Stammdaten
    // (z. B. min_stock >= 0), niemals den Bestandswächter.
    return dbError(SAVE_PREFIX, error, "Ungültiger Wert.");
  }
  revalidateInventory();
  return { ok: true, error: null };
}

export async function setMaterialActive(fd: FormData): Promise<void> {
  await setActive(fd, `update public.materials set is_active = $1 where id = $2::uuid`);
}

// =====================================================================
// Lagerorte (Administrator)
// =====================================================================
export async function saveLocation(_prev: FormState, fd: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  if (!admin) return { ok: false, error: "Nur Administratoren dürfen Lagerorte verwalten." };

  const id = strOrNull(fd, "id");
  const name = str(fd, "name");
  const location_type = str(fd, "location_type");
  if (!name) return { ok: false, error: "Lagername ist erforderlich." };
  if (!STORAGE_LOCATION_TYPES.includes(location_type as (typeof STORAGE_LOCATION_TYPES)[number])) {
    return { ok: false, error: "Bitte einen gültigen Lagerorttyp wählen." };
  }
  if (id && !isUuid(id)) return unexpectedDbError(SAVE_PREFIX);

  const payload = {
    name,
    location_type: location_type as (typeof STORAGE_LOCATION_TYPES)[number],
    note: strOrNull(fd, "note"),
    is_active: str(fd, "is_active") !== "false",
  };

  try {
    await withUserTransaction(admin.userId, async (client) => {
      if (id) {
        await client.query(
          `update public.storage_locations
              set name = $1, location_type = $2::public.storage_location_type,
                  note = $3, is_active = $4
            where id = $5::uuid`,
          [payload.name, payload.location_type, payload.note, payload.is_active, id],
        );
      } else {
        await client.query(
          `insert into public.storage_locations (name, location_type, note, is_active)
           values ($1, $2::public.storage_location_type, $3, $4)`,
          [payload.name, payload.location_type, payload.note, payload.is_active],
        );
      }
    });
  } catch (error) {
    // Im Pflegeweg meldet 23514 eine verletzte Check-Bedingung der Stammdaten
    // (z. B. min_stock >= 0), niemals den Bestandswächter.
    return dbError(SAVE_PREFIX, error, "Ungültiger Wert.");
  }
  revalidateInventory();
  return { ok: true, error: null };
}

export async function setLocationActive(fd: FormData): Promise<void> {
  await setActive(fd, `update public.storage_locations set is_active = $1 where id = $2::uuid`);
}

// =====================================================================
// Gemeinsame Bausteine der vier Buchungswege
// =====================================================================

/**
 * Fachliches Ergebnis einer Buchung.
 *
 * Ein Fehlschlag der fachlichen Vorprüfung beendet die Transaktion über einen
 * RÜCKGABEWERT und nicht über eine Ausnahme – so wie es der Aktivstatus des
 * Materials schon bisher getan hat. Damit gelangt an keiner Stelle eine
 * Datenbankmeldung in das Ergebnis, und die Fälle bleiben unterscheidbar.
 */
type BookingOutcome =
  | { status: "ok" }
  | { status: "material_missing" }
  | { status: "material_inactive" }
  | { status: "incident_unavailable" }
  | { status: "quantity_exceeded"; available: number };

/**
 * Fehlschlag in eine sichtbare Meldung übersetzen.
 *
 * Der Parametertyp schließt `status: "ok"` über Exclude<> aus: ein Erfolg kann
 * hier nicht versehentlich als Fehlermeldung landen, das prüft der Compiler.
 *
 * `material_missing` und `incident_unavailable` erhalten ABSICHTLICH denselben
 * neutralen Text: eine eigene Meldung für "Vorgang nicht sichtbar" wäre eine
 * Existenzaussage über fremde Vorgänge.
 */
function bookingError(
  prefix: string,
  quantity: number,
  outcome: Exclude<BookingOutcome, { status: "ok" }>,
): FormState {
  if (outcome.status === "material_inactive") return { ok: false, error: "Material ist inaktiv." };
  if (outcome.status === "quantity_exceeded")
    return {
      ok: false,
      error: `Rückgabe (${quantity}) größer als entnommene Restmenge (${outcome.available}).`,
    };
  return { ok: false, error: `${prefix}: ${REFERENCE_INVALID}` };
}

/**
 * Einheit des Materials aus dem Stammsatz, oder NULL wenn es die Zeile nicht
 * gibt (bzw. sie für diese Identität nicht sichtbar ist).
 *
 * Die Einheit wird bewusst NICHT aus dem Formular übernommen: sie gehört zum
 * Material und nicht zur Eingabe. Der frühere Rückfall "Stk" ist entfallen: er
 * hat eine FEHLENDE Materialzeile still zu einem Vorgabewert gemacht und die
 * Buchung bis zum Fremdschlüsselfehler weiterlaufen lassen. Eine fehlende Zeile
 * ist ein fachlicher Fehlschlag, kein Vorgabewert. `materials.unit` selbst ist
 * `not null` (0001_init.sql:143), NULL heißt hier also ausschließlich
 * "keine Zeile".
 */
async function materialUnit(client: DatabaseClient, materialId: string): Promise<string | null> {
  const result = await client.query<{ unit: string }>(
    `select unit from public.materials where id = $1::uuid`,
    [materialId],
  );
  return result.rows[0]?.unit ?? null;
}

/** Sperranweisung als festes Literal; der Wert bleibt ausschließlich Parameter. */
const LOCK_INCIDENT_SQL = `select id from public.incidents where id = $1::uuid for update`;

/**
 * Vorgangszeile für die Dauer der Transaktion sperren.
 *
 * FALSE heißt: die Zeile fehlt ODER sie ist für diese Identität nicht sichtbar
 * bzw. nicht sperrbar. Beides ist ein Abbruch ohne Insert; unterschieden wird
 * nach außen nicht (siehe bookingError()).
 */
async function lockIncident(client: DatabaseClient, incidentId: string): Promise<boolean> {
  const result = await client.query<{ id: string }>(LOCK_INCIDENT_SQL, [incidentId]);
  return result.rows.length === 1;
}

// =====================================================================
// Lagerbewegungen (Administrator): Wareneingang/Umbuchung/Korrektur/Verlust/Beschädigung
// =====================================================================
const ADMIN_MOVEMENTS: MovementType[] = [
  "wareneingang", "umbuchung", "korrektur", "verlust", "beschaedigung",
];

export async function createMovement(_prev: FormState, fd: FormData): Promise<FormState> {
  const s = await requireStaff();
  if (!s)
    return { ok: false, error: "Diese Buchung ist der Disposition/Administration vorbehalten." };

  const movement_type = str(fd, "movement_type") as MovementType;
  if (!ADMIN_MOVEMENTS.includes(movement_type))
    return { ok: false, error: "Ungültiger Bewegungstyp." };

  const material_id = strOrNull(fd, "material_id");
  const quantity = num(fd, "quantity");
  if (!material_id) return { ok: false, error: "Material ist erforderlich." };
  if (quantity === null || quantity <= 0) return { ok: false, error: "Menge muss größer als 0 sein." };

  let source = strOrNull(fd, "source_location_id");
  let target = strOrNull(fd, "target_location_id");

  if (movement_type === "wareneingang") {
    source = null;
    if (!target) return { ok: false, error: "Ziellager ist erforderlich." };
  } else if (movement_type === "umbuchung") {
    if (!source || !target) return { ok: false, error: "Quell- und Ziellager sind erforderlich." };
    if (source === target) return { ok: false, error: "Quell- und Ziellager müssen verschieden sein." };
  } else if (movement_type === "verlust" || movement_type === "beschaedigung") {
    target = null;
    if (!source) return { ok: false, error: "Quelllager ist erforderlich." };
  } else if (movement_type === "korrektur") {
    if ((source && target) || (!source && !target))
      return { ok: false, error: "Bei Korrektur genau ein Lager (Zugang ODER Abgang) wählen." };
  }

  // Kennungen vor dem SQL prüfen: ein unbrauchbarer Wert würde in der Datenbank
  // nur einen Typfehler auslösen, dessen Meldung nicht nach außen darf.
  if (!isUuid(material_id)) return unexpectedDbError(MOVEMENT_PREFIX);
  if (source !== null && !isUuid(source)) return unexpectedDbError(MOVEMENT_PREFIX);
  if (target !== null && !isUuid(target)) return unexpectedDbError(MOVEMENT_PREFIX);

  const note = strOrNull(fd, "note");
  let outcome: BookingOutcome;
  try {
    // GENAU EINE Transaktion: Materialabfrage und Insert gehören zusammen.
    // Fehlendes und inaktives Material beenden die Transaktion ohne Insert über
    // einen Rückgabewert und nicht über eine Ausnahme.
    //
    // Keine Vorgangssperre: dieser Weg bucht ausschließlich die
    // lagerbezogenen Bewegungsarten (ADMIN_MOVEMENTS) und berührt keine
    // Vorgangszeile.
    outcome = await withUserTransaction(s.userId, async (client): Promise<BookingOutcome> => {
      const matResult = await client.query<{ unit: string; is_active: boolean }>(
        `select unit, is_active from public.materials where id = $1::uuid`,
        [material_id],
      );
      const mat = matResult.rows[0];
      if (!mat) return { status: "material_missing" };
      if (mat.is_active === false) return { status: "material_inactive" };
      await client.query(
        `insert into public.inventory_movements
           (material_id, quantity, unit, movement_type, source_location_id,
            target_location_id, note)
         values ($1::uuid, $2::numeric, $3::text, $4::public.movement_type,
                 $5::uuid, $6::uuid, $7::text)`,
        [material_id, quantity, mat.unit, movement_type, source, target, note],
      );
      return { status: "ok" };
    });
  } catch (error) {
    return dbError(MOVEMENT_PREFIX, error);
  }
  if (outcome.status !== "ok") return bookingError(MOVEMENT_PREFIX, quantity, outcome);
  revalidateInventory();
  return { ok: true, error: null };
}

// =====================================================================
// Monteur/Staff: Entnahme, Rückgabe, Verbrauch (vorgangsbezogen)
//
// Alle drei Wege prüfen, dass die Materialzeile existiert (materialUnit()
// liefert sonst NULL), und sperren zuvor die Vorgangszeile. Sie prüfen
// ausdrücklich NICHT den Aktivstatus des Materials: das wäre eine fachliche
// Verhaltensänderung. Eine bereits entnommene Menge muss rückgabefähig bleiben,
// auch wenn das Material inzwischen deaktiviert wurde – sonst blieben Bestände
// in Fahrzeuglagern gebunden. Über den Aktivstatus entscheidet weiterhin nur der
// Pflegeweg und createMovement().
// =====================================================================
export async function takeoutMaterial(_prev: FormState, fd: FormData): Promise<FormState> {
  const s = await getSessionProfile();
  if (!s) return { ok: false, error: "Nicht angemeldet." };
  const incident_id = strOrNull(fd, "incident_id");
  const material_id = strOrNull(fd, "material_id");
  const source_location_id = strOrNull(fd, "source_location_id");
  const quantity = num(fd, "quantity");
  if (!incident_id) return { ok: false, error: "Keine Entnahme ohne Vorgang möglich." };
  if (!material_id || !source_location_id) return { ok: false, error: "Material und Lager sind erforderlich." };
  if (quantity === null || quantity <= 0) return { ok: false, error: "Menge muss größer als 0 sein." };
  if (!isUuid(incident_id) || !isUuid(material_id) || !isUuid(source_location_id))
    return unexpectedDbError(TAKEOUT_PREFIX);

  const note = strOrNull(fd, "note");
  let outcome: BookingOutcome;
  try {
    // GENAU EINE Transaktion: Vorgangssperre, Einheitsabfrage und Insert.
    outcome = await withUserTransaction(s.userId, async (client): Promise<BookingOutcome> => {
      if (!(await lockIncident(client, incident_id))) return { status: "incident_unavailable" };
      const unit = await materialUnit(client, material_id);
      if (unit === null) return { status: "material_missing" };
      await client.query(
        `insert into public.inventory_movements
           (material_id, quantity, unit, movement_type, source_location_id,
            incident_id, note)
         values ($1::uuid, $2::numeric, $3::text, 'entnahme_vorgang',
                 $4::uuid, $5::uuid, $6::text)`,
        [material_id, quantity, unit, source_location_id, incident_id, note],
      );
      return { status: "ok" };
    });
  } catch (error) {
    return dbError(TAKEOUT_PREFIX, error);
  }
  if (outcome.status !== "ok") return bookingError(TAKEOUT_PREFIX, quantity, outcome);
  revalidateInventory(incident_id);
  return { ok: true, error: null };
}

export async function returnMaterial(_prev: FormState, fd: FormData): Promise<FormState> {
  const s = await getSessionProfile();
  if (!s) return { ok: false, error: "Nicht angemeldet." };
  const incident_id = strOrNull(fd, "incident_id");
  const material_id = strOrNull(fd, "material_id");
  const target_location_id = strOrNull(fd, "target_location_id");
  const quantity = num(fd, "quantity");
  if (!incident_id || !material_id || !target_location_id)
    return { ok: false, error: "Vorgang, Material und Lager sind erforderlich." };
  if (quantity === null || quantity <= 0) return { ok: false, error: "Menge muss größer als 0 sein." };
  if (!isUuid(incident_id) || !isUuid(material_id) || !isUuid(target_location_id))
    return unexpectedDbError(RETURN_PREFIX);

  const note = strOrNull(fd, "note");
  let outcome: BookingOutcome;
  try {
    // GENAU EINE Transaktion: Vorgangssperre, Einheitsabfrage, Prüfung der
    // rückgabefähigen Menge und Insert. Die verletzte Prüfung endet ohne Insert
    // über einen Rückgabewert und nicht über eine Ausnahme.
    //
    // Warum die Vorgangssperre: sie serialisiert Prüfung und Insert gegen eine
    // gleichzeitige zweite Rückgabe DESSELBEN Vorgangs. Die zweite Transaktion
    // wartet an der Sperre, bis die erste festgeschrieben oder zurückgerollt
    // ist, und liest danach unter READ COMMITTED einen NEUEN Snapshot – sie
    // sieht die erste Rückgabe also und rechnet mit der verringerten Restmenge.
    //
    // Warum die Sperre VOR returnableQuantityIn() stehen MUSS: eine Sperre nach
    // der Prüfung käme zu spät. Die Restmenge wäre dann schon auf einem
    // veralteten Snapshot berechnet, und beide Transaktionen würden auf dieser
    // veralteten Grundlage buchen – genau die Doppelbuchung, die verhindert
    // werden soll.
    //
    // Warum public.incidents die gesperrte Zeile ist: alle drei
    // vorgangsbezogenen Wege (Entnahme, Rückgabe, Verbrauch) berühren diese
    // Zeile zwingend und sperren dieselbe einzige Zeile – es entsteht also
    // keine neue Sperrreihenfolge und kein Zyklus. Sie ist für admin,
    // disponent und den ZUGEWIESENEN Monteur sowohl sichtbar (incidents_select)
    // als auch sperrbar (incidents_update); beide Policies tragen dieselbe
    // Bedingung (0001_init.sql:540-546). Das dafür nötige update-Recht der
    // Anwendungsrolle vergibt 0014_ap14b_data_grants.sql:55; Vorbild für die
    // Sperre selbst ist 0010_ap12_incident_details.sql:255-259.
    //
    // AUSDRÜCKLICH verbleibende Lücke, vollständig benannt: die Vorgangssperre
    // wirkt ausschließlich zwischen Buchungen DESSELBEN Vorgangs. Sie schützt
    // den Bestandswächter check_inventory_nonnegative() NICHT gegen
    // gleichzeitige Abgänge desselben Materials aus demselben Lager, wenn diese
    // verschiedene Zeilen sperren oder gar keine:
    //   * zwei Entnahmen/Verbräuche auf VERSCHIEDENEN Vorgängen sperren
    //     verschiedene Vorgangszeilen,
    //   * die lagerbezogenen Abgänge aus createMovement() (verlust,
    //     beschaedigung, umbuchung, korrektur-Abgang) sperren überhaupt nichts,
    //     weil sie keine Vorgangszeile berühren.
    // Der Bestandswächter ist ein BEFORE-Trigger ohne Sperre und rechnet auf
    // einem Anweisungssnapshot (0001_init.sql). Diese Lücke bleibt offen und ist
    // keine Zusage dieser Korrektur; sie zu schließen wäre eine andere
    // Sperrgranularität (Material/Lager) und damit eine fachliche Entscheidung.
    //
    // VORAUSSETZUNG dieser Zusage: READ COMMITTED, der Vorgabewert von
    // PostgreSQL. withUserTransaction() setzt keine Isolationsstufe (die
    // Anweisungssperre in @/lib/db/statement-guard verbietet `set`), und keine
    // Migration, kein Startskript und keine Umgebungsvorlage setzt
    // default_transaction_isolation. Unter REPEATABLE READ würde die zweite
    // Transaktion nach der Sperrwartezeit ihren ALTEN Snapshot behalten – die
    // gesperrte Vorgangszeile wird ja nur gesperrt und nicht geändert, es gibt
    // also keinen Serialisierungsfehler – und mit veralteter Restmenge buchen.
    // Eine Umstellung der Vorgabestufe würde diese Korrektur still unwirksam
    // machen.
    outcome = await withUserTransaction(s.userId, async (client): Promise<BookingOutcome> => {
      if (!(await lockIncident(client, incident_id))) return { status: "incident_unavailable" };
      const unit = await materialUnit(client, material_id);
      if (unit === null) return { status: "material_missing" };
      const available = await returnableQuantityIn(client, incident_id, material_id);
      if (quantity > available) return { status: "quantity_exceeded", available };
      await client.query(
        `insert into public.inventory_movements
           (material_id, quantity, unit, movement_type, target_location_id,
            incident_id, note)
         values ($1::uuid, $2::numeric, $3::text, 'rueckgabe',
                 $4::uuid, $5::uuid, $6::text)`,
        [material_id, quantity, unit, target_location_id, incident_id, note],
      );
      return { status: "ok" };
    });
  } catch (error) {
    return dbError(RETURN_PREFIX, error);
  }
  if (outcome.status !== "ok") return bookingError(RETURN_PREFIX, quantity, outcome);
  revalidateInventory(incident_id);
  return { ok: true, error: null };
}

export async function consumeMaterial(_prev: FormState, fd: FormData): Promise<FormState> {
  const s = await getSessionProfile();
  if (!s) return { ok: false, error: "Nicht angemeldet." };
  const incident_id = strOrNull(fd, "incident_id");
  const material_id = strOrNull(fd, "material_id");
  const source_location_id = strOrNull(fd, "source_location_id");
  const quantity = num(fd, "quantity");
  if (!incident_id || !material_id || !source_location_id)
    return { ok: false, error: "Vorgang, Material und Lager sind erforderlich." };
  if (quantity === null || quantity <= 0) return { ok: false, error: "Menge muss größer als 0 sein." };
  if (!isUuid(incident_id) || !isUuid(material_id) || !isUuid(source_location_id))
    return unexpectedDbError(CONSUME_PREFIX);

  const note = strOrNull(fd, "note");
  let outcome: BookingOutcome;
  try {
    // GENAU EINE Transaktion: Vorgangssperre, Einheitsabfrage und Insert.
    outcome = await withUserTransaction(s.userId, async (client): Promise<BookingOutcome> => {
      if (!(await lockIncident(client, incident_id))) return { status: "incident_unavailable" };
      const unit = await materialUnit(client, material_id);
      if (unit === null) return { status: "material_missing" };
      await client.query(
        `insert into public.inventory_movements
           (material_id, quantity, unit, movement_type, source_location_id,
            incident_id, note)
         values ($1::uuid, $2::numeric, $3::text, 'verbrauch',
                 $4::uuid, $5::uuid, $6::text)`,
        [material_id, quantity, unit, source_location_id, incident_id, note],
      );
      return { status: "ok" };
    });
  } catch (error) {
    return dbError(CONSUME_PREFIX, error);
  }
  if (outcome.status !== "ok") return bookingError(CONSUME_PREFIX, quantity, outcome);
  revalidateInventory(incident_id);
  return { ok: true, error: null };
}
