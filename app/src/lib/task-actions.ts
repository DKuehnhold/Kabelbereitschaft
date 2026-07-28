"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth";
import { ROLE_LABELS, type UserRole } from "@/lib/roles";
import { TASK_EDIT_STATUS, TASK_PRIORITIES, type TaskPriority, type TaskStatus } from "@/lib/status";
import type { FormState } from "@/lib/incidents";
import type { CreateIncidentTaskInput, UpdateIncidentTaskInput } from "@/lib/tasks";

// =====================================================================
// AP13 – Server-Actions für Aufgaben (incident_tasks).
//
// Rollenprüfung immer serverseitig über getSessionProfile(); zusätzlich
// erzwingt die RLS-Policy is_staff() dasselbe in der Datenbank. Kein
// Service-Role-Zugriff, keine Umgehung von Audit- oder Chroniktriggern.
// Löschen ist nicht vorgesehen (nur Statuswechsel, u. a. "Entfallen").
// =====================================================================

const STAFF_ONLY = "Aufgaben dürfen nur von Disposition und Administration bearbeitet werden.";

async function requireStaff(): Promise<{ userId: string } | null> {
  const session = await getSessionProfile();
  if (!session || session.role === "monteur") return null;
  return { userId: session.userId };
}

function trimOrNull(value: string | null | undefined): string | null {
  const s = (value ?? "").trim();
  return s === "" ? null : s;
}

// Fälligkeit: leer -> null, sonst ISO-8601. Ungültige Eingabe -> "invalid".
function parseDue(value: string | null | undefined): string | null | "invalid" {
  const s = (value ?? "").trim();
  if (s === "") return null;
  const t = Date.parse(s);
  if (Number.isNaN(t)) return "invalid";
  return new Date(t).toISOString();
}

function parseRole(value: UserRole | null | undefined): UserRole | null | "invalid" {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  if (s === "") return null;
  return s in ROLE_LABELS ? (s as UserRole) : "invalid";
}

function mapTaskError(message?: string): string {
  if (!message) return "Speichern der Aufgabe fehlgeschlagen.";
  if (/row-level security|permission denied|42501/i.test(message)) return "Keine Berechtigung für diese Aktion.";
  if (/geloescht|gelöscht/i.test(message)) return "Aufgaben dürfen nicht gelöscht werden (nur Statuswechsel).";
  if (/ack_coherence/i.test(message))
    return "Quittierung und Status passen nicht zusammen. Bitte die Seite neu laden.";
  if (/source_type_chk|task_type_chk|source_chk/i.test(message)) return "Ungültige Aufgabenart.";
  if (/status_chk|priority_chk/i.test(message)) return "Ungültiger Status oder ungültige Priorität.";
  if (/23503|foreign key/i.test(message)) return "Die gewählte Zuständigkeit wurde nicht gefunden.";
  return "Speichern der Aufgabe fehlgeschlagen. Bitte Eingaben prüfen.";
}

// Vorgangsdetail (Aufgabenliste) und die Listen, die has_open_task zeigen.
function revalidateTasks(incidentId: string) {
  revalidatePath(`/vorgaenge/${incidentId}`);
  revalidatePath("/vorgaenge");
  revalidatePath("/meine-einsaetze");
}

type AssigneePatch = {
  assignee_profile_id?: string | null;
  assignee_team_id?: string | null;
  assignee_role?: UserRole | null;
};

type TaskPatch = {
  title?: string;
  body?: string | null;
  priority?: TaskPriority;
  due_at?: string | null;
  status?: TaskStatus;
  acknowledged_at?: string | null;
  acknowledged_by?: string | null;
} & AssigneePatch;

// Zuständigkeit auswerten. Nur übergebene Felder werden verändert;
// null löscht die jeweilige Zuständigkeit.
function assigneePatch(
  input: CreateIncidentTaskInput | UpdateIncidentTaskInput,
): AssigneePatch | { error: string } {
  const patch: AssigneePatch = {};
  if (input.assignee_profile_id !== undefined) patch.assignee_profile_id = trimOrNull(input.assignee_profile_id);
  if (input.assignee_team_id !== undefined) patch.assignee_team_id = trimOrNull(input.assignee_team_id);
  if (input.assignee_role !== undefined) {
    const role = parseRole(input.assignee_role);
    if (role === "invalid") return { error: "Ungültige Rolle als Zuständigkeit." };
    patch.assignee_role = role;
  }
  return patch;
}

