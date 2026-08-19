"use client";

import { useActionState } from "react";
import { addAssignment } from "@/lib/incident-actions";
import type { FormState } from "@/lib/incidents";

// AP13: Die Einzelzuweisung läuft über den kontrollierten RPC-Pfad und kann
// mit 'conflict' antworten (zwischenzeitliche Änderung). Deshalb wird das
// Ergebnis hier sichtbar gemacht, statt es stillschweigend zu verwerfen.

const initial: FormState = { ok: false, error: null };

const field =
  "rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-ring w-full";
const btn = "rounded-md bg-brand px-4 py-2 text-sm font-medium text-brand-fg hover:bg-brand-hover";

export function AssignMonteurForm({
  incidentId,
  monteure,
}: {
  incidentId: string;
  monteure: { id: string; full_name: string | null }[];
}) {
  const [state, action, pending] = useActionState(addAssignment, initial);

  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="id" value={incidentId} />
      <div className="flex flex-wrap items-end gap-2">
        <select name="monteur_id" required className={`${field} max-w-xs`} aria-label="Monteur">
          <option value="">Monteur wählen…</option>
          {monteure.map((m) => (
            <option key={m.id} value={m.id}>{m.full_name ?? "—"}</option>
          ))}
        </select>
        <button type="submit" className={btn} disabled={pending}>
          {pending ? "Zuweisen…" : "Zuweisen"}
        </button>
      </div>
      {state.error ? (
        <p role="alert" className="text-sm text-red-700">{state.error}</p>
      ) : null}
      {state.ok ? <p className="text-xs text-slate-500">Monteur zugewiesen.</p> : null}
    </form>
  );
}
