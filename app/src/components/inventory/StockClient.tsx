"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { Modal } from "@/components/Modal";
import { createMovement } from "@/lib/inventory-actions";
import { MOVEMENT_TYPE_LABELS, type MovementType } from "@/lib/status";
import type { StockRow, MaterialRow, LocationRow } from "@/lib/inventory";
import type { FormState } from "@/lib/incidents";

const field = "rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 w-full";
const label = "mb-1 block text-sm font-medium text-slate-700";
const btn = "rounded-md bg-blue-900 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-60";

const ADMIN_TYPES: MovementType[] = ["wareneingang", "umbuchung", "korrektur", "verlust", "beschaedigung"];

function MovementForm({
  materials,
  locations,
  onSaved,
}: {
  materials: MaterialRow[];
  locations: LocationRow[];
  onSaved: () => void;
}) {
  const [state, action, pending] = useActionState(createMovement, { ok: false, error: null } as FormState);
  const [type, setType] = useState<MovementType>("wareneingang");
  const [dir, setDir] = useState<"in" | "out">("in");
  useEffect(() => {
    if (state.ok) onSaved();
  }, [state.ok, onSaved]);

  const needsTarget = type === "wareneingang" || type === "umbuchung" || (type === "korrektur" && dir === "in");
  const needsSource = type === "umbuchung" || type === "verlust" || type === "beschaedigung" || (type === "korrektur" && dir === "out");

  return (
    <form action={action} className="space-y-3">
      {state.error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</div>
      ) : null}
      <div>
        <label className={label}>Bewegungstyp *</label>
        <select name="movement_type" value={type} onChange={(e) => setType(e.target.value as MovementType)} className={field}>
          {ADMIN_TYPES.map((t) => <option key={t} value={t}>{MOVEMENT_TYPE_LABELS[t]}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className={label}>Material *</label>
          <select name="material_id" required className={field}>
            <option value="">Bitte wählen…</option>
            {materials.map((m) => <option key={m.id} value={m.id}>{m.material_no ? `${m.material_no} – ${m.name}` : m.name}</option>)}
          </select>
        </div>
        <div><label className={label}>Menge *</label><input name="quantity" inputMode="decimal" required className={field} /></div>
      </div>

      {type === "korrektur" ? (
        <div>
          <label className={label}>Korrekturrichtung *</label>
          <select value={dir} onChange={(e) => setDir(e.target.value as "in" | "out")} className={field}>
            <option value="in">Zugang (Bestand erhöhen)</option>
            <option value="out">Abgang (Bestand verringern)</option>
          </select>
        </div>
      ) : null}

      {needsSource ? (
        <div>
          <label className={label}>Quelllager *</label>
          <select name="source_location_id" required className={field}>
            <option value="">Bitte wählen…</option>
            {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </div>
      ) : null}

      {needsTarget ? (
        <div>
          <label className={label}>Ziellager *</label>
          <select name="target_location_id" required className={field}>
            <option value="">Bitte wählen…</option>
            {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </div>
      ) : null}

      <div><label className={label}>Bemerkung</label><input name="note" className={field} /></div>
      <div className="flex justify-end">
        <button type="submit" disabled={pending} className={btn}>{pending ? "Buchen…" : "Buchung speichern"}</button>
      </div>
    </form>
  );
}

export function StockClient({
  stock,
  isAdmin,
  materials,
  locations,
}: {
  stock: StockRow[];
  isAdmin: boolean;
  materials: MaterialRow[];
  locations: LocationRow[];
}) {
  const [q, setQ] = useState("");
  const [loc, setLoc] = useState("");
  const [onlyLow, setOnlyLow] = useState(false);
  const [open, setOpen] = useState(false);

  const locOptions = useMemo(
    () => Array.from(new Map(stock.map((s) => [s.location_id, s.location_name])).entries()),
    [stock],
  );

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return stock
      .filter((s) => (loc ? s.location_id === loc : true))
      .filter((s) => (onlyLow ? s.below_min : true))
      .filter((s) =>
        !needle ? true : [s.material_no, s.material_name, s.location_name].filter(Boolean).join(" ").toLowerCase().includes(needle),
      );
  }, [stock, q, loc, onlyLow]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white p-3">
        <input className={`${field} max-w-xs`} placeholder="Suche…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className={`${field} max-w-[200px]`} value={loc} onChange={(e) => setLoc(e.target.value)}>
          <option value="">Alle Lager</option>
          {locOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        </select>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={onlyLow} onChange={(e) => setOnlyLow(e.target.checked)} />
          Nur unter Mindestbestand
        </label>
        {isAdmin ? (
          <button type="button" onClick={() => setOpen(true)} className={`${btn} ml-auto`}>+ Buchung erfassen</button>
        ) : null}
      </div>

      {/* Desktop */}
      <div className="hidden overflow-x-auto rounded-lg border border-slate-200 bg-white md:block">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2">Material</th><th className="px-3 py-2">Lager</th>
              <th className="px-3 py-2">Istbestand</th><th className="px-3 py-2">Einheit</th><th className="px-3 py-2">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((s) => (
              <tr key={`${s.material_id}-${s.location_id}`} className="hover:bg-slate-50">
                <td className="px-3 py-2 font-medium text-slate-900">{s.material_no ? `${s.material_no} – ${s.material_name}` : s.material_name}</td>
                <td className="px-3 py-2 text-slate-700">{s.location_name}</td>
                <td className="px-3 py-2 text-slate-800">{s.quantity}</td>
                <td className="px-3 py-2 text-slate-600">{s.unit}</td>
                <td className="px-3 py-2">
                  {s.below_min ? (
                    <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-800">Unter Mindestbestand</span>
                  ) : (
                    <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-800">OK</span>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr><td colSpan={5} className="px-3 py-6 text-center text-slate-400">Kein Bestand gefunden.</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {/* Mobile */}
      <div className="space-y-2 md:hidden">
        {rows.map((s) => (
          <div key={`${s.material_id}-${s.location_id}`} className="rounded-lg border border-slate-200 bg-white p-3">
            <div className="flex items-center justify-between">
              <span className="font-medium text-slate-900">{s.material_name}</span>
              {s.below_min ? (
                <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-800">Unter Mind.</span>
              ) : (
                <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-800">OK</span>
              )}
            </div>
            <div className="mt-1 text-sm text-slate-600">{s.location_name}: {s.quantity} {s.unit}</div>
          </div>
        ))}
        {rows.length === 0 ? (
          <div className="rounded-lg border border-slate-200 bg-white p-6 text-center text-slate-400">Kein Bestand gefunden.</div>
        ) : null}
      </div>

      {isAdmin ? (
        <Modal open={open} onClose={() => setOpen(false)} title="Lagerbuchung erfassen">
          <MovementForm materials={materials} locations={locations} onSaved={() => setOpen(false)} />
        </Modal>
      ) : null}
    </div>
  );
}
