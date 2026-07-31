"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isUuid, withUserTransaction, type DatabaseClient } from "@/lib/db";
import { getSessionProfile } from "@/lib/auth";
import {
  INCIDENT_STATUS,
  MONTEUR_STATUS,
  CONDITION_RATING,
  type IncidentStatus,
  type ConditionRating,
} from "@/lib/status";
import { PRIORITIES, type Priority } from "@/lib/priority";
import { assignIncidentMonteur } from "@/lib/incidents";
import type { FormState } from "@/lib/incidents";

// AP14/B: Schreibaktionen der Vorgänge auf PostgreSQL (ADR-011 / 2.5).
//
// Jede Aktion läuft über withUserTransaction() mit der Identität aus der
// serverseitig geprüften Auth.js-Sitzung. Mehrschrittige Aktionen
// (Referenzprüfung + RPC) laufen in EINER Transaktion. `redirect()` wirft
// intern eine Kontrollausnahme und liegt deshalb ausdrücklich AUSSERHALB der
// Transaktion – innerhalb würde der Wrapper sie als Fehler behandeln und ein
// rollback auslösen.
//
// Eine Datenbankmeldung wird ausschließlich serverseitig zur Klassifizierung
// ausgewertet (mapDbError) und gelangt nie in ein Aktionsergebnis.

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
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function revalidateAll(id?: string) {
  revalidatePath("/dashboard");
  revalidatePath("/vorgaenge");
  revalidatePath("/meine-einsaetze");
  if (id) revalidatePath(`/vorgaenge/${id}`);
}

/** Serverseitige Protokollierung ohne Weitergabe der Datenbankmeldung. */
function logActionFailure(action: string, error: unknown): void {
  console.error(
    `${action} fehlgeschlagen`,
    error instanceof Error ? error.message : "unbekannter Fehler",
  );
}

// ---------- AP10-Helfer: serverseitige Referenzprüfung + Fehlerabbildung ----------
type RefInput = {
  customer_id: string;
  construction_stage_id: string;
  vzg_line_id: string;
  cable_type_ids: string[];
  on_call_number_id: string | null;
};

type ActiveFlagRow = { is_active: boolean };
type VzgRefRow = { is_active: boolean; construction_stage_id: string };
type CableTypeRefRow = { id: string; is_active: boolean };

/**
 * Referenzprüfung der Stammdaten (ADR-011, Regel 10: im Modul selbst, auf
 * PostgreSQL, ohne zweiten Zugriffsweg).
 *
 * Läuft im Client der aufrufenden Transaktion. Eine unbrauchbare Kennung wird
 * als NULL gebunden; die Abfrage liefert dann keine Zeile und die Prüfung
 * ergibt wie bisher „nicht gefunden".
 */
async function validateRefs(
  client: DatabaseClient,
  r: RefInput,
  requireActive: boolean,
): Promise<string | null> {
  const customerId = isUuid(r.customer_id) ? r.customer_id : null;
  const stageId = isUuid(r.construction_stage_id) ? r.construction_stage_id : null;
  const vzgLineId = isUuid(r.vzg_line_id) ? r.vzg_line_id : null;
  const onCallId = isUuid(r.on_call_number_id) ? r.on_call_number_id : null;
  // Nicht kanonische Kennungen können keine Kabelart treffen; der Vergleich mit
  // der ursprünglichen Menge unten ergibt dann „nicht gefunden".
  const cableTypeIds = r.cable_type_ids.filter(isUuid);

  const cust = await client.query<ActiveFlagRow>(
    `select is_active from public.customers where id = $1::uuid`,
    [customerId],
  );
  const stage = await client.query<ActiveFlagRow>(
    `select is_active from public.construction_stages where id = $1::uuid`,
    [stageId],
  );
  const vzg = await client.query<VzgRefRow>(
    `select is_active, construction_stage_id from public.vzg_lines where id = $1::uuid`,
    [vzgLineId],
  );
  const cables = await client.query<CableTypeRefRow>(
    `select id, is_active from public.cable_types where id = any($1::uuid[])`,
    [cableTypeIds],
  );
  const oncall = r.on_call_number_id
    ? await client.query<ActiveFlagRow>(
        `select is_active from public.on_call_numbers where id = $1::uuid`,
        [onCallId],
      )
    : null;

  const c = cust.rows[0] ?? null;
  const s = stage.rows[0] ?? null;
  const v = vzg.rows[0] ?? null;
  const cableRows = cables.rows;
  const o = oncall?.rows[0] ?? null;

  if (!c) return "Kunde nicht gefunden.";
  if (requireActive && !c.is_active) return "Der gewählte Kunde ist inaktiv.";
  if (!s) return "Bauabschnitt nicht gefunden.";
  if (requireActive && !s.is_active) return "Der gewählte Bauabschnitt ist inaktiv.";
  if (!v) return "VzG-Strecke nicht gefunden.";
  if (requireActive && !v.is_active) return "Die gewählte VzG-Strecke ist inaktiv.";
  if (v.construction_stage_id !== r.construction_stage_id)
    return "Die VzG-Strecke gehört nicht zum gewählten Bauabschnitt.";
  if (cableRows.length !== new Set(r.cable_type_ids).size) return "Mindestens eine Kabelart wurde nicht gefunden.";
  if (requireActive && cableRows.some((k) => !k.is_active)) return "Mindestens eine gewählte Kabelart ist inaktiv.";
  if (r.on_call_number_id) {
    if (!o) return "Bereitschaftsnummer nicht gefunden.";
    if (requireActive && !o.is_active) return "Die gewählte Bereitschaftsnummer ist inaktiv.";
  }
  return null;
}

