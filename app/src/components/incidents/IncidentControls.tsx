import {
  changeStatus,
  updateCondition,
  deactivateAssignment,
  addNote,
} from "@/lib/incident-actions";
import { AssignMonteurForm } from "@/components/incidents/AssignMonteurForm";
import {
  INCIDENT_STATUS,
  MONTEUR_STATUS,
  STATUS_LABELS,
  CONDITION_RATING,
  CONDITION_LABELS,
  TERMINAL_STATUS,
} from "@/lib/status";
import type { IncidentRow } from "@/lib/incidents";
import type { UserRole } from "@/lib/roles";

const field =
  "rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 w-full";
const btn = "rounded-md bg-blue-900 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800";
const cardH = "mb-3 text-sm font-semibold uppercase text-slate-500";

export function IncidentControls({
  incident,
  role,
  monteure,
}: {
  incident: IncidentRow;
  role: UserRole;
  monteure: { id: string; full_name: string | null }[];
}) {
  const isStaff = role !== "monteur";
  const statusOptions = isStaff ? INCIDENT_STATUS : MONTEUR_STATUS;
  const activeAssignments = incident.assignments.filter((a) => a.is_active);

  return (
    <div className="space-y-4">
      {/* Statuswechsel */}
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className={cardH}>Status ändern</h2>
        <form action={changeStatus} className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="id" value={incident.id} />
          <select name="status" defaultValue={incident.status} className={`${field} max-w-xs`}>
            {statusOptions.map((s) => (
              <option key={s} value={s}>{STATUS_LABELS[s]}</option>
            ))}
          </select>
          {isStaff ? (
            <input name="closing_note" placeholder="Abschlussbemerkung (bei Abschluss)" className={`${field} max-w-xs`} />
          ) : null}
          <button type="submit" className={btn}>Übernehmen</button>
        </form>
        {!isStaff ? (
          <p className="mt-2 text-xs text-slate-400">
            Administrative Status ({TERMINAL_STATUS.map((s) => STATUS_LABELS[s]).join(", ")}, „Durch Disposition geprüft“) sind der Disposition vorbehalten.
          </p>
        ) : null}
      </div>

      {/* Zustandsbewertung */}
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className={cardH}>Technische Zustandsbewertung</h2>
        <form action={updateCondition} className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="id" value={incident.id} />
          <select name="condition_rating" defaultValue={incident.condition_rating ?? ""} className={`${field} max-w-xs`}>
            <option value="">— keine —</option>
            {CONDITION_RATING.map((c) => (
              <option key={c} value={c}>{CONDITION_LABELS[c]}</option>
            ))}
          </select>
          <button type="submit" className={btn}>Speichern</button>
        </form>
      </div>

      {/* Monteurzuweisung (nur Disposition/Admin) */}
      {isStaff ? (
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className={cardH}>Monteur zuweisen</h2>
          {activeAssignments.length ? (
            <ul className="mb-3 space-y-1">
              {activeAssignments.map((a) => (
                <li key={a.id} className="flex items-center justify-between text-sm text-slate-700">
                  <span>{a.monteur?.full_name ?? "—"}</span>
                  <form action={deactivateAssignment}>
                    <input type="hidden" name="assignment_id" value={a.id} />
                    <input type="hidden" name="id" value={incident.id} />
                    <button type="submit" className="text-xs text-red-700 hover:underline">entfernen</button>
                  </form>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mb-3 text-sm text-slate-400">Noch kein Monteur zugewiesen.</p>
          )}
          <AssignMonteurForm incidentId={incident.id} monteure={monteure} />
        </div>
      ) : null}

      {/* Notiz */}
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className={cardH}>Notiz hinzufügen</h2>
        <form action={addNote} className="space-y-2">
          <input type="hidden" name="id" value={incident.id} />
          <textarea name="body" rows={2} required placeholder="Feststellung, Maßnahme, Hinweis…" className={field} />
          <button type="submit" className={btn}>Notiz speichern</button>
        </form>
      </div>
    </div>
  );
}
