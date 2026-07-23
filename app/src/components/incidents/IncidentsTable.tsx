"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { StatusBadge } from "./StatusBadge";
import { PriorityBadge } from "./PriorityBadge";
import { INCIDENT_STATUS, STATUS_LABELS, type IncidentStatus } from "@/lib/status";
import { PRIORITY_LABELS } from "@/lib/priority";
import { buildCsv, CSV_BOM, csvFilename } from "@/lib/csv";
import type { IncidentRow } from "@/lib/incidents";

type Opt = { id: string; label: string };

function fmt(dt: string): string {
  return new Date(dt).toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtCsvDate(dt: string | null): string {
  return dt
    ? new Date(dt).toLocaleString("de-DE", {
        day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
      })
    : "";
}
// Dezimalzahl mit deutschem Komma (für Excel), ohne Trennzeichenkonflikt.
function deNum(n: number | null): string {
  return n === null || n === undefined ? "" : String(n).replace(".", ",");
}

function monteure(row: IncidentRow): string {
  const names = row.assignments.filter((a) => a.is_active).map((a) => a.monteur?.full_name ?? "—");
  return names.length ? names.join(", ") : "—";
}

export function IncidentsTable({
  rows,
  stages,
  monteurOptions,
}: {
  rows: IncidentRow[];
  stages: Opt[];
  monteurOptions: Opt[];
}) {
  const [status, setStatus] = useState("");
  const [stage, setStage] = useState("");
  const [monteur, setMonteur] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (status && r.status !== status) return false;
      if (stage && r.construction_stage_id !== stage) return false;
      if (monteur && !r.assignments.some((a) => a.is_active && a.monteur_id === monteur)) return false;
      if (from && new Date(r.created_at) < new Date(from)) return false;
      if (to && new Date(r.created_at) > new Date(to + "T23:59:59")) return false;
      if (needle) {
        const hay = [
          String(r.incident_no),
          r.vzg_line_number,
          r.operating_point,
          r.object_designation,
          r.object_type,
          r.description,
          r.caller_name,
          r.stage?.name,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [rows, status, stage, monteur, from, to, q]);

  const reset = () => {
    setStatus(""); setStage(""); setMonteur(""); setFrom(""); setTo(""); setQ("");
  };

  // CSV-Export der AKTUELL gefilterten Vorgänge (nicht der gesamten Liste).
  // RLS gilt bereits serverseitig (die Rohliste ist rollengefiltert geladen).
  const exportCsv = () => {
    const headers = [
      "Vorgangsnummer", "Status", "Priorität", "Baustufe", "Bereitschaftsnummer",
      "VzG-Streckennummer", "Kilometer von", "Kilometer bis", "Betriebsstelle", "Gleis",
      "Richtung", "Objektart", "Objektbezeichnung", "Beschreibung", "Zugewiesener Monteur",
      "DB-Ansprechpartner", "Telefonnummer", "Erstellt am", "Technisch abgeschlossen am",
      "Administrativ abgeschlossen am", "Letzte Änderung",
    ];
    const data = filtered.map((r) => {
      const m = monteure(r);
      return [
        r.incident_no,
        STATUS_LABELS[r.status],
        PRIORITY_LABELS[r.priority],
        r.stage?.name ?? "",
        r.oncall ? (r.oncall.label ? `${r.oncall.number} – ${r.oncall.label}` : r.oncall.number) : "",
        r.vzg_line_number,
        deNum(r.km_from),
        deNum(r.km_to),
        r.operating_point ?? "",
        r.track ?? "",
        r.direction ?? "",
        r.object_type ?? "",
        r.object_designation ?? "",
        r.description ?? "",
        m === "—" ? "" : m,
        r.caller_name ?? "",
        r.caller_contact ?? "",
        fmtCsvDate(r.created_at),
        fmtCsvDate(r.technisch_abgeschlossen_at),
        fmtCsvDate(r.closed_at),
        fmtCsvDate(r.updated_at),
      ];
    });
    const content = CSV_BOM + buildCsv(headers, data);
    const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = csvFilename();
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const inputCls =
    "rounded-md border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-blue-500";

  return (
    <div className="space-y-3">
      {/* Filterleiste */}
      <div className="flex flex-wrap items-end gap-2 rounded-lg border border-slate-200 bg-white p-3">
        <input
          className={`${inputCls} min-w-[180px] flex-1`}
          placeholder="Volltextsuche…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select className={inputCls} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Alle Status</option>
          {INCIDENT_STATUS.map((s) => (
            <option key={s} value={s}>{STATUS_LABELS[s]}</option>
          ))}
        </select>
        <select className={inputCls} value={stage} onChange={(e) => setStage(e.target.value)}>
          <option value="">Alle Baustufen</option>
          {stages.map((s) => (
            <option key={s.id} value={s.id}>{s.label}</option>
          ))}
        </select>
        <select className={inputCls} value={monteur} onChange={(e) => setMonteur(e.target.value)}>
          <option value="">Alle Monteure</option>
          {monteurOptions.map((m) => (
            <option key={m.id} value={m.id}>{m.label}</option>
          ))}
        </select>
        <label className="flex items-center gap-1 text-xs text-slate-500">
          von <input type="date" className={inputCls} value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="flex items-center gap-1 text-xs text-slate-500">
          bis <input type="date" className={inputCls} value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
        <button type="button" onClick={reset} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100">
          Zurücksetzen
        </button>
        <button
          type="button"
          onClick={exportCsv}
          disabled={filtered.length === 0}
          className="rounded-md bg-emerald-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
          title="Exportiert die aktuell gefilterten Vorgänge als CSV (UTF-8, Semikolon)"
        >
          CSV-Export
        </button>
      </div>

      <div className="text-xs text-slate-500">
        {filtered.length} von {rows.length} Vorgängen · CSV-Export berücksichtigt die aktuelle Filterung
      </div>

      {/* Desktop-Tabelle */}
      <div className="hidden overflow-x-auto rounded-lg border border-slate-200 bg-white md:block">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2">Nummer</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Baustufe</th>
              <th className="px-3 py-2">Monteur</th>
              <th className="px-3 py-2">Priorität</th>
              <th className="px-3 py-2">Letzte Änderung</th>
              <th className="px-3 py-2">Aktionen</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((r) => (
              <tr key={r.id} className="hover:bg-slate-50">
                <td className="px-3 py-2 font-medium text-slate-900">#{r.incident_no}</td>
                <td className="px-3 py-2"><StatusBadge status={r.status as IncidentStatus} /></td>
                <td className="px-3 py-2 text-slate-700">{r.stage?.name ?? "—"}</td>
                <td className="px-3 py-2 text-slate-700">{monteure(r)}</td>
                <td className="px-3 py-2"><PriorityBadge priority={r.priority} /></td>
                <td className="px-3 py-2 text-slate-500">{fmt(r.updated_at)}</td>
                <td className="px-3 py-2">
                  <Link href={`/vorgaenge/${r.id}`} className="font-medium text-blue-800 hover:underline">Öffnen</Link>
                </td>
              </tr>
            ))}
            {filtered.length === 0 ? (
              <tr><td colSpan={7} className="px-3 py-6 text-center text-slate-400">Keine Vorgänge gefunden.</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {/* Mobile-Karten */}
      <div className="space-y-2 md:hidden">
        {filtered.map((r) => (
          <Link
            key={r.id}
            href={`/vorgaenge/${r.id}`}
            className="block rounded-lg border border-slate-200 bg-white p-3 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-900">#{r.incident_no}</span>
              <PriorityBadge priority={r.priority} />
            </div>
            <div className="mt-1"><StatusBadge status={r.status as IncidentStatus} /></div>
            <div className="mt-2 text-sm text-slate-600">
              {r.customer?.name ? `${r.customer.name} · ` : ""}
              {r.stage?.name ?? "—"} · VzG {r.vzgline?.line_number ?? r.vzg_line_number ?? "—"}
              {r.km_from != null ? ` · km ${r.km_from}` : ""}
            </div>
            <div className="text-xs text-slate-500">Monteur: {monteure(r)} · {fmt(r.updated_at)}</div>
          </Link>
        ))}
        {filtered.length === 0 ? (
          <div className="rounded-lg border border-slate-200 bg-white p-6 text-center text-slate-400">
            Keine Vorgänge gefunden.
          </div>
        ) : null}
      </div>
    </div>
  );
}

