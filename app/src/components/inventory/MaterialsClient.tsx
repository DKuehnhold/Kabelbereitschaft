"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { Modal } from "@/components/Modal";
import { saveMaterial, setMaterialActive } from "@/lib/inventory-actions";
import type { MaterialRow } from "@/lib/inventory";
import type { FormState } from "@/lib/incidents";

const field = "rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 w-full";
const label = "mb-1 block text-sm font-medium text-slate-700";
const btn = "rounded-md bg-blue-900 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-60";

function MaterialForm({ material, onSaved }: { material: MaterialRow | null; onSaved: () => void }) {
  const [state, action, pending] = useActionState(saveMaterial, { ok: false, error: null } as FormState);
  useEffect(() => {
    if (state.ok) onSaved();
  }, [state.ok, onSaved]);

  return (
    <form action={action} className="space-y-3">
      {material ? <input type="hidden" name="id" value={material.id} /> : null}
      {state.error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</div>
      ) : null}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div><label className={label}>Materialnummer</label><input name="material_no" defaultValue={material?.material_no ?? ""} className={field} /></div>
        <div><label className={label}>Bezeichnung *</label><input name="name" required defaultValue={material?.name ?? ""} className={field} /></div>
        <div><label className={label}>Einheit</label><input name="unit" defaultValue={material?.unit ?? "Stk"} className={field} /></div>
        <div><label className={label}>Kategorie</label><input name="category" defaultValue={material?.category ?? ""} className={field} /></div>
        <div><label className={label}>Mindestbestand</label><input name="min_stock" inputMode="decimal" defaultValue={material?.min_stock != null ? String(material.min_stock) : ""} className={field} /></div>
        <div>
          <label className={label}>Status</label>
          <select name="is_active" defaultValue={material ? String(material.is_active) : "true"} className={field}>
            <option value="true">Aktiv</option>
            <option value="false">Inaktiv</option>
          </select>
        </div>
      </div>
      <div><label className={label}>Kurzbeschreibung</label><textarea name="note" rows={2} defaultValue={material?.note ?? ""} className={field} /></div>
      <div className="flex justify-end gap-2">
        <button type="submit" disabled={pending} className={btn}>{pending ? "Speichern…" : "Speichern"}</button>
      </div>
    </form>
  );
}

export function MaterialsClient({ materials }: { materials: MaterialRow[] }) {
  const [q, setQ] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [sortBy, setSortBy] = useState<"name" | "material_no" | "category">("name");
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<MaterialRow | null>(null);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return materials
      .filter((m) => (showInactive ? true : m.is_active))
      .filter((m) =>
        !needle
          ? true
          : [m.material_no, m.name, m.category].filter(Boolean).join(" ").toLowerCase().includes(needle),
      )
      .sort((a, b) => String(a[sortBy] ?? "").localeCompare(String(b[sortBy] ?? "")));
  }, [materials, q, showInactive, sortBy]);

  const openNew = () => { setEdit(null); setOpen(true); };
  const openEdit = (m: MaterialRow) => { setEdit(m); setOpen(true); };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white p-3">
        <input className={`${field} max-w-xs`} placeholder="Suche…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className={`${field} max-w-[180px]`} value={sortBy} onChange={(e) => setSortBy(e.target.value as typeof sortBy)}>
          <option value="name">Sortierung: Bezeichnung</option>
          <option value="material_no">Sortierung: Materialnummer</option>
          <option value="category">Sortierung: Kategorie</option>
        </select>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
          Inaktive anzeigen
        </label>
        <button type="button" onClick={openNew} className={`${btn} ml-auto`}>+ Neues Material</button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2">Nr.</th><th className="px-3 py-2">Bezeichnung</th>
              <th className="px-3 py-2">Kategorie</th><th className="px-3 py-2">Einheit</th>
              <th className="px-3 py-2">Mind.</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Aktionen</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((m) => (
              <tr key={m.id} className="hover:bg-slate-50">
                <td className="px-3 py-2 text-slate-700">{m.material_no ?? "—"}</td>
                <td className="px-3 py-2 font-medium text-slate-900">{m.name}</td>
                <td className="px-3 py-2 text-slate-600">{m.category ?? "—"}</td>
                <td className="px-3 py-2 text-slate-600">{m.unit}</td>
                <td className="px-3 py-2 text-slate-600">{m.min_stock ?? "—"}</td>
                <td className="px-3 py-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs ${m.is_active ? "bg-green-100 text-green-800" : "bg-slate-200 text-slate-600"}`}>
                    {m.is_active ? "Aktiv" : "Inaktiv"}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-3">
                    <button type="button" onClick={() => openEdit(m)} className="text-blue-800 hover:underline">Bearbeiten</button>
                    <form action={setMaterialActive}>
                      <input type="hidden" name="id" value={m.id} />
                      <input type="hidden" name="active" value={m.is_active ? "false" : "true"} />
                      <button type="submit" className="text-slate-500 hover:underline">{m.is_active ? "Deaktivieren" : "Aktivieren"}</button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr><td colSpan={7} className="px-3 py-6 text-center text-slate-400">Keine Materialien.</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title={edit ? "Material bearbeiten" : "Neues Material"}>
        <MaterialForm material={edit} onSaved={() => setOpen(false)} />
      </Modal>
    </div>
  );
}
