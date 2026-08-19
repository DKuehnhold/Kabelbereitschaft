"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { Modal } from "@/components/Modal";
import { saveLocation, setLocationActive } from "@/lib/inventory-actions";
import { STORAGE_LOCATION_TYPES, STORAGE_LOCATION_TYPE_LABELS } from "@/lib/status";
import type { LocationRow } from "@/lib/inventory";
import type { FormState } from "@/lib/incidents";

const field = "rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-ring w-full";
const label = "mb-1 block text-sm font-medium text-slate-700";
const btn = "rounded-md bg-brand px-4 py-2 text-sm font-medium text-brand-fg hover:bg-brand-hover disabled:opacity-60";

function LocationForm({ location, onSaved }: { location: LocationRow | null; onSaved: () => void }) {
  const [state, action, pending] = useActionState(saveLocation, { ok: false, error: null } as FormState);
  useEffect(() => {
    if (state.ok) onSaved();
  }, [state.ok, onSaved]);

  return (
    <form action={action} className="space-y-3">
      {location ? <input type="hidden" name="id" value={location.id} /> : null}
      {state.error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</div>
      ) : null}
      <div><label className={label}>Lagername *</label><input name="name" required defaultValue={location?.name ?? ""} className={field} /></div>
      <div>
        <label className={label}>Lagerorttyp *</label>
        <select name="location_type" required defaultValue={location?.location_type ?? ""} className={field}>
          <option value="">Bitte wählen…</option>
          {STORAGE_LOCATION_TYPES.map((t) => <option key={t} value={t}>{STORAGE_LOCATION_TYPE_LABELS[t]}</option>)}
        </select>
      </div>
      <div>
        <label className={label}>Status</label>
        <select name="is_active" defaultValue={location ? String(location.is_active) : "true"} className={field}>
          <option value="true">Aktiv</option>
          <option value="false">Inaktiv</option>
        </select>
      </div>
      <div><label className={label}>Beschreibung</label><textarea name="note" rows={2} defaultValue={location?.note ?? ""} className={field} /></div>
      <div className="flex justify-end">
        <button type="submit" disabled={pending} className={btn}>{pending ? "Speichern…" : "Speichern"}</button>
      </div>
    </form>
  );
}

export function LocationsClient({ locations }: { locations: LocationRow[] }) {
  const [q, setQ] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<LocationRow | null>(null);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return locations
      .filter((l) => (showInactive ? true : l.is_active))
      .filter((l) => (!needle ? true : l.name.toLowerCase().includes(needle)))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [locations, q, showInactive]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white p-3">
        <input className={`${field} max-w-xs`} placeholder="Suche…" value={q} onChange={(e) => setQ(e.target.value)} />
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
          Inaktive anzeigen
        </label>
        <button type="button" onClick={() => { setEdit(null); setOpen(true); }} className={`${btn} ml-auto`}>+ Neuer Lagerort</button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2">Lagername</th><th className="px-3 py-2">Typ</th>
              <th className="px-3 py-2">Beschreibung</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Aktionen</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((l) => (
              <tr key={l.id} className="hover:bg-slate-50">
                <td className="px-3 py-2 font-medium text-slate-900">{l.name}</td>
                <td className="px-3 py-2 text-slate-600">{STORAGE_LOCATION_TYPE_LABELS[l.location_type]}</td>
                <td className="px-3 py-2 text-slate-600">{l.note ?? "—"}</td>
                <td className="px-3 py-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs ${l.is_active ? "bg-green-100 text-green-800" : "bg-slate-200 text-slate-600"}`}>
                    {l.is_active ? "Aktiv" : "Inaktiv"}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-3">
                    <button type="button" onClick={() => { setEdit(l); setOpen(true); }} className="text-brand hover:underline">Bearbeiten</button>
                    <form action={setLocationActive}>
                      <input type="hidden" name="id" value={l.id} />
                      <input type="hidden" name="active" value={l.is_active ? "false" : "true"} />
                      <button type="submit" className="text-slate-500 hover:underline">{l.is_active ? "Deaktivieren" : "Aktivieren"}</button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr><td colSpan={5} className="px-3 py-6 text-center text-slate-400">Keine Lagerorte.</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title={edit ? "Lagerort bearbeiten" : "Neuer Lagerort"}>
        <LocationForm location={edit} onSaved={() => setOpen(false)} />
      </Modal>
    </div>
  );
}
