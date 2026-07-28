"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/primitives";
import { ROLE_LABELS, type UserRole } from "@/lib/roles";
import {
  TASK_EDIT_STATUS,
  TASK_PRIORITIES,
  TASK_PRIORITY_LABELS,
  TASK_PRIORITY_TONE,
  TASK_SOURCE_LABELS,
  TASK_STATUS_LABELS,
  TASK_STATUS_TONE,
  TASK_TYPE_LABELS,
  isOpenTask,
  type TaskPriority,
  type TaskStatus,
} from "@/lib/status";
import {
  acknowledgeIncidentTask,
  createIncidentTask,
  reopenIncidentTask,
  updateIncidentTask,
} from "@/lib/task-actions";
import type { AssignedIncidentTask, IncidentTask } from "@/lib/tasks";
import type { FormState } from "@/lib/incidents";

// =====================================================================
// AP13 – Aufgabenliste im Vorgangsdetail.
//
//   * TaskList        – Staff-Sicht: anlegen, ändern, quittieren, wieder öffnen.
//   * AssignedTaskList – Monteur-Sicht: reine Leseliste der offenen Aufgaben,
//     ohne Zuständigkeitsangaben (Datenquelle ist die minimierte RPC).
//
// Alle Schreibwege laufen über die Server-Actions in @/lib/task-actions;
// die Rollenprüfung erfolgt dort und zusätzlich in der Datenbank (RLS).
// =====================================================================

export type TaskAssigneeOption = { id: string; label: string };

const labelCls = "mb-1 block text-xs font-medium text-muted";
const sectionH = "text-sm font-semibold uppercase text-muted";

function fmtDateTime(iso: string | null): string {
  return iso
    ? new Date(iso).toLocaleString("de-DE", {
        day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
      })
    : "—";
}

// ISO-Zeitstempel -> Wert für <input type="datetime-local"> (lokale Zeit).
function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

// Wert aus <input type="datetime-local"> -> ISO-Zeitstempel (lokale Zeitzone).
function fromLocalInput(value: string): string | null {
  const s = value.trim();
  if (s === "") return null;
  const t = Date.parse(s);
  return Number.isNaN(t) ? null : new Date(t).toISOString();
}

type Draft = {
  title: string;
  body: string;
  priority: TaskPriority;
  status: TaskStatus;
  due: string;
  profileId: string;
  teamId: string;
  role: string;
};

function emptyDraft(): Draft {
  return { title: "", body: "", priority: "normal", status: "open", due: "", profileId: "", teamId: "", role: "" };
}

function draftOf(task: IncidentTask): Draft {
  return {
    title: task.title,
    body: task.body ?? "",
    priority: task.priority,
    // Quittierte Aufgaben werden nicht über das Statusfeld geändert.
    status: task.status === "acknowledged" ? "open" : task.status,
    due: toLocalInput(task.due_at),
    profileId: task.assignee_profile_id ?? "",
    teamId: task.assignee_team_id ?? "",
    role: task.assignee_role ?? "",
  };
}

function Notice({ tone, text }: { tone: "danger" | "muted"; text: string }) {
  if (tone === "danger") {
    return (
      <p
        role="alert"
        className="rounded-md border px-3 py-2 text-sm"
        style={{ background: "var(--danger-bg)", color: "var(--danger)", borderColor: "var(--danger)" }}
      >
        {text}
      </p>
    );
  }
  return <p className="text-xs text-muted">{text}</p>;
}