// ---------- Manuelle Aufgabe anlegen ----------
export async function createIncidentTask(input: CreateIncidentTaskInput): Promise<FormState> {
  const staff = await requireStaff();
  if (!staff) return { ok: false, error: STAFF_ONLY };

  const incidentId = (input.incident_id ?? "").trim();
  const title = (input.title ?? "").trim();
  if (!incidentId) return { ok: false, error: "Kein Vorgang angegeben." };
  if (!title) return { ok: false, error: "Ein Titel ist erforderlich." };

  const priority: TaskPriority = input.priority ?? "normal";
  if (!(TASK_PRIORITIES as readonly string[]).includes(priority))
    return { ok: false, error: "Ungültige Priorität." };

  const due = parseDue(input.due_at);
  if (due === "invalid") return { ok: false, error: "Ungültige Fälligkeit." };

  const assignee = assigneePatch(input);
  if ("error" in assignee) return { ok: false, error: assignee.error };

  const supabase = await createClient();
  const { error } = await supabase.from("incident_tasks").insert({
    incident_id: incidentId,
    // Manuelle Aufgaben tragen zwingend task_type = 'manual' (Check-Constraint).
    task_type: "manual",
    source: "manual",
    title,
    body: trimOrNull(input.body),
    status: "open",
    priority,
    due_at: due,
    assignee_profile_id: assignee.assignee_profile_id ?? null,
    assignee_team_id: assignee.assignee_team_id ?? null,
    assignee_role: assignee.assignee_role ?? null,
  });
  if (error) return { ok: false, error: mapTaskError(error.message) };

  revalidateTasks(incidentId);
  return { ok: true, error: null };
}

// ---------- Aufgabe bearbeiten (Titel, Text, Priorität, Fälligkeit, Zuständigkeit, Status) ----------
export async function updateIncidentTask(input: UpdateIncidentTaskInput): Promise<FormState> {
  const staff = await requireStaff();
  if (!staff) return { ok: false, error: STAFF_ONLY };

  const id = (input.id ?? "").trim();
  const incidentId = (input.incident_id ?? "").trim();
  if (!id || !incidentId) return { ok: false, error: "Aufgabe oder Vorgang fehlt." };

  const patch: TaskPatch = {};

  if (input.title !== undefined) {
    const title = input.title.trim();
    if (!title) return { ok: false, error: "Ein Titel ist erforderlich." };
    patch.title = title;
  }
  if (input.body !== undefined) patch.body = trimOrNull(input.body);
  if (input.priority !== undefined) {
    if (!(TASK_PRIORITIES as readonly string[]).includes(input.priority))
      return { ok: false, error: "Ungültige Priorität." };
    patch.priority = input.priority;
  }
  if (input.due_at !== undefined) {
    const due = parseDue(input.due_at);
    if (due === "invalid") return { ok: false, error: "Ungültige Fälligkeit." };
    patch.due_at = due;
  }
  if (input.status !== undefined) {
    // Quittieren erfordert acknowledged_at/_by und läuft ausschließlich
    // über acknowledgeIncidentTask.
    if (input.status === "acknowledged")
      return { ok: false, error: "Zum Quittieren bitte die Quittier-Aktion verwenden." };
    if (!TASK_EDIT_STATUS.includes(input.status)) return { ok: false, error: "Ungültiger Aufgabenstatus." };
    patch.status = input.status;
    // Kohärenzbedingung: außerhalb von 'acknowledged' sind beide Felder NULL.
    patch.acknowledged_at = null;
    patch.acknowledged_by = null;
  }

  const assignee = assigneePatch(input);
  if ("error" in assignee) return { ok: false, error: assignee.error };
  Object.assign(patch, assignee);

  if (Object.keys(patch).length === 0) return { ok: true, error: null };

  const supabase = await createClient();
  const { error } = await supabase.from("incident_tasks").update(patch).eq("id", id);
  if (error) return { ok: false, error: mapTaskError(error.message) };

  revalidateTasks(incidentId);
  return { ok: true, error: null };
}

// ---------- Quittieren (Status, Zeitpunkt und Person zwingend gemeinsam) ----------
export async function acknowledgeIncidentTask(taskId: string, incidentId: string): Promise<FormState> {
  const staff = await requireStaff();
  if (!staff) return { ok: false, error: STAFF_ONLY };
  const id = (taskId ?? "").trim();
  const incident = (incidentId ?? "").trim();
  if (!id || !incident) return { ok: false, error: "Aufgabe oder Vorgang fehlt." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("incident_tasks")
    .update({
      status: "acknowledged",
      acknowledged_at: new Date().toISOString(),
      acknowledged_by: staff.userId,
    })
    .eq("id", id);
  if (error) return { ok: false, error: mapTaskError(error.message) };

  revalidateTasks(incident);
  return { ok: true, error: null };
}

// ---------- Wieder öffnen (Quittierung zurücknehmen) ----------
export async function reopenIncidentTask(taskId: string, incidentId: string): Promise<FormState> {
  const staff = await requireStaff();
  if (!staff) return { ok: false, error: STAFF_ONLY };
  const id = (taskId ?? "").trim();
  const incident = (incidentId ?? "").trim();
  if (!id || !incident) return { ok: false, error: "Aufgabe oder Vorgang fehlt." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("incident_tasks")
    .update({ status: "open", acknowledged_at: null, acknowledged_by: null })
    .eq("id", id);
  if (error) return { ok: false, error: mapTaskError(error.message) };

  revalidateTasks(incident);
  return { ok: true, error: null };
}
