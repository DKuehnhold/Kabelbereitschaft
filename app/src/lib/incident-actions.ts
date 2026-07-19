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

// ---------- Vorgang anlegen (Disposition/Admin) ----------
export async function createIncident(
  _prev: FormState,
  fd: FormData,
): Promise<FormState> {
  const session = await getSessionProfile();
  if (!session) return { ok: false, error: "Nicht angemeldet." };
  if (session.role === "monteur")
    return { ok: false, error: "Nur Disposition/Administration darf Vorgänge anlegen." };

  const construction_stage_id = strOrNull(fd, "construction_stage_id");
  const on_call_number_id = strOrNull(fd, "on_call_number_id");
  const vzg_line_number = str(fd, "vzg_line_number");
  const km_from = num(fd, "km_from");
  const priority = str(fd, "priority") as Priority;

  // AP2-Pflichtfelder (km_to bleibt optional)
  const required: [string, unknown][] = [
    ["Baustufe", construction_stage_id],
    ["Bereitschaftsnummer", on_call_number_id],
    ["VzG-Streckennummer", vzg_line_number],
    ["Kilometer von", km_from],
    ["Betriebsstelle", strOrNull(fd, "operating_point")],
    ["Gleis", strOrNull(fd, "track")],
    ["Richtung", strOrNull(fd, "direction")],
    ["Objektart", strOrNull(fd, "object_type")],
    ["Objektbezeichnung", strOrNull(fd, "object_designation")],
    ["Ortsbeschreibung", strOrNull(fd, "location_description")],
    ["Beschreibung", strOrNull(fd, "description")],
    ["DB-Ansprechpartner", strOrNull(fd, "caller_name")],
    ["Telefon", strOrNull(fd, "caller_contact")],
    ["Bemerkung", strOrNull(fd, "internal_note")],
  ];
  const missing = required.filter(([, v]) => v === null || v === "").map(([l]) => l);
  if (missing.length) return { ok: false, error: `Pflichtfelder fehlen: ${missing.join(", ")}.` };
  if (!PRIORITIES.includes(priority)) return { ok: false, error: "Ungültige Priorität." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("incidents")
    .insert({
      construction_stage_id: construction_stage_id!,
      on_call_number_id,
      vzg_line_number,
      km_from: km_from!,
      km_to: num(fd, "km_to"),
      operating_point: strOrNull(fd, "operating_point"),
      track: strOrNull(fd, "track"),
      direction: strOrNull(fd, "direction"),
      object_type: strOrNull(fd, "object_type"),
      object_designation: strOrNull(fd, "object_designation"),
      location_description: strOrNull(fd, "location_description"),
      priority,
      description: strOrNull(fd, "description"),
      caller_name: strOrNull(fd, "caller_name"),
      caller_contact: strOrNull(fd, "caller_contact"),
      internal_note: strOrNull(fd, "internal_note"),
      call_received_at: new Date().toISOString(),
      status: "neu",
    })
    .select("id")
    .single();

  if (error || !data) return { ok: false, error: `Speichern fehlgeschlagen: ${error?.message ?? "unbekannt"}` };
  revalidateAll();
  redirect(`/vorgaenge/${data.id}`);
}

// ---------- Vorgang bearbeiten (Disposition/Admin) ----------
export async function updateIncident(
  _prev: FormState,
  fd: FormData,
): Promise<FormState> {
  const session = await getSessionProfile();
  if (!session) return { ok: false, error: "Nicht angemeldet." };
  if (session.role === "monteur")
    return { ok: false, error: "Bearbeiten ist der Disposition/Administration vorbehalten." };

  const id = str(fd, "id");
  if (!id) return { ok: false, error: "Kein Vorgang angegeben." };
  const priority = str(fd, "priority") as Priority;
  if (!PRIORITIES.includes(priority)) return { ok: false, error: "Ungültige Priorität." };
  const km_from = num(fd, "km_from");
  if (km_from === null) return { ok: false, error: "Kilometer von ist erforderlich." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("incidents")
    .update({
      construction_stage_id: strOrNull(fd, "construction_stage_id") ?? undefined,
      on_call_number_id: strOrNull(fd, "on_call_number_id"),
      vzg_line_number: str(fd, "vzg_line_number"),
      km_from,
      km_to: num(fd, "km_to"),
      operating_point: strOrNull(fd, "operating_point"),
      track: strOrNull(fd, "track"),
      direction: strOrNull(fd, "direction"),
      object_type: strOrNull(fd, "object_type"),
      object_designation: strOrNull(fd, "object_designation"),
      location_description: strOrNull(fd, "location_description"),
      external_reference: strOrNull(fd, "external_reference"),
      priority,
      description: strOrNull(fd, "description"),
      internal_note: strOrNull(fd, "internal_note"),
      caller_name: strOrNull(fd, "caller_name"),
      caller_contact: strOrNull(fd, "caller_contact"),
    })
    .eq("id", id);

  if (error) return { ok: false, error: `Speichern fehlgeschlagen: ${error.message}` };
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