function TaskFields({
  draft,
  onChange,
  profiles,
  teams,
  idPrefix,
  withTitle,
  withStatus,
}: {
  draft: Draft;
  onChange: (patch: Partial<Draft>) => void;
  profiles: TaskAssigneeOption[];
  teams: TaskAssigneeOption[];
  idPrefix: string;
  withTitle: boolean;
  withStatus: boolean;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {withTitle ? (
        <div className="sm:col-span-2">
          <label className={labelCls} htmlFor={`${idPrefix}_title`}>Titel *</label>
          <input
            id={`${idPrefix}_title`}
            required
            className="input"
            value={draft.title}
            onChange={(e) => onChange({ title: e.target.value })}
            placeholder="z. B. Rückmeldung des Auftraggebers einholen"
          />
        </div>
      ) : null}
      <div className="sm:col-span-2">
        <label className={labelCls} htmlFor={`${idPrefix}_body`}>Beschreibung</label>
        <textarea
          id={`${idPrefix}_body`}
          rows={2}
          className="input"
          value={draft.body}
          onChange={(e) => onChange({ body: e.target.value })}
        />
      </div>
      <div>
        <label className={labelCls} htmlFor={`${idPrefix}_priority`}>Priorität</label>
        <select
          id={`${idPrefix}_priority`}
          className="input"
          value={draft.priority}
          onChange={(e) => onChange({ priority: e.target.value as TaskPriority })}
        >
          {TASK_PRIORITIES.map((p) => (
            <option key={p} value={p}>{TASK_PRIORITY_LABELS[p]}</option>
          ))}
        </select>
      </div>
      <div>
        <label className={labelCls} htmlFor={`${idPrefix}_due`}>Fällig am</label>
        <input
          id={`${idPrefix}_due`}
          type="datetime-local"
          className="input"
          value={draft.due}
          onChange={(e) => onChange({ due: e.target.value })}
        />
      </div>
      {withStatus ? (
        <div>
          <label className={labelCls} htmlFor={`${idPrefix}_status`}>Status</label>
          <select
            id={`${idPrefix}_status`}
            className="input"
            value={draft.status}
            onChange={(e) => onChange({ status: e.target.value as TaskStatus })}
          >
            {TASK_EDIT_STATUS.map((s) => (
              <option key={s} value={s}>{TASK_STATUS_LABELS[s]}</option>
            ))}
          </select>
        </div>
      ) : null}
      <div>
        <label className={labelCls} htmlFor={`${idPrefix}_profile`}>Zuständige Person</label>
        <select
          id={`${idPrefix}_profile`}
          className="input"
          value={draft.profileId}
          onChange={(e) => onChange({ profileId: e.target.value })}
        >
          <option value="">Keine</option>
          {profiles.map((o) => (
            <option key={o.id} value={o.id}>{o.label}</option>
          ))}
        </select>
      </div>
      <div>
        <label className={labelCls} htmlFor={`${idPrefix}_team`}>Zuständiges Team (informativ)</label>
        <select
          id={`${idPrefix}_team`}
          className="input"
          value={draft.teamId}
          onChange={(e) => onChange({ teamId: e.target.value })}
        >
          <option value="">Keines</option>
          {teams.map((o) => (
            <option key={o.id} value={o.id}>{o.label}</option>
          ))}
        </select>
      </div>
      <div>
        <label className={labelCls} htmlFor={`${idPrefix}_role`}>Zuständige Rolle (informativ)</label>
        <select
          id={`${idPrefix}_role`}
          className="input"
          value={draft.role}
          onChange={(e) => onChange({ role: e.target.value })}
        >
          <option value="">Keine</option>
          {(Object.keys(ROLE_LABELS) as UserRole[]).map((r) => (
            <option key={r} value={r}>{ROLE_LABELS[r]}</option>
          ))}
        </select>
      </div>
    </div>
  );
}

