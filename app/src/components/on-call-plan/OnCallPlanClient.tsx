"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/shadcn/button";
import { Badge } from "@/components/ui/primitives";
import { assignOnCall, removeOnCall } from "@/lib/on-call-plan-actions";
import { addDaysToIsoDate, mondayOfWeekBerlinIso } from "@/lib/date-local";
import type { OnCallWeek, OnCallPlanEntry } from "@/lib/on-call-plan";

// =====================================================================
// AUFTRAG_10 – Bereitschaftsplan (Einsatzplanung): Wochenansicht wie die
// Excel-Matrix "Einsatzplanung" - Zeilen sind die aktiven Bauabschnitte,
// Spalten Montag bis Sonntag mit Datum, Zellen die zugewiesenen Techniker
// (Badges). Staff kann je Zelle hinzufügen (Select aus aktiven Technikern)
// und entfernen (×); Monteure sehen read-only - `canEdit` steuert, ob
// UEBERHAUPT ein Bedienelement gerendert wird (kein Verstecken per CSS,
// echtes Weglassen, wie im Auftrag verlangt). Die Durchsetzung selbst kommt
// aus RLS (0021_hlk_bereitschaftsplan.sql) und der Staff-Allowlist in
// on-call-plan-actions.ts - `canEdit` ist ausschließlich eine
// Darstellungsentscheidung.
//
// Mobil: Tageskarten untereinander statt Matrix (dieselben Daten, gleiche
// Bedienelemente) - schlichtestes Muster der bestehenden Mobilkarten der
// Meldungsliste (OperationalList.tsx), keine eigene Designentscheidung.
//
// touchStyle (Mindesthöhe 44px) exaktes Muster aus NewIncidentForm.tsx:
// globals.css definiert eine geringere Basishöhe, ein Inline-Style setzt sie
// zuverlässig unabhängig von der CSS-Kaskadenreihenfolge durch.
// =====================================================================

const touchStyle = { minHeight: "44px" } as const;

const WEEKDAY_LABELS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

function formatDayLabel(iso: string, index: number): string {
  const [, month, day] = iso.split("-");
  return `${WEEKDAY_LABELS[index]} ${day}.${month}.`;
}

type TechnicianOption = { id: string; label: string };

function cellKey(stageId: string, date: string): string {
  return `${stageId}|${date}`;
}

function AssignedBadge({
  entry,
  canEdit,
  busy,
  onRemove,
}: {
  entry: OnCallPlanEntry;
  canEdit: boolean;
  busy: boolean;
  onRemove: (id: string) => void;
}) {
  return (
    <span className="inline-flex items-center gap-1">
      <Badge tone="info">{entry.technician_name}</Badge>
      {canEdit ? (
        <button
          type="button"
          aria-label={`${entry.technician_name} entfernen`}
          className="leading-none text-muted hover:text-red-600"
          style={touchStyle}
          disabled={busy}
          onClick={() => onRemove(entry.id)}
        >
          ×
        </button>
      ) : null}
    </span>
  );
}

function AddCellControl({
  open,
  busy,
  technicianOptions,
  selected,
  onSelect,
  onOpen,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  busy: boolean;
  technicianOptions: TechnicianOption[];
  selected: string;
  onSelect: (id: string) => void;
  onOpen: () => void;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) {
    return (
      <Button variant="outline" size="sm" className="mt-1" style={touchStyle} disabled={busy} onClick={onOpen}>
        + Hinzufügen
      </Button>
    );
  }
  return (
    <div className="mt-1 flex flex-wrap items-center gap-1">
      <select
        className="input"
        style={touchStyle}
        value={selected}
        onChange={(e) => onSelect(e.target.value)}
        aria-label="Techniker wählen"
      >
        <option value="">Techniker wählen…</option>
        {technicianOptions.map((t) => (
          <option key={t.id} value={t.id}>{t.label}</option>
        ))}
      </select>
      <Button size="sm" style={touchStyle} disabled={busy || !selected} onClick={onConfirm}>
        OK
      </Button>
      <Button variant="outline" size="sm" style={touchStyle} disabled={busy} onClick={onCancel}>
        Abbrechen
      </Button>
    </div>
  );
}

