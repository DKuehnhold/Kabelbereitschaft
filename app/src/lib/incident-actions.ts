"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth";
import {
  INCIDENT_STATUS,
  MONTEUR_STATUS,
  CONDITION_RATING,
  type IncidentStatus,
  type ConditionRating,
} from "@/lib/status";
import { PRIORITIES, type Priority } from "@/lib/priority";
import type { FormState } from "@/lib/incidents";
import type { Incident } from "@/lib/database.types";

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

// ---------- AP10-Helfer: serverseitige Referenzprüfung + Fehlerabbildung ----------
type RefInput = {
  customer_id: string;
  construction_stage_id: string;
  vzg_line_id: string;
  cable_type_ids: string[];
  on_call_number_id: string | null;
};

async function validateRefs(
  supabase: Awaited<ReturnType<typeof createClient>>,
  r: RefInput,
  requireActive: boolean,
): Promise<string | null> {
  const [cust, stage, vzg, cables, oncall] = await Promise.all([
    supabase.from("customers").select("id, is_active").eq("id", r.customer_id).maybeSingle(),
    supabase.from("construction_stages").select("id, is_active").eq("id", r.construction_stage_id).maybeSingle(),
    supabase.from("vzg_lines").select("id, is_active, construction_stage_id").eq("id", r.vzg_line_id).maybeSingle(),
    supabase.from("cable_types").select("id, is_active").in("id", r.cable_type_ids),
    r.on_call_number_id
      ? supabase.from("on_call_numbers").select("id, is_active").eq("id", r.on_call_number_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const c = cust.data as { is_active: boolean } | null;
  const s = stage.data as { is_active: boolean } | null;
  const v = vzg.data as { is_active: boolean; construction_stage_id: string } | null;
  const cableRows = (cables.data ?? []) as { id: string; is_active: boolean }[];
  const o = (oncall as { data: { is_active: boolean } | null }).data;

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

  const supabase = await createClient();
  const refErr = await validateRefs(
    supabase,
    {
      customer_id: f.customer_id!,
      construction_stage_id: f.construction_stage_id!,
      vzg_line_id: f.vzg_line_id!,
      cable_type_ids: positions!.map((p) => p.cable_type_id),
      on_call_number_id: f.on_call_number_id,
    },
    true, // Neuanlage: nur aktive Stammdaten
  );
  if (refErr) return { ok: false, error: refErr };

  const { data, error } = await supabase.rpc("create_incident_ap12", {
    p_customer_id: f.customer_id!,
    p_construction_stage_id: f.construction_stage_id!,
    p_vzg_line_id: f.vzg_line_id!,
    p_on_call_number_id: f.on_call_number_id,
    p_priority: f.priority,
    p_description: f.description!,
    p_operating_point: strOrNull(fd, "operating_point"),
    p_track: strOrNull(fd, "track"),
    p_direction: strOrNull(fd, "direction"),
    p_object_type: strOrNull(fd, "object_type"),
    p_object_designation: strOrNull(fd, "object_designation"),
    p_location_description: strOrNull(fd, "location_description"),
    p_external_reference: strOrNull(fd, "external_reference"),
    p_km_from: num(fd, "km_from"),
    p_km_to: num(fd, "km_to"),
    p_caller_name: strOrNull(fd, "caller_name"),
    p_caller_contact: strOrNull(fd, "caller_contact"),
    p_internal_note: strOrNull(fd, "internal_note"),
    p_contact_id: f.contact_id,
    p_contact_phone_number_id: f.contact_phone_number_id,
    p_cable_positions: positions!,
  });
  if (error || !data) return { ok: false, error: mapDbError(error?.message) };
  revalidateAll();
  redirect(`/vorgaenge/${data}`);
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

  const supabase = await createClient();
  // Bearbeitung: bereits gespeicherte, ggf. inaktive Referenzen zulassen (Bestand),
  // aber Existenz und VzG-Zugehörigkeit zum Bauabschnitt weiterhin prüfen.
  const refErr = await validateRefs(
    supabase,
    {
      customer_id: f.customer_id!,
      construction_stage_id: f.construction_stage_id!,
      vzg_line_id: f.vzg_line_id!,
      cable_type_ids: positions!.map((p) => p.cable_type_id),
      on_call_number_id: f.on_call_number_id,
    },
    false,
  );
  if (refErr) return { ok: false, error: refErr };

  const { error } = await supabase.rpc("update_incident_ap12", {
    p_id: id,
    p_customer_id: f.customer_id!,
    p_construction_stage_id: f.construction_stage_id!,
    p_vzg_line_id: f.vzg_line_id!,
    p_on_call_number_id: f.on_call_number_id,
    p_priority: f.priority,
    p_description: f.description!,
    p_operating_point: strOrNull(fd, "operating_point"),
    p_track: strOrNull(fd, "track"),
    p_direction: strOrNull(fd, "direction"),
    p_object_type: strOrNull(fd, "object_type"),
    p_object_designation: strOrNull(fd, "object_designation"),
    p_location_description: strOrNull(fd, "location_description"),
    p_external_reference: strOrNull(fd, "external_reference"),
    p_km_from: num(fd, "km_from"),
    p_km_to: num(fd, "km_to"),
    p_caller_name: strOrNull(fd, "caller_name"),
    p_caller_contact: strOrNull(fd, "caller_contact"),
    p_internal_note: strOrNull(fd, "internal_note"),
    p_contact_id: f.contact_id,
    p_contact_phone_number_id: f.contact_phone_number_id,
    p_cable_positions: positions!,
  });
  if (error) return { ok: false, error: mapDbError(error.message) };
  revalidateAll(id);
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

  const patch: Partial<Incident> = { status };
  if (isStaff && (status === "abgeschlossen" || status === "durch_disposition_geprueft")) {
    patch.closed_at = new Date().toISOString();
    patch.closed_by = session.userId;
    const note = strOrNull(fd, "closing_note");
    if (note) patch.closing_note = note;
  }

  const supabase = await createClient();
  await supabase.from("incidents").update(patch).eq("id", id);
  revalidateAll(id);
}

// ---------- Zustandsbewertung ----------
export async function updateCondition(fd: FormData): Promise<void> {
  const session = await getSessionProfile();
  if (!session) return;
  const id = str(fd, "id");
  const rating = str(fd, "condition_rating") as ConditionRating;
  if (!id || !CONDITION_RATING.includes(rating)) return;
  const supabase = await createClient();
  await supabase.from("incidents").update({ condition_rating: rating }).eq("id", id);
  revalidateAll(id);
}

// ---------- Monteur zuweisen (Disposition/Admin) ----------
export async function addAssignment(fd: FormData): Promise<void> {
  const session = await getSessionProfile();
  if (!session || session.role === "monteur") return;
  const id = str(fd, "id");
  const monteur_id = str(fd, "monteur_id");
  if (!id || !monteur_id) return;

  const supabase = await createClient();
  const { error } = await supabase
    .from("incident_assignments")
    .insert({ incident_id: id, monteur_id, assigned_by: session.userId });
  // Doppelte aktive Zuweisung wird per Unique-Index verhindert – Fehler ignorieren.
  if (!error) {
    await supabase
      .from("incidents")
      .update({ status: "monteur_zugewiesen" })
      .eq("id", id)
      .eq("status", "neu");
  }
  revalidateAll(id);
}

export async function deactivateAssignment(fd: FormData): Promise<void> {
  const session = await getSessionProfile();
  if (!session || session.role === "monteur") return;
  const assignment_id = str(fd, "assignment_id");
  const id = str(fd, "id");
  if (!assignment_id) return;
  const supabase = await createClient();
  await supabase
    .from("incident_assignments")
    .update({ is_active: false, unassigned_at: new Date().toISOString() })
    .eq("id", assignment_id);
  revalidateAll(id);
}

// ---------- Notiz hinzufügen (Disposition/Admin oder zugewiesener Monteur) ----------
export async function addNote(fd: FormData): Promise<void> {
  const session = await getSessionProfile();
  if (!session) return;
  const id = str(fd, "id");
  const body = str(fd, "body");
  if (!id || !body) return;
  const supabase = await createClient();
  await supabase
    .from("incident_notes")
    .insert({ incident_id: id, body, note_type: strOrNull(fd, "note_type") ?? "allgemein" });
  revalidateAll(id);
}