function mapDbError(msg?: string): string {
  if (!msg) return "Speichern fehlgeschlagen.";
  if (/Pflichtfelder fehlen/i.test(msg)) return "Pflichtfelder fehlen.";
  if (/gehört nicht|construction_stage/i.test(msg)) return "Die VzG-Strecke passt nicht zum Bauabschnitt.";
  if (/row-level security|permission denied|42501/i.test(msg)) return "Keine Berechtigung für diese Aktion.";
  if (/nicht gefunden|23503|foreign key/i.test(msg)) return "Referenzierte Stammdaten wurden nicht gefunden.";
  return "Speichern fehlgeschlagen. Bitte Eingaben prüfen.";
}

function readIncidentFields(fd: FormData) {
  return {
    customer_id: strOrNull(fd, "customer_id"),
    construction_stage_id: strOrNull(fd, "construction_stage_id"),
    vzg_line_id: strOrNull(fd, "vzg_line_id"),
    on_call_number_id: strOrNull(fd, "on_call_number_id"),
    priority: str(fd, "priority") as Priority,
    description: strOrNull(fd, "description"),
    contact_id: strOrNull(fd, "contact_id"),
    contact_phone_number_id: strOrNull(fd, "contact_phone_number_id"),
  };
}

type CablePositionInput = {
  id?: string;
  cable_type_id: string;
  quantity_value: string | null;
  quantity_unit: "piece" | "meter" | null;
  condition_code: "ready" | "restricted" | "damaged" | "unusable" | null;
};

const POSITION_UNITS = ["piece", "meter"] as const;
const POSITION_CONDITIONS = ["ready", "restricted", "damaged", "unusable"] as const;

function parseCablePositions(fd: FormData): CablePositionInput[] | null {
  try {
    const raw = JSON.parse(str(fd, "cable_positions_json"));
    if (!Array.isArray(raw) || raw.length === 0) return null;
    const rows = raw.map((item: unknown) => {
      const p = (item ?? {}) as Record<string, unknown>;
      const unit = String(p.quantity_unit ?? "") as CablePositionInput["quantity_unit"];
      const condition = String(p.condition_code ?? "") as CablePositionInput["condition_code"];
      return {
        ...(p.id ? { id: String(p.id) } : {}),
        cable_type_id: String(p.cable_type_id ?? "").trim(),
        quantity_value: String(p.quantity_value ?? "").trim() || null,
        quantity_unit: POSITION_UNITS.includes(unit as (typeof POSITION_UNITS)[number]) ? unit : null,
        condition_code: POSITION_CONDITIONS.includes(condition as (typeof POSITION_CONDITIONS)[number])
          ? condition
          : null,
      };
    });
    return rows.some((p) => !p.cable_type_id) ? null : rows;
  } catch {
    return null;
  }
}

/**
 * Kabelpositionen als jsonb-Text für p_cable_positions.
 *
 * Die Neuanlage übergibt ausschließlich die vier fachlichen Felder; die
 * Bearbeitung führt zusätzlich die bestehende Positions-Kennung, weil
 * update_incident_ap12() daran Bestand von Neuanlage unterscheidet.
 */
