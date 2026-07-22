"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { saveStage, setStageActive } from "@/lib/masterdata-actions";
import type { StageRow, StageOption } from "@/lib/masterdata";
import type { FormState } from "@/lib/incidents";
import {
  MasterModal, Toolbar, StatusPill, RowActions, FormError, FormActions,
  TableWrap, Th, Td, CardList, EmptyState, labelCls,
} from "@/components/masterdata/shared";

const initial: FormState = { ok: false, error: null };

function StageForm({
  row, onSaved, onCallOptions,
}: { row: StageRow | null; onSaved: () => void; onCallOptions: StageOption[] }) {
  const [state, action, pending] = useActionState(saveStage, initial);
  useEffect(() => { if (state.ok) onSaved(); }, [state.ok, onSaved]);
  return (
    <form action={action} className="space-y-3">
      {row ? <input type="hidden" name="id" value={row.id} /> : null}
      <FormError error={state.error} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className={labelCls} htmlFor="s_code">Code</label>
          <input id="s_code" name="code" defaultValue={row?.code ?? ""} className="input" />
        </div>
        <div>
          <label className={labelCls} htmlFor="s_name">Bezeichnung *</label>
          <input id="s_name" name="name" required defaultValue={row?.name ?? ""} className="input" />
        </div>
        <div>
          <label className={labelCls} htmlFor="s_wus">WUS-BST</label>
          <input id="s_wus" name="wus_bst" defaultValue={row?.wus_bst ?? ""} className="input" placeholder="ERP-Referenz, optional" />
        </div>
        <div>
          <label className={labelCls} htmlFor="s_oncall">Standard-Bereitschaftsnummer</label>
          <select id="s_oncall" name="default_on_call_number_id" defaultValue={row?.default_on_call_number_id ?? ""} className="input">
            <option value="">— keine —</option>
            {onCallOptions.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className={labelCls} htmlFor="s_desc">Beschreibung</label>
          <textarea id="s_desc" name="description" rows={2} defaultValue={row?.description ?? ""} className="input" />
        </div>
        <div>
          <label className={labelCls} htmlFor="s_active">Status</label>
          <select id="s_active" name="is_active" defaultValue={row ? String(row.is_active) : "true"} className="input">
            <option value="true">Aktiv</option>
            <option value="false">Inaktiv</option>
          </select>
        </div>
      </div>
      <FormActions pending={pending} />
    </form>
  );
}

export function StagesClient({
  stages, onCallOptions,
}: { stages: StageRow[]; onCallOptions: StageOption[] }) {
  const [q, setQ] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<StageRow | null>(null);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return stages
      .filter((s) => (showInactive ? true : s.is_active))
      .filter((s) => (!needle ? true : [s.code, s.name, s.wus_bst].filter(Boolean).join(" ").toLowerCase().includes(needle)))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [stages, q, showInactive]);

  const openNew = () => { setEdit(null); setOpen(true); };
  const openEdit = (s: StageRow) => { setEdit(s); setOpen(true); };

  return (
    <div className="space-y-3">
      <Toolbar
        query={q} setQuery={setQ} showInactive={showInactive} setShowInactive={setShowInactive}
        onNew={openNew} newLabel="+ Neuer Bauabschnitt" searchPlaceholder="Bauabschnitt / WUS-BST suchen…"
      />

      <TableWrap>
        <thead><tr><Th>Code</Th><Th>Bezeichnung</Th><Th>WUS-BST</Th><Th>Bereitschaftsnr.</Th><Th>Status</Th><Th className="text-right">Aktionen</Th></tr></thead>
        <tbody>
          {rows.map((s) => (
            <tr key={s.id} className="border-t border-border">
              <Td className="text-muted">{s.code ?? "—"}</Td>
              <Td className="font-medium">{s.name}</Td>
              <Td className="text-muted">{s.wus_bst ?? "—"}</Td>
              <Td className="text-muted">{s.default_on_call_label ?? "—"}</Td>
              <Td><StatusPill active={s.is_active} /></Td>
              <Td className="text-right"><div className="flex justify-end"><RowActions id={s.id} active={s.is_active} onEdit={() => openEdit(s)} toggleAction={setStageActive} /></div></Td>
            </tr>
          ))}
        </tbody>
      </TableWrap>

      <CardList>
        {rows.map((s) => (
          <div key={s.id} className="card p-3">
            <div className="flex items-center justify-between">
              <span className="font-medium text-foreground">{s.code ? `${s.code} – ${s.name}` : s.name}</span>
              <StatusPill active={s.is_active} />
            </div>
            <div className="mt-1 text-sm text-muted">WUS-BST: {s.wus_bst ?? "—"} · Bereitschaft: {s.default_on_call_label ?? "—"}</div>
            <div className="mt-3"><RowActions id={s.id} active={s.is_active} onEdit={() => openEdit(s)} toggleAction={setStageActive} /></div>
          </div>
        ))}
      </CardList>

      {rows.length === 0 ? <EmptyState text="Keine Bauabschnitte." /> : null}

      <MasterModal open={open} onClose={() => setOpen(false)} title={edit ? "Bauabschnitt bearbeiten" : "Neuer Bauabschnitt"}>
        <StageForm row={edit} onSaved={() => setOpen(false)} onCallOptions={onCallOptions} />
      </MasterModal>
    </div>
  );
}
