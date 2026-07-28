"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { StatusBadge } from "@/components/incidents/StatusBadge";
import { PriorityBadge } from "@/components/incidents/PriorityBadge";
import { Badge } from "@/components/ui/primitives";
import { INCIDENT_STATUS, STATUS_LABELS, type IncidentStatus } from "@/lib/status";
import { PRIORITIES, PRIORITY_LABELS } from "@/lib/priority";
import {
  BULK_CODE_LABELS,
  INCIDENT_BULK_LIMIT,
  INCIDENT_PAGE_SIZES,
  mergeCableArts,
  type IncidentBulkResult,
  type IncidentListFilters,
  type IncidentListQuery,
  type IncidentListRow,
  type IncidentListSortField,
  type IncidentListFilterOptions,
} from "@/lib/incident-list";
import { buildIncidentListQueryString } from "@/lib/incident-list-url";
import {
  bulkAssignIncidentMonteur,
  bulkUpdateIncidentStatus,
  exportIncidentList,
} from "@/lib/incident-list-actions";
import { buildCsv, CSV_BOM, csvFilename } from "@/lib/csv";

function fmt(dt: string): string {
  return new Date(dt).toLocaleString("de-DE", {
    day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit",
  });
}
function km(row: IncidentListRow): string {
  return row.km_from != null ? `${row.km_from}${row.km_to != null ? "–" + row.km_to : ""}` : "—";
}
function vzg(row: IncidentListRow): string {
  return row.vzg_line_ref ?? row.vzg_line_number ?? "—";
}
function monteure(row: IncidentListRow): string {
  const n = row.monteur_names;
  if (n.length === 0) return "Nicht zugewiesen";
  if (n.length <= 2) return n.join(", ");
  return `${n[0]}, ${n[1]} +${n.length - 2}`;
}
function downloadCsv(content: string, prefix: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = csvFilename(prefix);
  a.click();
  URL.revokeObjectURL(url);
}

const SORTABLE: { field: IncidentListSortField; label: string }[] = [
  { field: "incident_no", label: "Nr." },
  { field: "status", label: "Status" },
  { field: "priority", label: "Priorität" },
  { field: "customer", label: "Kunde" },
  { field: "construction_stage", label: "Bauabschnitt" },
  { field: "created_at", label: "Erstellt" },
  { field: "updated_at", label: "Geändert" },
];