function cablePositionsJson(rows: CablePositionInput[], keepId: boolean): string {
  return JSON.stringify(
    rows.map((p) => ({
      ...(keepId && p.id ? { id: p.id } : {}),
      cable_type_id: p.cable_type_id,
      quantity_value: p.quantity_value,
      quantity_unit: p.quantity_unit,
      condition_code: p.condition_code,
    })),
  );
}

function validatePositionValues(rows: CablePositionInput[], isCreate: boolean): string | null {
  for (const row of rows) {
    const complete = row.quantity_value !== null && row.quantity_unit !== null && row.condition_code !== null;
    if ((isCreate || !row.id) && !complete) return "Neue Kabelpositionen benötigen Menge, Einheit und Zustand.";
    if (row.quantity_value !== null) {
      const value = Number(row.quantity_value.replace(",", "."));
      if (!Number.isFinite(value) || value <= 0) return "Die Menge muss größer als 0 sein.";
      if (row.quantity_unit === "piece" && !Number.isInteger(value))
        return "Die Einheit Stück erlaubt nur ganze Mengen.";
    }
  }
  return null;
}

function missingRequired(f: ReturnType<typeof readIncidentFields>): string[] {
  return ([
    ["Kunde", f.customer_id],
    ["Bauabschnitt", f.construction_stage_id],
    ["VzG-Strecke", f.vzg_line_id],
    ["Beschreibung", f.description],
  ] as [string, unknown][])
    .filter(([, v]) => v === null || v === "")
    .map(([l]) => l);
}

/** Ergebnis einer Schreibtransaktion: Erfolg (mit Kennung) oder Fachmeldung. */
type WriteOutcome = { id: string } | { error: string };
type CreatedIdRow = { id: string | null };

// ---------- Vorgang anlegen (Disposition/Admin) – Stammdatenbasiert ----------
export async function createIncident(_prev: FormState, fd: FormData): Promise<FormState> {
  const session = await getSessionProfile();
  if (!session) return { ok: false, error: "Nicht angemeldet." };
  if (session.role === "monteur")
    return { ok: false, error: "Nur Disposition/Administration darf Vorgänge anlegen." };

  const f = readIncidentFields(fd);
  const positions = parseCablePositions(fd);
  const missing = missingRequired(f);
  if (!positions) missing.push("Kabelpositionen");
  if (missing.length) return { ok: false, error: `Pflichtfelder fehlen: ${missing.join(", ")}.` };
  const positionError = validatePositionValues(positions!, true);
  if (positionError) return { ok: false, error: positionError };
  if (!PRIORITIES.includes(f.priority)) return { ok: false, error: "Ungültige Priorität." };

  let outcome: WriteOutcome;
  try {
    // Referenzprüfung und RPC in EINER Transaktion.
    outcome = await withUserTransaction<WriteOutcome>(session.userId, async (client) => {
      const refErr = await validateRefs(
        client,
        {
          customer_id: f.customer_id!,
          construction_stage_id: f.construction_stage_id!,
          vzg_line_id: f.vzg_line_id!,
          cable_type_ids: positions!.map((p) => p.cable_type_id),
          on_call_number_id: f.on_call_number_id,
        },
        true, // Neuanlage: nur aktive Stammdaten
      );
      if (refErr) return { error: refErr };

      const created = await client.query<CreatedIdRow>(
        `select public.create_incident_ap12(
                  $1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::public.incident_priority,
                  $6, $7, $8, $9, $10, $11, $12, $13,
                  $14::numeric, $15::numeric, $16, $17, $18,
                  $19::uuid, $20::uuid, $21::jsonb
                ) as id`,
        [
          f.customer_id!,
          f.construction_stage_id!,
          f.vzg_line_id!,
          f.on_call_number_id,
          f.priority,
          f.description!,
          strOrNull(fd, "operating_point"),
          strOrNull(fd, "track"),
          strOrNull(fd, "direction"),
          strOrNull(fd, "object_type"),
          strOrNull(fd, "object_designation"),
          strOrNull(fd, "location_description"),
          strOrNull(fd, "external_reference"),
          num(fd, "km_from"),
          num(fd, "km_to"),
          strOrNull(fd, "caller_name"),
          strOrNull(fd, "caller_contact"),
          strOrNull(fd, "internal_note"),
          f.contact_id,
          f.contact_phone_number_id,
          cablePositionsJson(positions!, false),
        ],
      );
      const id = created.rows[0]?.id ?? null;
      if (!id) return { error: mapDbError() };
      return { id };
    });
  } catch (error) {
    return { ok: false, error: mapDbError(error instanceof Error ? error.message : undefined) };
  }
  if ("error" in outcome) return { ok: false, error: outcome.error };

  revalidateAll();
  // Außerhalb der Transaktion: redirect() wirft eine Kontrollausnahme.
  redirect(`/vorgaenge/${outcome.id}`);
}