export function OnCallPlanClient({
  week,
  technicianOptions,
  canEdit,
}: {
  week: OnCallWeek;
  technicianOptions: TechnicianOption[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addingCell, setAddingCell] = useState<string | null>(null);
  const [selectedTechnician, setSelectedTechnician] = useState<string>("");

  const entriesByCell = new Map<string, OnCallPlanEntry[]>();
  for (const e of week.entries) {
    const key = cellKey(e.construction_stage_id, e.plan_date);
    const list = entriesByCell.get(key) ?? [];
    list.push(e);
    entriesByCell.set(key, list);
  }

  const navigateToWeek = (weekStart: string) => {
    startTransition(() => router.push(`/bereitschaftsplan?woche=${weekStart}`));
  };
  const goPrev = () => navigateToWeek(addDaysToIsoDate(week.weekStart, -7));
  const goNext = () => navigateToWeek(addDaysToIsoDate(week.weekStart, 7));
  const goToday = () => navigateToWeek(mondayOfWeekBerlinIso());

  const openCell = (key: string) => {
    setError(null);
    setAddingCell(key);
    setSelectedTechnician("");
  };
  const closeCell = () => {
    setAddingCell(null);
    setSelectedTechnician("");
  };

  const handleAssign = async (stageId: string, date: string) => {
    if (!selectedTechnician) return;
    setBusy(true);
    setError(null);
    const result = await assignOnCall(stageId, date, selectedTechnician);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    closeCell();
    startTransition(() => router.refresh());
  };

  const handleRemove = async (entryId: string) => {
    setBusy(true);
    setError(null);
    const result = await removeOnCall(entryId);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    startTransition(() => router.refresh());
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" style={touchStyle} disabled={busy} onClick={goPrev}>
          ← Vorherige Woche
        </Button>
        <Button variant="outline" style={touchStyle} disabled={busy} onClick={goToday}>
          Heute
        </Button>
        <Button variant="outline" style={touchStyle} disabled={busy} onClick={goNext}>
          Nächste Woche →
        </Button>
        <span className="text-sm text-muted">
          Woche vom {week.weekStart} bis {week.days[6]}
        </span>
      </div>

      {error ? (
        <div className="card border border-red-300 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      ) : null}

      {/* Desktop-Matrix: Zeilen = aktive Bauabschnitte, Spalten = Mo–So. */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="whitespace-nowrap border-b border-border px-3 py-2 text-left text-xs font-semibold uppercase text-muted">
                Bauabschnitt
              </th>
              {week.days.map((d, i) => (
                <th
                  key={d}
                  className="whitespace-nowrap border-b border-border px-3 py-2 text-left text-xs font-semibold uppercase text-muted"
                >
                  {formatDayLabel(d, i)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {week.stages.map((stage) => (
              <tr key={stage.id} className="border-t border-border align-top">
                <td className="whitespace-nowrap px-3 py-2 font-medium text-foreground">
                  {stage.code ? `${stage.code} – ${stage.name}` : stage.name}
                </td>
                {week.days.map((day) => {
                  const key = cellKey(stage.id, day);
                  const entries = entriesByCell.get(key) ?? [];
                  return (
                    <td key={day} className="px-3 py-2">
                      <div className="flex flex-wrap gap-1">
                        {entries.map((e) => (
                          <AssignedBadge key={e.id} entry={e} canEdit={canEdit} busy={busy} onRemove={handleRemove} />
                        ))}
                      </div>
                      {canEdit ? (
                        <AddCellControl
                          open={addingCell === key}
                          busy={busy}
                          technicianOptions={technicianOptions}
                          selected={selectedTechnician}
                          onSelect={setSelectedTechnician}
                          onOpen={() => openCell(key)}
                          onConfirm={() => handleAssign(stage.id, day)}
                          onCancel={closeCell}
                        />
                      ) : null}
                    </td>
                  );
                })}
              </tr>
            ))}
            {week.stages.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-muted">
                  Keine aktiven Bauabschnitte.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {/* Mobile-Tageskarten: dieselben Daten wie die Matrix, Tage
          untereinander statt als Spalten. */}
      <div className="space-y-3 md:hidden">
        {week.days.map((day, i) => (
          <div key={day} className="card p-3">
            <div className="font-semibold text-foreground">{formatDayLabel(day, i)}</div>
            <div className="mt-2 space-y-2">
              {week.stages.map((stage) => {
                const key = cellKey(stage.id, day);
                const entries = entriesByCell.get(key) ?? [];
                return (
                  <div key={stage.id} className="border-t border-border pt-2 first:border-t-0 first:pt-0">
                    <div className="text-sm text-muted">
                      {stage.code ? `${stage.code} – ${stage.name}` : stage.name}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {entries.length === 0 ? (
                        <span className="text-xs text-muted">— keine Zuweisung —</span>
                      ) : null}
                      {entries.map((e) => (
                        <AssignedBadge key={e.id} entry={e} canEdit={canEdit} busy={busy} onRemove={handleRemove} />
                      ))}
                    </div>
                    {canEdit ? (
                      <AddCellControl
                        open={addingCell === key}
                        busy={busy}
                        technicianOptions={technicianOptions}
                        selected={selectedTechnician}
                        onSelect={setSelectedTechnician}
                        onOpen={() => openCell(key)}
                        onConfirm={() => handleAssign(stage.id, day)}
                        onCancel={closeCell}
                      />
                    ) : null}
                  </div>
                );
              })}
              {week.stages.length === 0 ? (
                <div className="text-sm text-muted">Keine aktiven Bauabschnitte.</div>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