export function OperationalList({
  rows, total, page, pageSize, query, options, isStaff = true,
}: {
  rows: IncidentListRow[];
  total: number;
  page: number;
  pageSize: number;
  query: IncidentListQuery;
  options: IncidentListFilterOptions;
  // Massenaktionen sind ausschließlich für Disposition/Administration.
  isStaff?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const [advanced, setAdvanced] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [exporting, setExporting] = useState(false);
  const [exportMsg, setExportMsg] = useState<string | null>(null);
  // AP13: Massenaktionen
  const [bulkStatus, setBulkStatus] = useState<string>("");
  const [bulkMonteur, setBulkMonteur] = useState<string>("");
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkMsg, setBulkMsg] = useState<string | null>(null);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [bulkFailed, setBulkFailed] = useState<{ id: string; code: string }[]>([]);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const navigate = (q: IncidentListQuery) => {
    setSelected(new Set()); // Auswahl bei jeder Zustandsänderung zurücksetzen
    setBulkMsg(null);
    setBulkError(null);
    setBulkFailed([]);
    const qs = buildIncidentListQueryString(q);
    startTransition(() => router.push(qs ? `${pathname}?${qs}` : pathname));
  };
  const updateFilters = (patch: Partial<IncidentListFilters>) =>
    navigate({ ...query, filters: { ...query.filters, ...patch }, page: 1 });
  const resetAll = () => navigate({ filters: {}, sort: [], page: 1, pageSize: query.pageSize });

  // Suche (debounced, uncontrolled – vermeidet setState im Effect)
  const onSearchChange = (val: string) => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      const next = val.trim() || undefined;
      if (next !== (query.filters.q || undefined)) updateFilters({ q: next });
    }, 400);
  };

  const toggleSort = (field: IncidentListSortField) => {
    const cur = query.sort.find((s) => s.field === field);
    let sort = query.sort.slice();
    if (!cur) sort.push({ field, dir: "asc" });
    else if (cur.dir === "asc") sort = sort.map((s) => (s.field === field ? { ...s, dir: "desc" } : s));
    else sort = sort.filter((s) => s.field !== field);
    navigate({ ...query, sort, page: 1 });
  };
  const sortInfo = (field: IncidentListSortField) => {
    const idx = query.sort.findIndex((s) => s.field === field);
    return idx < 0 ? null : { pos: idx + 1, dir: query.sort[idx].dir };
  };

  const toggleRow = (id: string) =>
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  const allOnPage = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const toggleAllOnPage = () =>
    setSelected((prev) => {
      const n = new Set(prev);
      if (allOnPage) rows.forEach((r) => n.delete(r.id));
      else rows.forEach((r) => n.add(r.id));
      return n;
    });

  const vzgOptions = useMemo(
    () => options.vzgLines.filter((v) => !query.filters.stage_id || v.construction_stage_id === query.filters.stage_id),
    [options.vzgLines, query.filters.stage_id],
  );

  // Aktive Filter als Chips
  const chips: { key: string; label: string; clear: () => void }[] = [];
  const f = query.filters;
  const nameOf = (list: { id: string; label: string }[], id?: string) => list.find((o) => o.id === id)?.label ?? id ?? "";
  if (f.q) chips.push({ key: "q", label: `Suche: ${f.q}`, clear: () => updateFilters({ q: undefined }) });
  if (f.status) chips.push({ key: "status", label: `Status: ${STATUS_LABELS[f.status]}`, clear: () => updateFilters({ status: undefined }) });
  if (f.priority) chips.push({ key: "priority", label: `Priorität: ${PRIORITY_LABELS[f.priority]}`, clear: () => updateFilters({ priority: undefined }) });
  if (f.activity && f.activity !== "all") chips.push({ key: "activity", label: `Aktivität: ${f.activity === "active" ? "Aktiv" : "Abgeschlossen"}`, clear: () => updateFilters({ activity: undefined }) });
  if (f.images && f.images !== "all") chips.push({ key: "images", label: f.images === "with" ? "Mit Bildern" : "Ohne Bilder", clear: () => updateFilters({ images: undefined }) });
  if (f.hasOpenTask) chips.push({ key: "task", label: "Hat offene Aufgabe", clear: () => updateFilters({ hasOpenTask: undefined }) });
  if (f.customer_id) chips.push({ key: "customer", label: `Kunde: ${nameOf(options.customers, f.customer_id)}`, clear: () => updateFilters({ customer_id: undefined }) });
  if (f.stage_id) chips.push({ key: "stage", label: `Bauabschnitt: ${nameOf(options.stages, f.stage_id)}`, clear: () => updateFilters({ stage_id: undefined, vzg_line_id: undefined }) });
  if (f.vzg_line_id) chips.push({ key: "vzg", label: `VzG: ${nameOf(options.vzgLines, f.vzg_line_id)}`, clear: () => updateFilters({ vzg_line_id: undefined }) });
  if (f.on_call_number_id) chips.push({ key: "oncall", label: `Bereitschaft: ${nameOf(options.onCall, f.on_call_number_id)}`, clear: () => updateFilters({ on_call_number_id: undefined }) });
  if (f.monteur_id) chips.push({ key: "monteur", label: `Monteur: ${nameOf(options.monteure, f.monteur_id)}`, clear: () => updateFilters({ monteur_id: undefined }) });
  if (f.created_by) chips.push({ key: "creator", label: `Erstellt von: ${nameOf(options.creators, f.created_by)}`, clear: () => updateFilters({ created_by: undefined }) });
  if (f.date_from) chips.push({ key: "from", label: `ab ${f.date_from}`, clear: () => updateFilters({ date_from: undefined }) });
  if (f.date_to) chips.push({ key: "to", label: `bis ${f.date_to}`, clear: () => updateFilters({ date_to: undefined }) });

  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const toRow = Math.min(page * pageSize, total);
  const lastPage = Math.max(1, Math.ceil(total / pageSize));

  const doExport = async () => {
    setExporting(true);
    setExportMsg(null);
    const res = await exportIncidentList(query);
    if (res.error) setExportMsg(res.error);
    else {
      downloadCsv(res.csv, "vorgaenge");
      setExportMsg(res.capped ? `Export auf ${res.count} Datensätze begrenzt.` : `${res.count} Datensätze exportiert.`);
    }
    setExporting(false);
  };
  const exportSelection = () => {
    const sel = rows.filter((r) => selected.has(r.id));
    if (sel.length === 0) return;
    const headers = ["Vorgangsnummer", "Status", "Priorität", "Kunde", "Bauabschnitt", "VzG", "Kabelarten", "Monteure", "Bilder", "Offene Aufgabe"];
    const data = sel.map((r) => [
      r.incident_no, STATUS_LABELS[r.status], PRIORITY_LABELS[r.priority], r.customer_name ?? "",
      r.stage_code ? `${r.stage_code} – ${r.stage_name ?? ""}` : (r.stage_name ?? ""), vzg(r),
      mergeCableArts(r.cable_arts).map((g) => (g.count > 1 ? `${g.name} ×${g.count}` : g.name)).join(", "),
      r.monteur_names.join(", ") || "Nicht zugewiesen", r.image_count, r.has_open_task ? "Ja" : "Nein",
    ]);
    downloadCsv(CSV_BOM + buildCsv(headers, data), "vorgaenge_auswahl");
  };

  // ---------- AP13: Massenaktionen ----------
  // Die Auswahl bezieht sich immer auf die aktuell angezeigte Seite; jede
  // Zustandsänderung setzt sie zurück. Konfliktbasis je Eintrag ist
  // updated_at (und bei der Zuweisung die aktuell geladenen monteur_ids).
  const selectedRows = rows.filter((r) => selected.has(r.id));
  const nrOf = (id: string) => rows.find((r) => r.id === id)?.incident_no ?? null;

  const resetBulk = () => {
    setBulkMsg(null);
    setBulkError(null);
    setBulkFailed([]);
  };

  const applyBulkResult = (res: IncidentBulkResult, count: number) => {
    if (res.error) {
      setBulkError(res.error);
      setBulkFailed([]);
      return;
    }
    setBulkMsg(`${res.ok} von ${count} geändert, ${res.failed.length} abgelehnt.`);
    setBulkFailed(res.failed);
    if (res.ok > 0) {
      setSelected(new Set());
      startTransition(() => router.refresh());
    }
  };

  const runBulkStatus = async () => {
    if (!isStaff || selectedRows.length === 0 || !bulkStatus) return;
    if (selectedRows.length > INCIDENT_BULK_LIMIT) {
      setBulkError(`Massenaktionen sind auf ${INCIDENT_BULK_LIMIT} Vorgänge begrenzt (ausgewählt: ${selectedRows.length}).`);
      return;
    }
    setBulkBusy(true);
    resetBulk();
    const items = selectedRows.map((r) => ({ id: r.id, expected_updated_at: r.updated_at }));
    const res = await bulkUpdateIncidentStatus(items, bulkStatus as IncidentStatus);
    setBulkBusy(false);
    applyBulkResult(res, items.length);
  };

  const runBulkAssign = async () => {
    if (!isStaff || selectedRows.length === 0 || !bulkMonteur) return;
    if (selectedRows.length > INCIDENT_BULK_LIMIT) {
      setBulkError(`Massenaktionen sind auf ${INCIDENT_BULK_LIMIT} Vorgänge begrenzt (ausgewählt: ${selectedRows.length}).`);
      return;
    }
    setBulkBusy(true);
    resetBulk();
    const items = selectedRows.map((r) => ({
      id: r.id,
      expected_updated_at: r.updated_at,
      expected_monteur_ids: r.monteur_ids.slice().sort(),
    }));
    const res = await bulkAssignIncidentMonteur(items, bulkMonteur);
    setBulkBusy(false);
    applyBulkResult(res, items.length);
  };

  const inputCls = "input max-w-[220px]";

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="card space-y-3 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <input
            key={query.filters.q ?? "__q"}
            className="input max-w-xs" placeholder="Suche (Nr., Kunde, Bauabschnitt, VzG, Ort, Beschreibung …)"
            defaultValue={query.filters.q ?? ""} onChange={(e) => onSearchChange(e.target.value)} aria-label="Suche"
          />
          <Segmented
            label="Aktivität" value={f.activity ?? "all"}
            options={[["all", "Alle"], ["active", "Aktiv"], ["closed", "Abgeschlossen"]]}
            onChange={(v) => updateFilters({ activity: v === "all" ? undefined : (v as IncidentListFilters["activity"]) })}
          />
          <Segmented
            label="Bilder" value={f.images ?? "all"}
            options={[["all", "Alle"], ["with", "Mit"], ["without", "Ohne"]]}
            onChange={(v) => updateFilters({ images: v === "all" ? undefined : (v as IncidentListFilters["images"]) })}
          />
          <Segmented
            label="Aufgaben" value={f.hasOpenTask ? "open" : "all"}
            options={[["all", "Alle"], ["open", "Nur mit offener Aufgabe"]]}
            onChange={(v) => updateFilters({ hasOpenTask: v === "open" ? true : undefined })}
          />
          <button type="button" className="btn btn-outline" onClick={() => setAdvanced((v) => !v)}>
            {advanced ? "Weitere Filter ausblenden" : "Weitere Filter"}
          </button>
          <div className="ml-auto flex items-center gap-2">
            {pending ? <span className="text-xs text-muted">Lädt…</span> : null}
            <button type="button" className="btn btn-outline" onClick={doExport} disabled={exporting}>
              {exporting ? "Export…" : "CSV-Export (gefiltert)"}
            </button>
          </div>
        </div>

        {advanced ? (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <select className={inputCls} value={f.status ?? ""} onChange={(e) => updateFilters({ status: (e.target.value || undefined) as IncidentListFilters["status"] })} aria-label="Status">
              <option value="">Status: alle</option>
              {INCIDENT_STATUS.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
            </select>
            <select className={inputCls} value={f.priority ?? ""} onChange={(e) => updateFilters({ priority: (e.target.value || undefined) as IncidentListFilters["priority"] })} aria-label="Priorität">
              <option value="">Priorität: alle</option>
              {PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>)}
            </select>
            <select className={inputCls} value={f.customer_id ?? ""} onChange={(e) => updateFilters({ customer_id: e.target.value || undefined })} aria-label="Kunde">
              <option value="">Kunde: alle</option>
              {options.customers.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
            <select className={inputCls} value={f.stage_id ?? ""} onChange={(e) => updateFilters({ stage_id: e.target.value || undefined, vzg_line_id: undefined })} aria-label="Bauabschnitt">
              <option value="">Bauabschnitt: alle</option>
              {options.stages.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
            <select className={inputCls} value={f.vzg_line_id ?? ""} onChange={(e) => updateFilters({ vzg_line_id: e.target.value || undefined })} aria-label="VzG-Strecke">
              <option value="">VzG: alle</option>
              {vzgOptions.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
            <select className={inputCls} value={f.on_call_number_id ?? ""} onChange={(e) => updateFilters({ on_call_number_id: e.target.value || undefined })} aria-label="Bereitschaftsnummer">
              <option value="">Bereitschaft: alle</option>
              {options.onCall.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
            <select className={inputCls} value={f.monteur_id ?? ""} onChange={(e) => updateFilters({ monteur_id: e.target.value || undefined })} aria-label="Monteur">
              <option value="">Monteur: alle</option>
              {options.monteure.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
            <select className={inputCls} value={f.created_by ?? ""} onChange={(e) => updateFilters({ created_by: e.target.value || undefined })} aria-label="Erstellt von">
              <option value="">Erstellt von: alle</option>
              {options.creators.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
            <div className="flex items-center gap-2">
              <label className="text-xs text-muted">Von</label>
              <input type="date" className="input" value={f.date_from ?? ""} onChange={(e) => updateFilters({ date_from: e.target.value || undefined })} aria-label="Datum von" />
              <label className="text-xs text-muted">Bis</label>
              <input type="date" className="input" value={f.date_to ?? ""} onChange={(e) => updateFilters({ date_to: e.target.value || undefined })} aria-label="Datum bis" />
            </div>
          </div>
        ) : null}

        {chips.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2">
            {chips.map((c) => (
              <button key={c.key} type="button" onClick={c.clear} className="badge badge-info" title="Filter entfernen">
                {c.label} ✕
              </button>
            ))}
            <button type="button" onClick={resetAll} className="btn btn-outline px-3 py-1.5">Alle Filter zurücksetzen</button>
          </div>
        ) : null}

        {exportMsg ? <p className="text-xs text-muted">{exportMsg}</p> : null}
      </div>

      {/* Massenaktionsleiste (AP13; Statuswechsel und Zuweisung nur für Staff) */}
      {selected.size > 0 ? (
        <div className="card space-y-2 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-foreground">{selected.size} ausgewählt</span>
            {isStaff ? (
              <>
                <select
                  className="input max-w-[220px]" value={bulkStatus}
                  onChange={(e) => setBulkStatus(e.target.value)} aria-label="Neuer Status"
                >
                  <option value="">Status wählen…</option>
                  {INCIDENT_STATUS.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                </select>
                <button
                  type="button" className="btn btn-outline"
                  disabled={bulkBusy || !bulkStatus}
                  onClick={() => void runBulkStatus()}
                >
                  {bulkBusy ? "Wird ausgeführt…" : "Status ändern"}
                </button>
                <select
                  className="input max-w-[220px]" value={bulkMonteur}
                  onChange={(e) => setBulkMonteur(e.target.value)} aria-label="Monteur für Massenzuweisung"
                >
                  <option value="">Monteur wählen…</option>
                  {options.monteure.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                </select>
                <button
                  type="button" className="btn btn-outline"
                  disabled={bulkBusy || !bulkMonteur}
                  onClick={() => void runBulkAssign()}
                >
                  {bulkBusy ? "Wird ausgeführt…" : "Monteur zuweisen"}
                </button>
              </>
            ) : null}
            <button type="button" className="btn btn-outline" onClick={exportSelection}>Auswahl exportieren</button>
            <button type="button" className="btn btn-outline ml-auto" onClick={() => { setSelected(new Set()); resetBulk(); }}>Auswahl aufheben</button>
          </div>
          {isStaff ? (
            <p className="text-xs text-muted">
              Massenaktionen wirken auf höchstens {INCIDENT_BULK_LIMIT} Vorgänge der aktuellen Seite; Regelprüfung,
              Chronik und Protokollierung greifen wie bei einzelnen Änderungen.
            </p>
          ) : null}
          {bulkError ? (
            <p
              role="alert" className="rounded-md border px-3 py-2 text-sm"
              style={{ background: "var(--danger-bg)", color: "var(--danger)", borderColor: "var(--danger)" }}
            >
              {bulkError}
            </p>
          ) : null}
          {bulkMsg ? <p className="text-sm text-foreground">{bulkMsg}</p> : null}
          {bulkFailed.length > 0 ? (
            <ul className="space-y-1 text-xs text-muted">
              {bulkFailed.map((fail) => (
                <li key={fail.id}>
                  {nrOf(fail.id) != null ? `#${nrOf(fail.id)}` : fail.id}:{" "}
                  {BULK_CODE_LABELS[fail.code as keyof typeof BULK_CODE_LABELS] ?? fail.code} ({fail.code})
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {/* Desktop-Tabelle */}
      <div className="card hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-surface-2">
            <tr>
              <th className="px-2 py-2">
                <input type="checkbox" checked={allOnPage} onChange={toggleAllOnPage} aria-label="Alle auf dieser Seite auswählen" />
              </th>
              {SORTABLE.slice(0, 1).map((c) => <SortTh key={c.field} c={c} info={sortInfo(c.field)} onClick={() => toggleSort(c.field)} />)}
              <SortTh c={SORTABLE[1]} info={sortInfo("status")} onClick={() => toggleSort("status")} />
              <SortTh c={SORTABLE[2]} info={sortInfo("priority")} onClick={() => toggleSort("priority")} />
              <SortTh c={SORTABLE[3]} info={sortInfo("customer")} onClick={() => toggleSort("customer")} />
              <SortTh c={SORTABLE[4]} info={sortInfo("construction_stage")} onClick={() => toggleSort("construction_stage")} />
              <Th>VzG</Th><Th>Betriebsstelle</Th><Th>km</Th><Th>Bereitschaft</Th><Th>Kabelarten</Th>
              <SortTh c={SORTABLE[5]} info={sortInfo("created_at")} onClick={() => toggleSort("created_at")} />
              <SortTh c={SORTABLE[6]} info={sortInfo("updated_at")} onClick={() => toggleSort("updated_at")} />
              <Th>Monteure</Th><Th>Bilder</Th><Th>Offene Aufgabe</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((r) => {
              const cables = mergeCableArts(r.cable_arts);
              return (
                <tr
                  key={r.id}
                  className="cursor-pointer hover:bg-surface-2"
                  onClick={() => router.push(`/vorgaenge/${r.id}`)}
                >
                  <td className="px-2 py-2" onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggleRow(r.id)} aria-label={`Vorgang ${r.incident_no} auswählen`} />
                  </td>
                  <td className="px-3 py-2 font-semibold text-foreground">
                    <Link href={`/vorgaenge/${r.id}`} onClick={(e) => e.stopPropagation()} className="hover:underline">#{r.incident_no}</Link>
                  </td>
                  <td className="px-3 py-2"><StatusBadge status={r.status} /></td>
                  <td className="px-3 py-2"><PriorityBadge priority={r.priority} /></td>
                  <td className="px-3 py-2 text-foreground">{r.customer_name ?? "—"}</td>
                  <td className="px-3 py-2 text-muted">{r.stage_code ? `${r.stage_code} – ${r.stage_name ?? ""}` : (r.stage_name ?? "—")}</td>
                  <td className="px-3 py-2 font-mono text-muted">{vzg(r)}</td>
                  <td className="px-3 py-2 text-muted">{r.operating_point ?? "—"}</td>
                  <td className="px-3 py-2 text-muted">{km(r)}</td>
                  <td className="px-3 py-2 text-muted">{r.on_call_number ?? "—"}</td>
                  <td className="px-3 py-2">
                    {cables.length === 0 ? <span className="text-muted">Keine Kabelart</span> : (
                      <span className="flex flex-wrap gap-1">
                        {cables.map((g) => <Badge key={g.name} tone="info">{g.count > 1 ? `${g.name} ×${g.count}` : g.name}</Badge>)}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-muted">{fmt(r.created_at)}</td>
                  <td className="px-3 py-2 text-muted">{fmt(r.updated_at)}</td>
                  <td className="px-3 py-2 text-muted">{monteure(r)}</td>
                  <td className="px-3 py-2 text-muted">{r.image_count}</td>
                  <td className="px-3 py-2">
                    {r.has_open_task ? <Badge tone="warning">Ja</Badge> : <span className="text-muted">—</span>}
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 ? (
              <tr><td colSpan={16} className="px-3 py-8 text-center text-muted">Keine Vorgänge gefunden.</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {/* Mobile-Karten */}
      <div className="space-y-2 md:hidden">
        {rows.map((r) => {
          const cables = mergeCableArts(r.cable_arts);
          return (
            <div key={r.id} className="card p-3">
              <div className="flex items-center justify-between gap-2">
                <label className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggleRow(r.id)} aria-label={`Vorgang ${r.incident_no} auswählen`} />
                  <Link href={`/vorgaenge/${r.id}`} className="font-semibold text-foreground hover:underline">#{r.incident_no}</Link>
                </label>
                <div className="flex items-center gap-1"><PriorityBadge priority={r.priority} /><StatusBadge status={r.status} /></div>
              </div>
              <div className="mt-2 text-sm text-foreground">{r.customer_name ?? "—"}</div>
              <div className="text-sm text-muted">
                {(r.stage_code ? `${r.stage_code} – ${r.stage_name ?? ""}` : (r.stage_name ?? "—"))} · VzG {vzg(r)}
                {r.operating_point ? ` · ${r.operating_point}` : ""}{r.km_from != null ? ` · km ${km(r)}` : ""}
              </div>
              <div className="mt-1 flex flex-wrap gap-1">
                {cables.length === 0 ? <span className="text-xs text-muted">Keine Kabelart</span> :
                  cables.map((g) => <Badge key={g.name} tone="info">{g.count > 1 ? `${g.name} ×${g.count}` : g.name}</Badge>)}
              </div>
              <div className="mt-1 text-xs text-muted">Monteure: {monteure(r)} · Bilder: {r.image_count} · {fmt(r.updated_at)}</div>
              {r.has_open_task ? (
                <div className="mt-1 flex flex-wrap gap-1">
                  <Badge tone="warning">Offene Aufgabe</Badge>
                </div>
              ) : null}
            </div>
          );
        })}
        {rows.length === 0 ? <div className="card p-6 text-center text-muted">Keine Vorgänge gefunden.</div> : null}
      </div>

      {/* Pagination */}
      <div className="card flex flex-wrap items-center gap-3 p-3 text-sm">
        <span className="text-muted">{from}–{toRow} von {total}</span>
        <label className="flex items-center gap-2 text-muted">
          Pro Seite
          <select className="input max-w-[90px]" value={pageSize} onChange={(e) => navigate({ ...query, pageSize: Number(e.target.value), page: 1 })}>
            {INCIDENT_PAGE_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <div className="ml-auto flex items-center gap-2">
          <button type="button" className="btn btn-outline px-3 py-1.5" disabled={page <= 1} onClick={() => navigate({ ...query, page: page - 1 })}>Zurück</button>
          <span className="text-muted">Seite {page} / {lastPage}</span>
          <button type="button" className="btn btn-outline px-3 py-1.5" disabled={page >= lastPage} onClick={() => navigate({ ...query, page: page + 1 })}>Weiter</button>
        </div>
      </div>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="whitespace-nowrap px-3 py-2 text-left text-xs font-semibold uppercase text-muted">{children}</th>;
}
function SortTh({
  c, info, onClick,
}: {
  c: { field: IncidentListSortField; label: string };
  info: { pos: number; dir: "asc" | "desc" } | null;
  onClick: () => void;
}) {
  return (
    <th className="whitespace-nowrap px-3 py-2 text-left text-xs font-semibold uppercase text-muted">
      <button type="button" onClick={onClick} className="inline-flex items-center gap-1 hover:text-foreground">
        {c.label}
        {info ? <span aria-hidden>{info.dir === "asc" ? "▲" : "▼"}{info.pos > 0 ? <sup>{info.pos}</sup> : null}</span> : <span className="text-muted/50">↕</span>}
      </button>
    </th>
  );
}

function Segmented({
  label, value, options, onChange,
}: {
  label: string;
  value: string;
  options: [string, string][];
  onChange: (v: string) => void;
}) {
  return (
    <div className="inline-flex overflow-hidden rounded-md border border-border" role="group" aria-label={label}>
      {options.map(([val, lbl]) => (
        <button
          key={val} type="button" onClick={() => onChange(val)}
          className={`px-3 py-1.5 text-sm ${value === val ? "bg-brand text-white" : "bg-surface text-foreground hover:bg-surface-2"}`}
        >
          {lbl}
        </button>
      ))}
    </div>
  );
}
