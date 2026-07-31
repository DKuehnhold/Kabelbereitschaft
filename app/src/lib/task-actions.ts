"use server";

import { revalidatePath } from "next/cache";
import { withUserTransaction } from "@/lib/db";
import { pgErrorCode, PG_FOREIGN_KEY_VIOLATION, PG_INSUFFICIENT_PRIVILEGE } from "@/lib/db/pg-errors";
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
//
// AP14/B: jede Aktion schreibt über withUserTransaction() mit der Identität
// aus der geprüften Auth.js-Sitzung (ADR-011 / 2.5). Die Ableitung der
// derived-Aufgaben bleibt Sache der Datenbanktrigger; hier wird keine
// Reconciliation-Funktion aufgerufen. Eine Datenbankmeldung wird
// ausschließlich serverseitig zur Klassifizierung ausgewertet (mapTaskError)
// und gelangt nie in ein Aktionsergebnis.
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

/**
 * Fachmeldung zu einem Datenbankfehler – ohne die Datenbankmeldung nach außen.
 *
 * Wo der SQLSTATE die Einordnung eindeutig macht (42501 keine Berechtigung,
 * 23503 fehlende Zuständigkeit), wird ausschließlich der Code an mapTaskError()
 * gegeben; dessen Muster enthalten genau diese Codes. Andernfalls dient die
 * Datenbankmeldung serverseitig als Einordnungsgrundlage, weil nur sie den
 * verletzten Constraint benennt (ack_coherence, task_type_chk, status_chk).
 * Zurück geht immer nur die bestehende deutsche Konstante.
 */
function taskErrorMessage(error: unknown): string {
  const code = pgErrorCode(error);
  if (code === PG_INSUFFICIENT_PRIVILEGE || code === PG_FOREIGN_KEY_VIOLATION) return mapTaskError(code);
  return mapTaskError(error instanceof Error ? error.message : undefined);
}

/**
 * Bindet einen Wert und liefert AUSSCHLIESSLICH dessen Platzhalter ($1, $2, …).
 *
 * Damit bleibt der zusammengesetzte SQL-Text frei von Eingabewerten: in den
 * Text gelangt nur die Nummer des Platzhalters, der Wert ausschließlich in die
 * Werteliste.
 */
function bind(values: unknown[], value: unknown): string {
  values.push(value);
  return `$${values.length}`;
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

/**
 * Feste Spalten-Allow-List der änderbaren Felder.
 *
 * Nur die hier im Quelltext stehenden Spaltennamen und Typumwandlungen können
 * in die SET-Liste gelangen; alle Werte werden über bind() als Parameter
 * übergeben. Ein Patchfeld ohne Eintrag wird verworfen.
 */
const TASK_UPDATE_COLUMNS: Record<keyof TaskPatch, { column: string; cast: string }> = {
  title: { column: "title", cast: "" },
  body: { column: "body", cast: "" },
  priority: { column: "priority", cast: "" },
  due_at: { column: "due_at", cast: "::timestamptz" },
  status: { column: "status", cast: "" },
  acknowledged_at: { column: "acknowledged_at", cast: "::timestamptz" },
  acknowledged_by: { column: "acknowledged_by", cast: "::uuid" },
  assignee_profile_id: { column: "assignee_profile_id", cast: "::uuid" },
  assignee_team_id: { column: "assignee_team_id", cast: "::uuid" },
  assignee_role: { column: "assignee_role", cast: "::public.user_role" },
};

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

  try {
    // task_type, source und status sind feste Werte im Anweisungstext
    // (Check-Constraints task_type_chk und source_type_chk); alles Übrige ist
    // Parameter.
    await withUserTransaction(staff.userId, (client) =>
      client.query(
        `insert into public.incident_tasks (
           incident_id, task_type, source, title, body, status, priority, due_at,
           assignee_profile_id, assignee_team_id, assignee_role
         )
         values ($1::uuid, 'manual', 'manual', $2, $3, 'open', $4, $5::timestamptz,
                 $6::uuid, $7::uuid, $8::public.user_role)`,
        [
          incidentId,
          title,
          trimOrNull(input.body),
          priority,
          due,
          assignee.assignee_profile_id ?? null,
          assignee.assignee_team_id ?? null,
          assignee.assignee_role ?? null,
        ],
      ),
    );
  } catch (error) {
    return { ok: false, error: taskErrorMessage(error) };
  }

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

  // SET-Liste ausschließlich aus der Allow-List; die Werte als Parameter.
  const values: unknown[] = [];
  const setClauses: string[] = [];
  for (const key of Object.keys(patch) as (keyof TaskPatch)[]) {
    if (!Object.prototype.hasOwnProperty.call(TASK_UPDATE_COLUMNS, key)) continue;
    const target = TASK_UPDATE_COLUMNS[key];
    setClauses.push(`${target.column} = ${bind(values, patch[key] ?? null)}${target.cast}`);
  }
  // Leere Patchmenge: wie bisher ohne Datenbankzugriff erfolgreich.
  if (setClauses.length === 0) return { ok: true, error: null };
  const idPlaceholder = bind(values, id);

  try {
    await withUserTransaction(staff.userId, (client) =>
      client.query(
        `update public.incident_tasks
            set ${setClauses.join(", ")}
          where id = ${idPlaceholder}::uuid`,
        values,
      ),
    );
  } catch (error) {
    return { ok: false, error: taskErrorMessage(error) };
  }

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

  try {
    // Status, Zeitpunkt und Person gemeinsam in EINER Anweisung – die
    // Kohärenzbedingung ack_coherence lässt keinen Zwischenzustand zu.
    await withUserTransaction(staff.userId, (client) =>
      client.query(
        `update public.incident_tasks
            set status = 'acknowledged',
                acknowledged_at = $1::timestamptz,
                acknowledged_by = $2::uuid
          where id = $3::uuid`,
        [new Date().toISOString(), staff.userId, id],
      ),
    );
  } catch (error) {
    return { ok: false, error: taskErrorMessage(error) };
  }

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

  try {
    // Quittierung zurücknehmen: außerhalb von 'acknowledged' sind beide
    // Quittierfelder NULL (ack_coherence).
    await withUserTransaction(staff.userId, (client) =>
      client.query(
        `update public.incident_tasks
            set status = 'open', acknowledged_at = null, acknowledged_by = null
          where id = $1::uuid`,
        [id],
      ),
    );
  } catch (error) {
    return { ok: false, error: taskErrorMessage(error) };
  }

  revalidateTasks(incident);
  return { ok: true, error: null };
}
