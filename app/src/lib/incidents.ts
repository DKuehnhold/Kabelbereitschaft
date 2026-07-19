import { createClient } from "@/lib/supabase/server";
import type { IncidentStatus, ConditionRating } from "@/lib/status";
import type { Priority } from "@/lib/priority";

// Sichtmodelle (View-Types) – bewusst entkoppelt von den generischen
// Supabase-Embed-Typen; Ergebnisse werden gecastet.
export type StageRef = { id: string; name: string; code: string | null } | null;
export type OnCallRef = { id: string; number: string; label: string | null } | null;
export type MonteurRef = { id: string; full_name: string | null } | null;

export type AssignmentRef = {
  id: string;
  monteur_id: string;
  is_active: boolean;
  assigned_at: string;
  monteur: MonteurRef;
};

export type IncidentRow = {
  id: string;
  incident_no: number;
  status: IncidentStatus;
  priority: Priority;
  condition_rating: ConditionRating | null;
  vzg_line_number: string;
  km_from: number;
  km_to: number | null;
  operating_point: string | null;
  track: string | null;
  direction: string | null;
  object_type: string | null;
  object_designation: string | null;
  location_description: string | null;
  external_reference: string | null;
  caller_name: string | null;
  caller_contact: string | null;
  title: string | null;
  description: string | null;
  internal_note: string | null;
  closing_note: string | null;
  on_call_number_id: string | null;
  call_received_at: string | null;
  construction_stage_id: string;
  closed_at: string | null;
  closed_by: string | null;
  created_at: string;
  updated_at: string;
  // Frühester Wechsel nach „technisch_abgeschlossen" (für CSV-Export); aus Chronik.
  technisch_abgeschlossen_at: string | null;
  stage: StageRef;
  oncall: OnCallRef;
  assignments: AssignmentRef[];
};

export type StatusEvent = {
  id: string;
  old_status: IncidentStatus | null;
  new_status: IncidentStatus;
  note: string | null;
  changed_by: string | null;
  changed_at: string;
};

export type NoteEvent = {
  id: string;
  note_type: string;
  body: string;
  created_by: string | null;
  created_at: string;
};

export type IncidentDetail = {
  incident: IncidentRow;
  history: StatusEvent[];
  notes: NoteEvent[];
};

const INCIDENT_SELECT = `
  id, incident_no, status, priority, condition_rating,
  vzg_line_number, km_from, km_to, operating_point, track, direction,
  object_type, object_designation, location_description, external_reference,
  caller_name, caller_contact, title, description, internal_note, closing_note,
  on_call_number_id, call_received_at, construction_stage_id,
  closed_at, closed_by, created_at, updated_at,
  stage:construction_stages(id, name, code),
  oncall:on_call_numbers(id, number, label),
  assignments:incident_assignments(id, monteur_id, is_active, assigned_at, monteur:profiles(id, full_name))
`;

// Sichtbarkeit wird durch RLS erzwungen: Disposition/Admin sehen alle,
// Monteur nur zugewiesene Vorgänge.
export async function listIncidents(): Promise<IncidentRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("incidents")
    .select(INCIDENT_SELECT)
    .order("updated_at", { ascending: false });
  const rows = (data ?? []) as unknown as IncidentRow[];
  if (rows.length === 0) return rows;

  // Technischer Abschlusszeitpunkt (frühester Wechsel nach technisch_abgeschlossen).
  const ids = rows.map((r) => r.id);
  const { data: hist } = await supabase
    .from("incident_status_history")
    .select("incident_id, changed_at")
    .eq("new_status", "technisch_abgeschlossen")
    .in("incident_id", ids)
    .order("changed_at", { ascending: true });
  const techMap = new Map<string, string>();
  for (const h of (hist ?? []) as { incident_id: string; changed_at: string }[]) {
    if (!techMap.has(h.incident_id)) techMap.set(h.incident_id, h.changed_at);
  }
  for (const r of rows) r.technisch_abgeschlossen_at = techMap.get(r.id) ?? null;
  return rows;
}

export async function getIncidentDetail(id: string): Promise<IncidentDetail | null> {
  const supabase = await createClient();
  const { data: incident } = await supabase
    .from("incidents")
    .select(INCIDENT_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (!incident) return null;

  const { data: history } = await supabase
    .from("incident_status_history")
    .select("id, old_status, new_status, note, changed_by, changed_at")
    .eq("incident_id", id)
    .order("changed_at", { ascending: true });

  const { data: notes } = await supabase
    .from("incident_notes")
    .select("id, note_type, body, created_by, created_at")
    .eq("incident_id", id)
    .order("created_at", { ascending: true });

  const inc = incident as unknown as IncidentRow;
  inc.technisch_abgeschlossen_at =
    (history ?? []).find((h) => h.new_status === "technisch_abgeschlossen")?.changed_at ?? null;

  return {
    incident: inc,
    history: (history ?? []) as StatusEvent[],
    notes: (notes ?? []) as NoteEvent[],
  };
}

export async function getMonteure(): Promise<{ id: string; full_name: string | null }[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("role", "monteur")
    .eq("is_active", true)
    .order("full_name", { ascending: true });
  return (data ?? []) as { id: string; full_name: string | null }[];
}

export async function getStages(): Promise<{ id: string; name: string; code: string | null }[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("construction_stages")
    .select("id, name, code")
    .eq("is_active", true)
    .order("name", { ascending: true });
  return (data ?? []) as { id: string; name: string; code: string | null }[];
}

export async function getOnCallNumbers(): Promise<{ id: string; number: string; label: string | null }[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("on_call_numbers")
    .select("id, number, label")
    .eq("is_active", true)
    .order("number", { ascending: true });
  return (data ?? []) as { id: string; number: string; label: string | null }[];
}

// Aktive Monteurnamen eines Vorgangs.
export function activeMonteurNames(row: IncidentRow): string[] {
  return row.assignments
    .filter((a) => a.is_active)
    .map((a) => a.monteur?.full_name ?? "—");
}

export type FormState = { ok: boolean; error: string | null };
