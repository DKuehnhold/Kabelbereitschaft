import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@/lib/roles";
import type { TaskPriority, TaskSource, TaskStatus, TaskType } from "@/lib/status";

// =====================================================================
// AP13 – Aufgaben je Vorgang (incident_tasks): Typen und Reads.
//
// Sichtbarkeit wird ausschließlich durch die Datenbank erzwungen:
//   * Staff liest direkt auf der Tabelle (RLS-Policy is_staff()),
//   * Monteure haben KEIN Tabellenrecht und lesen ausschließlich über die
//     gehärtete SECURITY-DEFINER-RPC get_assigned_incident_tasks.
// Keine Service-Role, kein zweiter Datenzugriffsweg.
//
// Wertebereiche und deutsche Bezeichnungen liegen in @/lib/status (rein,
// damit Client-Komponenten sie ohne Serverimport nutzen können) und werden
// hier für den Serverkontext weitergereicht.
// =====================================================================
export type { TaskPriority, TaskSource, TaskStatus, TaskType } from "@/lib/status";
export {
  TASK_TYPES,
  TASK_STATUS,
  TASK_PRIORITIES,
  TASK_SOURCES,
  TASK_TYPE_LABELS,
  TASK_STATUS_LABELS,
  TASK_PRIORITY_LABELS,
  TASK_SOURCE_LABELS,
  TASK_EDIT_STATUS,
  TASK_STATUS_TONE,
  TASK_PRIORITY_TONE,
  isOpenTask,
} from "@/lib/status";

// Vollbild einer Aufgabe (Staff-Sicht, entspricht public.incident_tasks).
export type IncidentTask = {
  id: string;
  incident_id: string;
  task_type: TaskType;
  source: TaskSource;
  title: string;
  body: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  due_at: string | null;
  assignee_profile_id: string | null;
  assignee_team_id: string | null;
  assignee_role: UserRole | null;
  acknowledged_at: string | null;
  acknowledged_by: string | null;
  created_at: string;
  created_by: string | null;
  updated_at: string;
  updated_by: string | null;
};

// Minimierte Monteur-Sicht (Rückgabe der RPC – keine Zuständigkeitsfelder,
// keine Namen, keine Auditfelder).
export type AssignedIncidentTask = {
  incident_id: string;
  task_type: TaskType;
  title: string;
  status: TaskStatus;
  due_at: string | null;
};

// Eingaben der Server-Actions (hier definiert, damit sowohl die Actions als
// auch die Client-Komponente sie als Typ importieren können).
export type IncidentTaskAssigneeInput = {
  assignee_profile_id?: string | null;
  assignee_team_id?: string | null;
  assignee_role?: UserRole | null;
};

export type CreateIncidentTaskInput = {
  incident_id: string;
  title: string;
  body?: string | null;
  priority?: TaskPriority;
  due_at?: string | null;
} & IncidentTaskAssigneeInput;

export type UpdateIncidentTaskInput = {
  id: string;
  incident_id: string;
  // Nur für manuelle Aufgaben sinnvoll; abgeleitete Titel pflegt die Datenbank.
  title?: string;
  body?: string | null;
  priority?: TaskPriority;
  due_at?: string | null;
  status?: TaskStatus;
} & IncidentTaskAssigneeInput;

const TASK_SELECT =
  "id, incident_id, task_type, source, title, body, status, priority, due_at, " +
  "assignee_profile_id, assignee_team_id, assignee_role, acknowledged_at, acknowledged_by, " +
  "created_at, created_by, updated_at, updated_by";

// Staff-Sicht: alle nicht entfallenen Aufgaben eines Vorgangs.
export async function listIncidentTasks(incidentId: string): Promise<IncidentTask[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("incident_tasks")
    .select(TASK_SELECT)
    .eq("incident_id", incidentId)
    .neq("status", "void")
    .order("created_at", { ascending: true });
  return (data ?? []) as unknown as IncidentTask[];
}

// Monteur-Sicht: offene Aufgaben eines zugewiesenen Vorgangs.
// Die RPC wirft bei fehlender Zuweisung einen Fehler – daraus wird eine
// leere Liste, damit die Detailseite nicht bricht.
export async function listAssignedIncidentTasks(incidentId: string): Promise<AssignedIncidentTask[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_assigned_incident_tasks", { p_incident_id: incidentId });
  if (error) return [];
  return (data ?? []) as unknown as AssignedIncidentTask[];
}
