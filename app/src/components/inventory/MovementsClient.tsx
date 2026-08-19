"use client";

import { useMemo, useState } from "react";
import { MOVEMENT_TYPES, MOVEMENT_TYPE_LABELS, type MovementType } from "@/lib/status";
import type { MovementRow } from "@/lib/inventory";

const field = "rounded-md border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-ring";

function fmt(dt: string): string {
  return new Date(dt).toLocaleString("de-DE", {
    day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit",
  });
}

function uniq<T extends { id: string; label: string }>(arr: T[]): T[] {
  return Array.from(new Map(arr.map((x) => [x.id, x])).values());
}

export function MovementsClient({ movements }: { movements: MovementRow[] }) {
  const [material, setMaterial] = useState("");
  const [loc, setLoc] = useState("");
  const [incident, setIncident] = useState("");
  const [person, setPerson] = useState("");
  const [type, setType] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const materialOpts = useMemo(
    () => uniq(movements.filter((m) => m.material).map((m) => ({ id: m.material!.id, label: m.material!.name }))),
    [movements],
  );
  const locOpts = useMemo(() => {
    const list: { id: string; label: string }[] = [];
    movements.forEach((m) => {
      if (m.source) list.push({ id: m.source.id, label: m.source.name });
      if (m.target) list.push({ id: m.target.id, label: m.target.name });
    });
    return uniq(list);
  }, [movements]);
  const incidentOpts = useMemo(
    () => uniq(movements.filter((m) => m.incident).map((m) => ({ id: m.incident!.id, label: `#${m.incident!.incident_no}` }))),
    [movements],
  );
  const personOpts = useMemo(
    () => uniq(movements.filter((m) => m.created_by).map((m) => ({ id: m.created_by!, label: m.created_by_name }))),
    [movements],
  );

  const rows = useMemo(() => {
    return movements.filter((m) => {
      if (material && m.material?.id !== material) return false;
      if (loc && m.source?.id !== loc && m.target?.id !== loc) return false;
      if (incident && m.incident?.id !== incident) return false;
      if (person && m.created_by !== person) return false;
      if (type && m.movement_type !== type) return false;
      if (from && new Date(m.created_at) < new Date(from)) return false;
      if (to && new Date(m.created_at) > new Date(to + "T23:59:59")) return false;
      return true;
    });
  }, [movements, material, loc, incident, person, type, from, to]);

  const reset = () => { setMaterial(""); setLoc(""); setIncident(""); setPerson(""); setType(""); setFrom(""); setTo(""); };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2 rounded-lg border border-slate-200 bg-white p-3">
        <select className={field} value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">Alle Bewegungstypen</option>
          {MOVEMENT_TYPES.map((t) => <option key={t} value={t}>{MOVEMENT_TYPE_LABELS[t as MovementType]}</option>)}
        </select>
        <select className={field} value={material} onChange={(e) => setMaterial(e.target.value)}>
          <option value="">Alle Materialien</option>
          {materialOpts.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
        <select className={field} value={loc} onChange={(e) => setLoc(e.target.value)}>
          <option value="">Alle Lager</option>
          {locOpts.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
        <select className={field} value={incident} onChange={(e) => setIncident(e.target.value)}>
          <option value="">Alle Vorgänge</option>
          {incidentOpts.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
        <select className={field} value={person} onChange={(e) => setPerson(e.target.value)}>
          <option value="">Alle Personen</option>
          {personOpts.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
        <label className="flex items-center gap-1 text-xs text-slate-500">von <input type="date" className={field} value={from} onChange={(e) => setFrom(e.target.value)} /></label>
        <label className="flex items-center gap-1 text-xs text-slate-500">bis <input type="date" className={field} value={to} onChange={(e) => setTo(e.target.value)} /></label>
        <button type="button" onClick={reset} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100">Zurücksetzen</button>
      </div>

      <div className="text-xs text-slate-500">{rows.length} von {movements.length} Bewegungen</div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2">Zeit</th><th className="px-3 py-2">Typ</th><th className="px-3 py-2">Material</th>
              <th className="px-3 py-2">Menge</th><th className="px-3 py-2">Lager</th><th className="px-3 py-2">Vorgang</th><th className="px-3 py-2">Erfasst von</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((m) => (
              <tr key={m.id} className="hover:bg-slate-50">
                <td className="px-3 py-2 text-slate-500">{fmt(m.created_at)}</td>
                <td className="px-3 py-2 text-slate-700">{MOVEMENT_TYPE_LABELS[m.movement_type]}</td>
                <td className="px-3 py-2 text-slate-800">{m.material?.name ?? "—"}</td>
                <td className="px-3 py-2 text-slate-700">{m.quantity} {m.unit}</td>
                <td className="px-3 py-2 text-slate-600">
                  {m.source?.name ?? "—"}{m.target ? ` → ${m.target.name}` : ""}
                </td>
                <td className="px-3 py-2 text-slate-600">{m.incident ? `#${m.incident.incident_no}` : "—"}</td>
                <td className="px-3 py-2 text-slate-600">{m.created_by_name}</td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr><td colSpan={7} className="px-3 py-6 text-center text-slate-400">Keine Bewegungen gefunden.</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
