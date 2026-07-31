import { getSessionProfile } from "@/lib/auth";
import { isUuid, withUserTransaction } from "@/lib/db";
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
// AP14/B: die Reads laufen auf PostgreSQL (ADR-011 / 2.5) über
// withUserTransaction(); die Identität stammt ausschließlich aus der
// serverseitig geprüften Auth.js-Sitzung. Fehlt sie, wird kein SQL
// ausgeführt – das Ergebnis ist dasselbe wie bisher (ohne Identität liefert
// weder die RLS noch die RPC eine Zeile), der Abbruch erfolgt aber schon vor
// dem Verbindungsaufbau.
//
// Die Zeilen werden wie bei den Vorgangs-Reads als JSON projiziert
// (`to_json`): der Treiber liefert `timestamptz` sonst als JS-Date, was den
// unten deklarierten Sichtmodellen (ISO-8601-Text) widerspräche. Die
// JSON-Serialisierung von PostgreSQL erzeugt genau die bisherigen Werte.
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

// Nur feste Bausteine werden zusammengesetzt: TASK_SELECT ist eine
// Modulkonstante, es gelangt kein Eingabewert in den SQL-Text.
const LIST_INCIDENT_TASKS_SQL = `
  select to_json(r) as task
  from (
    select ${TASK_SELECT}
    from public.incident_tasks
    where incident_id = $1::uuid and status <> 'void'
  ) r
  order by r.created_at asc`;

// Die RPC sortiert selbst nach created_at; die Projektion darf diese Ordnung
// nicht überlagern, weil created_at bewusst nicht zurückgegeben wird.
const LIST_ASSIGNED_INCIDENT_TASKS_SQL = `
  select to_json(t) as task
  from public.get_assigned_incident_tasks($1::uuid) t`;

type IncidentTaskResult = { task: IncidentTask };
type AssignedIncidentTaskResult = { task: AssignedIncidentTask };

// Staff-Sicht: alle nicht entfallenen Aufgaben eines Vorgangs.
export async function listIncidentTasks(incidentId: string): Promise<IncidentTask[]> {
  const session = await getSessionProfile();
  // Fail-closed und wie bisher ohne Ausnahme: eine fehlende Sitzung oder eine
  // unbrauchbare Kennung ergibt eine leere Liste.
  if (!session || !isUuid(incidentId)) return [];
  return withUserTransaction(session.userId, async (client) => {
    const result = await client.query<IncidentTaskResult>(LIST_INCIDENT_TASKS_SQL, [incidentId]);
    return result.rows.map((row) => row.task);
  });
}

// Monteur-Sicht: offene Aufgaben eines zugewiesenen Vorgangs.
// Die RPC wirft bei fehlender Zuweisung einen Fehler – daraus wird eine
// leere Liste, damit die Detailseite nicht bricht.
export async function listAssignedIncidentTasks(incidentId: string): Promise<AssignedIncidentTask[]> {
  const session = await getSessionProfile();
  if (!session || !isUuid(incidentId)) return [];
  try {
    // Abgefangen wird UM den Wrapper herum: withUserTransaction setzt die
    // Transaktion bei einer Ausnahme zurück und wirft sie weiter. Ein catch
    // innerhalb des Rückrufs würde die Transaktion stattdessen bestätigen.
    return await withUserTransaction(session.userId, async (client) => {
      const result = await client.query<AssignedIncidentTaskResult>(
        LIST_ASSIGNED_INCIDENT_TASKS_SQL,
        [incidentId],
      );
      return result.rows.map((row) => row.task);
    });
  } catch (error) {
    // Erwartbar bei fehlender Zuweisung (42501). Die Datenbankmeldung bleibt
    // serverseitig; nach außen bleibt es wie bisher eine leere Liste.
    console.error(
      "Aufgaben des zugewiesenen Vorgangs nicht lesbar",
      error instanceof Error ? error.message : "unbekannter Fehler",
    );
    return [];
  }
}