export function TaskList({
  incidentId,
  tasks,
  profiles = [],
  teams = [],
}: {
  incidentId: string;
  tasks: IncidentTask[];
  profiles?: TaskAssigneeOption[];
  teams?: TaskAssigneeOption[];
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newDraft, setNewDraft] = useState<Draft>(emptyDraft());
  const [editId, setEditId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Draft>(emptyDraft());

  const run = async (fn: () => Promise<FormState>, onOk?: () => void) => {
    setBusy(true);
    setError(null);
    setInfo(null);
    const res = await fn();
    setBusy(false);
    if (!res.ok) {
      setError(res.error ?? "Die Aktion ist fehlgeschlagen.");
      return;
    }
    setInfo("Gespeichert.");
    onOk?.();
  };

  const openCount = tasks.filter((t) => isOpenTask(t.status)).length;

  const nameOf = (list: TaskAssigneeOption[], id: string | null) =>
    id ? (list.find((o) => o.id === id)?.label ?? id) : null;

  const assigneeText = (task: IncidentTask): string => {
    const parts: string[] = [];
    const person = nameOf(profiles, task.assignee_profile_id);
    if (person) parts.push(`Person: ${person}`);
    const team = nameOf(teams, task.assignee_team_id);
    if (team) parts.push(`Team: ${team}`);
    if (task.assignee_role) parts.push(`Rolle: ${ROLE_LABELS[task.assignee_role]}`);
    return parts.length ? parts.join(" · ") : "Keine Zuständigkeit hinterlegt";
  };

  const startEdit = (task: IncidentTask) => {
    setEditId(task.id);
    setEditDraft(draftOf(task));
    setError(null);
    setInfo(null);
  };

  const submitNew = () =>
    run(
      () =>
        createIncidentTask({
          incident_id: incidentId,
          title: newDraft.title,
          body: newDraft.body,
          priority: newDraft.priority,
          due_at: fromLocalInput(newDraft.due),
          assignee_profile_id: newDraft.profileId || null,
          assignee_team_id: newDraft.teamId || null,
          assignee_role: (newDraft.role || null) as UserRole | null,
        }),
      () => {
        setCreating(false);
        setNewDraft(emptyDraft());
      },
    );

  const saveEdit = (task: IncidentTask) =>
    run(
      () =>
        updateIncidentTask({
          id: task.id,
          incident_id: incidentId,
          // Abgeleitete Titel pflegt die Datenbank – nur manuelle sind editierbar.
          ...(task.source === "manual" ? { title: editDraft.title } : {}),
          body: editDraft.body,
          priority: editDraft.priority,
          due_at: fromLocalInput(editDraft.due),
          // Quittierte Aufgaben werden über „Wieder öffnen“ geändert.
          ...(task.status === "acknowledged" ? {} : { status: editDraft.status }),
          assignee_profile_id: editDraft.profileId || null,
          assignee_team_id: editDraft.teamId || null,
          assignee_role: (editDraft.role || null) as UserRole | null,
        }),
      () => setEditId(null),
    );

  return (
    <section className="card space-y-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className={sectionH}>Aufgaben</h2>
        <div className="flex items-center gap-2">
          {openCount > 0 ? (
            <Badge tone="warning">{openCount} offen</Badge>
          ) : (
            <span className="text-xs text-muted">Keine offene Aufgabe</span>
          )}
          <button
            type="button"
            className="btn btn-outline px-3 py-1.5"
            onClick={() => {
              setCreating((v) => !v);
              setError(null);
              setInfo(null);
            }}
          >
            {creating ? "Abbrechen" : "+ Aufgabe"}
          </button>
        </div>
      </div>

      {error ? <Notice tone="danger" text={error} /> : null}
      {info && !error ? <Notice tone="muted" text={info} /> : null}

      {creating ? (
        <form
          className="space-y-3 rounded-md border border-border p-3"
          onSubmit={(e) => {
            e.preventDefault();
            void submitNew();
          }}
        >
          <p className="text-sm font-semibold text-foreground">Neue manuelle Aufgabe</p>
          <TaskFields
            draft={newDraft}
            onChange={(patch) => setNewDraft((d) => ({ ...d, ...patch }))}
            profiles={profiles}
            teams={teams}
            idPrefix="task_new"
            withTitle
            withStatus={false}
          />
          <div className="flex justify-end gap-2">
            <button type="button" className="btn btn-outline" onClick={() => setCreating(false)}>
              Abbrechen
            </button>
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? "Speichern…" : "Aufgabe anlegen"}
            </button>
          </div>
        </form>
      ) : null}

      {tasks.length === 0 ? (
        <p className="text-sm text-muted">Keine Aufgaben zu diesem Vorgang.</p>
      ) : (
        <ul className="space-y-2">
          {tasks.map((task) => (
            <li key={task.id} className="rounded-md border border-border p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">{task.title}</span>
                    <Badge tone={TASK_STATUS_TONE[task.status]}>{TASK_STATUS_LABELS[task.status]}</Badge>
                    <Badge tone={TASK_PRIORITY_TONE[task.priority]}>{TASK_PRIORITY_LABELS[task.priority]}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted">
                    {TASK_TYPE_LABELS[task.task_type]} · {TASK_SOURCE_LABELS[task.source]}
                    {task.due_at ? ` · fällig ${fmtDateTime(task.due_at)}` : ""}
                  </p>
                  {task.body ? <p className="mt-1 text-sm text-foreground">{task.body}</p> : null}
                  <p className="mt-1 text-xs text-muted">{assigneeText(task)}</p>
                  {task.status === "acknowledged" ? (
                    <p className="mt-1 text-xs text-muted">Quittiert am {fmtDateTime(task.acknowledged_at)}</p>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {task.status === "acknowledged" ? (
                    <button
                      type="button"
                      className="btn btn-outline px-3 py-1.5"
                      disabled={busy}
                      onClick={() => void run(() => reopenIncidentTask(task.id, incidentId))}
                    >
                      Wieder öffnen
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-outline px-3 py-1.5"
                      disabled={busy}
                      onClick={() => void run(() => acknowledgeIncidentTask(task.id, incidentId))}
                    >
                      Quittieren
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn btn-outline px-3 py-1.5"
                    onClick={() => (editId === task.id ? setEditId(null) : startEdit(task))}
                  >
                    {editId === task.id ? "Schließen" : "Bearbeiten"}
                  </button>
                </div>
              </div>

              {editId === task.id ? (
                <form
                  className="mt-3 space-y-3 border-t border-border pt-3"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void saveEdit(task);
                  }}
                >
                  <TaskFields
                    draft={editDraft}
                    onChange={(patch) => setEditDraft((d) => ({ ...d, ...patch }))}
                    profiles={profiles}
                    teams={teams}
                    idPrefix={`task_${task.id}`}
                    withTitle={task.source === "manual"}
                    withStatus={task.status !== "acknowledged"}
                  />
                  {task.source === "derived" ? (
                    <Notice
                      tone="muted"
                      text="Titel und Aufgabenart abgeleiteter Aufgaben pflegt die Datenbank; entfällt die Ursache, wird die Aufgabe automatisch auf „Entfallen“ gesetzt."
                    />
                  ) : null}
                  {task.status === "acknowledged" ? (
                    <Notice tone="muted" text="Der Status quittierter Aufgaben wird über „Wieder öffnen“ geändert." />
                  ) : null}
                  <div className="flex justify-end gap-2">
                    <button type="button" className="btn btn-outline" onClick={() => setEditId(null)}>
                      Abbrechen
                    </button>
                    <button type="submit" className="btn btn-primary" disabled={busy}>
                      {busy ? "Speichern…" : "Speichern"}
                    </button>
                  </div>
                </form>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// Monteur-Sicht: nur offene Aufgaben, ohne Zuständigkeiten und ohne Aktionen.
export function AssignedTaskList({ tasks }: { tasks: AssignedIncidentTask[] }) {
  return (
    <section className="card space-y-3 p-4">
      <h2 className={sectionH}>Aufgaben</h2>
      {tasks.length === 0 ? (
        <p className="text-sm text-muted">Keine offenen Aufgaben zu diesem Vorgang.</p>
      ) : (
        <ul className="space-y-2">
          {tasks.map((task, index) => (
            <li key={`${task.task_type}-${index}`} className="rounded-md border border-border p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-foreground">{task.title}</span>
                <Badge tone={TASK_STATUS_TONE[task.status]}>{TASK_STATUS_LABELS[task.status]}</Badge>
              </div>
              <p className="mt-1 text-xs text-muted">
                {TASK_TYPE_LABELS[task.task_type]}
                {task.due_at ? ` · fällig ${fmtDateTime(task.due_at)}` : ""}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
