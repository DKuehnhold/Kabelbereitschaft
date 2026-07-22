"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { saveVzgLine, setVzgLineActive } from "@/lib/masterdata-actions";
import type { VzgLineRow, StageOption } from "@/lib/masterdata";
import type { FormState } from "@/lib/incidents";
import {
  MasterModal, Toolbar, StatusPill, RowActions, FormError, FormActions,
  TableWrap, Th, Td, CardList, EmptyState, labelCls,
} from "@/components/masterdata/shared";

const initial: FormState = { ok: false, error: null };

function VzgForm({
  row, onSaved, stageOptions,
}: { row: VzgLineRow | null; onSaved: () => void; stageOptions: StageOption[] }) {
  const [state, action, pending] = useActionState(saveVzgLine, initial);
  useEffect(() => { if (state.ok) onSaved(); }, [state.ok, onSaved]);
  return (
    <form action={action} className="space-y-3">
      {row ? <input type="hidden" name="id" value={row.id} /> : null}
      <FormError error={state.error} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className={labelCls} htmlFor="v_num">VzG-Streckennummer *</label>
          <input id="v_num" name="line_number" required inputMode="numeric" maxLength={4}
            defaultValue={row?.line_number ?? ""} className="input" placeholder="genau 4 Ziffern, z. B. 1733" />
        </div>
        <div>
          <label className={labelCls} htmlFor="v_stage">Bauabschnitt *</label>
          <select id="v_stage" name="construction_stage_id" required defaultValue={row?.construction_stage_id ?? ""} className="input">
            <option value="">Bitte wählen…</option>
            {stageOptions.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className={labelCls} htmlFor="v_desc">Bezeichnung</label>
          <input id="v_desc" name="description" defaultValue={row?.description ?? ""} className="input" />
        </div>
        <div>
          <label className={labelCls} htmlFor="v_active">Status</label>
          <select id="v_active" name="is_active" defaultValue={row ? String(row.is_active) : "true"} className="input">
            <option value="true">Aktiv</option>
            <option value="false">Inaktiv</option>
          </select>
        </div>
      </div>
      <p className="text-xs text-muted">Dieselbe Nummer darf mehreren Bauabschnitten zugeordnet werden; je Bauabschnitt jedoch nur einmal.</p>
      <FormActions pending={pending} />
    </form>
  );
}

export function VzgLinesClient({
  lines, stageOptions,
}: { lines: VzgLineRow[]; stageOptions: StageOption[] }) {
  const [q, setQ] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<VzgLineRow | null>(null);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return lines
      .filter((v) => (showInactive ? true : v.is_active))
      .filter((v) => (!needle ? true : [v.line_number, v.description, v.stage_name].filter(Boolean).join(" ").toLowerCase().includes(needle)))
      .sort((a, b) => a.line_number.localeCompare(b.line_number));
  }, [lines, q, showInactive]);

  const openNew = () => { setEdit(null); setOpen(true); };
  const openEdit = (v: VzgLineRow) => { setEdit(v); setOpen(true); };

  return (
    <div className="space-y-3">
      <Toolbar
        query={q} setQuery={setQ} showInactive={showInactive} setShowInactive={setShowInactive}
        onNew={openNew} newLabel="+ Neue VzG-Strecke" searchPlaceholder="Nummer / Bauabschnitt suchen…"
      />

      <TableWrap>
        <thead><tr><Th>Nummer</Th><Th>Bezeichnung</Th><Th>Bauabschnitt</Th><Th>Status</Th><Th className="text-right">Aktionen</Th></tr></thead>
        <tbody>
          {rows.map((v) => (
            <tr key={v.id} className="border-t border-border">
              <Td className="font-mono font-medium">{v.line_number}</Td>
              <Td className="text-muted">{v.description ?? "—"}</Td>
              <Td className="text-muted">{v.stage_name}</Td>
              <Td><StatusPill active={v.is_active} /></Td>
              <Td className="text-right"><div className="flex justify-end"><RowActions id={v.id} active={v.is_active} onEdit={() => openEdit(v)} toggleAction={setVzgLineActive} /></div></Td>
            </tr>
          ))}
        </tbody>
      </TableWrap>

      <CardList>
        {rows.map((v) => (
          <div key={v.id} className="card p-3">
            <div className="flex items-center justify-between">
              <span className="font-mono font-medium text-foreground">{v.line_number}</span>
              <StatusPill active={v.is_active} />
            </div>
            <div className="mt-1 text-sm text-muted">{v.description ?? "—"}</div>
            <div className="text-sm text-muted">Bauabschnitt: {v.stage_name}</div>
            <div className="mt-3"><RowActions id={v.id} active={v.is_active} onEdit={() => openEdit(v)} toggleAction={setVzgLineActive} /></div>
          </div>
        ))}
      </CardList>

      {rows.length === 0 ? <EmptyState text="Keine VzG-Strecken." /> : null}

      <MasterModal open={open} onClose={() => setOpen(false)} title={edit ? "VzG-Strecke bearbeiten" : "Neue VzG-Strecke"}>
        <VzgForm row={edit} onSaved={() => setOpen(false)} stageOptions={stageOptions} />
      </MasterModal>
    </div>
  );
}