// ---------- Vorgang bearbeiten (Disposition/Admin) – Stammdatenbasiert ----------
export async function updateIncident(_prev: FormState, fd: FormData): Promise<FormState> {
  const session = await getSessionProfile();
  if (!session) return { ok: false, error: "Nicht angemeldet." };
  if (session.role === "monteur")
    return { ok: false, error: "Bearbeiten ist der Disposition/Administration vorbehalten." };

  const id = str(fd, "id");
  if (!id) return { ok: false, error: "Kein Vorgang angegeben." };

  const f = readIncidentFields(fd);
  const positions = parseCablePositions(fd);
  const missing = missingRequired(f);
  if (!positions) missing.push("Kabelpositionen");
  if (missing.length) return { ok: false, error: `Pflichtfelder fehlen: ${missing.join(", ")}.` };
  const positionError = validatePositionValues(positions!, false);
  if (positionError) return { ok: false, error: positionError };
  if (!PRIORITIES.includes(f.priority)) return { ok: false, error: "Ungültige Priorität." };

  let outcome: WriteOutcome;
  try {
    outcome = await withUserTransaction<WriteOutcome>(session.userId, async (client) => {
      // Bearbeitung: bereits gespeicherte, ggf. inaktive Referenzen zulassen (Bestand),
      // aber Existenz und VzG-Zugehörigkeit zum Bauabschnitt weiterhin prüfen.
      const refErr = await validateRefs(
        client,
        {
          customer_id: f.customer_id!,
          construction_stage_id: f.construction_stage_id!,
          vzg_line_id: f.vzg_line_id!,
          cable_type_ids: positions!.map((p) => p.cable_type_id),
          on_call_number_id: f.on_call_number_id,
        },
        false,
      );
      if (refErr) return { error: refErr };

      await client.query(
        `select public.update_incident_ap12(
                  $1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid,
                  $6::public.incident_priority, $7, $8, $9, $10, $11, $12, $13, $14,
                  $15::numeric, $16::numeric, $17, $18, $19,
                  $20::uuid, $21::uuid, $22::jsonb
                )`,
        [
          id,
          f.customer_id!,
          f.construction_stage_id!,
          f.vzg_line_id!,
          f.on_call_number_id,
          f.priority,
          f.description!,
          strOrNull(fd, "operating_point"),
          strOrNull(fd, "track"),
          strOrNull(fd, "direction"),
          strOrNull(fd, "object_type"),
          strOrNull(fd, "object_designation"),
          strOrNull(fd, "location_description"),
          strOrNull(fd, "external_reference"),
          num(fd, "km_from"),
          num(fd, "km_to"),
          strOrNull(fd, "caller_name"),
          strOrNull(fd, "caller_contact"),
          strOrNull(fd, "internal_note"),
          f.contact_id,
          f.contact_phone_number_id,
          cablePositionsJson(positions!, true),
        ],
      );
      return { id };
    });
  } catch (error) {
    return { ok: false, error: mapDbError(error instanceof Error ? error.message : undefined) };
  }
  if ("error" in outcome) return { ok: false, error: outcome.error };

  revalidateAll(id);
  // Außerhalb der Transaktion: redirect() wirft eine Kontrollausnahme.
  redirect(`/vorgaenge/${id}`);
}

