"use client";

import { useActionState, useState } from "react";
import { takeoutMaterial, returnMaterial, consumeMaterial } from "@/lib/inventory-actions";
import type { MaterialRow, LocationRow } from "@/lib/inventory";
import type { FormState } from "@/lib/incidents";

type Mode = "entnahme" | "rueckgabe" | "verbrauch";

const ACTIONS = { entnahme: takeoutMaterial, rueckgabe: returnMaterial, verbrauch: consumeMaterial };
const LOC_FIELD: Record<Mode, string> = {
  entnahme: "source_location_id",
  rueckgabe: "target_location_id",
  verbrauch: "source_location_id",
};
const LABELS: Record<Mode, string> = { entnahme: "Entnahme", rueckgabe: "Rückgabe", verbrauch: "Verbrauch" };
const LOC_LABEL: Record<Mode, string> = { entnahme: "Quelllager", rueckgabe: "Ziellager", verbrauch: "Quelllager" };

const field = "rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-ring w-full";
const label = "mb-1 block text-sm font-medium text-slate-700";
const btn = "rounded-md bg-brand px-4 py-2 text-sm font-medium text-brand-fg hover:bg-brand-hover disabled:opacity-60";

function ActionForm({
  mode,
  incidentId,
  materials,
  locations,
}: {
  mode: Mode;
  incidentId: string;
  materials: MaterialRow[];
  locations: LocationRow[];
}) {
  const [state, action, pending] = useActionState(ACTIONS[mode], { ok: false, error: null } as FormState);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="incident_id" value={incidentId} />
      {state.error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</div>
      ) : null}
      {state.ok ? (
        <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
          {LABELS[mode]} gebucht.
        </div>
      ) : null}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className={label}>Material *</label>
          <select name="material_id" required className={field}>
            <option value="">Bitte wählen…</option>
            {materials.map((m) => <option key={m.id} value={m.id}>{m.material_no ? `${m.material_no} – ${m.name}` : m.name}</option>)}
          </select>
        </div>
        <div>
          <label className={label}>{LOC_LABEL[mode]} *</label>
          <select name={LOC_FIELD[mode]} required className={field}>
            <option value="">Bitte wählen…</option>
            {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </div>
        <div><label className={label}>Menge *</label><input name="quantity" inputMode="decimal" required className={field} /></div>
        <div><label className={label}>Bemerkung</label><input name="note" className={field} /></div>
      </div>
      <div className="flex justify-end">
        <button type="submit" disabled={pending} className={btn}>{pending ? "Buchen…" : `${LABELS[mode]} buchen`}</button>
      </div>
    </form>
  );
}

export function MonteurMaterialActions({
  incidentId,
  materials,
  locations,
}: {
  incidentId: string;
  materials: MaterialRow[];
  locations: LocationRow[];
}) {
  const [tab, setTab] = useState<Mode>("entnahme");
  const tabs: Mode[] = ["entnahme", "rueckgabe", "verbrauch"];
  return (
    <div className="space-y-3">
      <div className="flex gap-1 rounded-md bg-slate-100 p-1 text-sm">
        {tabs.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`flex-1 rounded px-3 py-1.5 font-medium ${tab === t ? "bg-white text-brand shadow" : "text-slate-600"}`}
          >
            {LABELS[t]}
          </button>
        ))}
      </div>
      <ActionForm key={tab} mode={tab} incidentId={incidentId} materials={materials} locations={locations} />
    </div>
  );
}