// ---------- Statuswechsel (rollenabhängig) ----------
export async function changeStatus(fd: FormData): Promise<void> {
  const session = await getSessionProfile();
  if (!session) return;
  const id = str(fd, "id");
  const status = str(fd, "status") as IncidentStatus;
  if (!id || !INCIDENT_STATUS.includes(status)) return;

  const isStaff = session.role === "admin" || session.role === "disponent";
  if (!isStaff && !MONTEUR_STATUS.includes(status)) return; // DB-Trigger sichert zusätzlich ab

  // Feste Spalten-Allow-List: nur die hier im Quelltext stehenden Spaltennamen
  // gelangen in die SET-Liste, alle Werte ausschließlich als Parameter.
  const values: unknown[] = [status];
  const setClauses = ["status = $1::public.incident_status"];
  if (isStaff && (status === "abgeschlossen" || status === "durch_disposition_geprueft")) {
    values.push(new Date().toISOString());
    setClauses.push(`closed_at = $${values.length}::timestamptz`);
    values.push(session.userId);
    setClauses.push(`closed_by = $${values.length}::uuid`);
    const note = strOrNull(fd, "closing_note");
    if (note) {
      values.push(note);
      setClauses.push(`closing_note = $${values.length}`);
    }
  }
  values.push(id);
  const idPlaceholder = `$${values.length}`;

  try {
    await withUserTransaction(session.userId, (client) =>
      client.query(
        `update public.incidents set ${setClauses.join(", ")} where id = ${idPlaceholder}::uuid`,
        values,
      ),
    );
  } catch (error) {
    // Wie bisher bleibt ein Fehlschlag nach außen unsichtbar; die
    // Datenbankmeldung bleibt serverseitig.
    logActionFailure("Statuswechsel", error);
  }
  revalidateAll(id);
}

// ---------- Zustandsbewertung ----------
export async function updateCondition(fd: FormData): Promise<void> {
  const session = await getSessionProfile();
  if (!session) return;
  const id = str(fd, "id");
  const rating = str(fd, "condition_rating") as ConditionRating;
  if (!id || !CONDITION_RATING.includes(rating)) return;
  try {
    await withUserTransaction(session.userId, (client) =>
      client.query(
        `update public.incidents
            set condition_rating = $1::public.condition_rating
          where id = $2::uuid`,
        [rating, id],
      ),
    );
  } catch (error) {
    logActionFailure("Zustandsbewertung", error);
  }
  revalidateAll(id);
}

// ---------- Monteur zuweisen (Disposition/Admin) ----------
// AP13: identischer, gesperrter RPC-Pfad wie die Massenzuweisung
// (assign_incident_monteur_ap13). Konfliktbasis sind incidents.updated_at
// und die erwartete sortierte Menge aktiver monteur_ids; Statuswechsel
// nach „Monteur zugewiesen" und Auditierung erledigt die Datenbank.
export async function addAssignment(_prev: FormState, fd: FormData): Promise<FormState> {
  const session = await getSessionProfile();
  if (!session) return { ok: false, error: "Nicht angemeldet." };
  if (session.role === "monteur")
    return { ok: false, error: "Zuweisen ist der Disposition/Administration vorbehalten." };

  const id = str(fd, "id");
  const monteur_id = str(fd, "monteur_id");
  if (!id || !monteur_id) return { ok: false, error: "Vorgang und Monteur sind erforderlich." };

  const res = await assignIncidentMonteur(id, monteur_id);
  if (res.ok) revalidateAll(id);
  return res;
}

export async function deactivateAssignment(fd: FormData): Promise<void> {
  const session = await getSessionProfile();
  if (!session || session.role === "monteur") return;
  const assignment_id = str(fd, "assignment_id");
  const id = str(fd, "id");
  if (!assignment_id) return;
  try {
    await withUserTransaction(session.userId, (client) =>
      client.query(
        `update public.incident_assignments
            set is_active = false, unassigned_at = $1::timestamptz
          where id = $2::uuid`,
        [new Date().toISOString(), assignment_id],
      ),
    );
  } catch (error) {
    logActionFailure("Beenden der Zuweisung", error);
  }
  revalidateAll(id);
}

// ---------- Notiz hinzufügen (Disposition/Admin oder zugewiesener Monteur) ----------
export async function addNote(fd: FormData): Promise<void> {
  const session = await getSessionProfile();
  if (!session) return;
  const id = str(fd, "id");
  const body = str(fd, "body");
  if (!id || !body) return;
  try {
    await withUserTransaction(session.userId, (client) =>
      client.query(
        `insert into public.incident_notes (incident_id, body, note_type)
         values ($1::uuid, $2, $3)`,
        [id, body, strOrNull(fd, "note_type") ?? "allgemein"],
      ),
    );
  } catch (error) {
    logActionFailure("Notiz speichern", error);
  }
  revalidateAll(id);
}
