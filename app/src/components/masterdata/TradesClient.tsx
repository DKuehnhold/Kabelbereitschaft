"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { saveTrade, setTradeActive } from "@/lib/masterdata-actions";
import type { TradeRow } from "@/lib/masterdata";
import type { FormState } from "@/lib/incidents";
import {
  MasterModal, Toolbar, StatusPill, RowActions, FormError, FormActions,
  TableWrap, Th, Td, CardList, EmptyState, labelCls,
} from "@/components/masterdata/shared";

// AUFTRAG_6: pflegbarer Katalog "Gewerke" - exaktes Muster von
// CableTypesClient.tsx, aber ohne code/sort_order (Tabellenform laut Auftrag
// nur id/label/is_active, 0019_hlk_katalog_stammdaten.sql Abschnitt 1).

const initial: FormState = { ok: false, error: null };

function TradeForm({ row, onSaved }: { row: TradeRow | null; onSaved: () => void }) {
  const [state, action, pending] = useActionState(saveTrade, initial);
  useEffect(() => { if (state.ok) onSaved(); }, [state.ok, onSaved]);
  return (
    <form action={action} className="space-y-3">
      {row ? <input type="hidden" name="id" value={row.id} /> : null}
      <FormError error={state.error} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className={labelCls} htmlFor="trade_label">Bezeichnung *</label>
          <input id="trade_label" name="label" required defaultValue={row?.label ?? ""} className="input" placeholder="z. B. LST" />
        </div>
        <div>
          <label className={labelCls} htmlFor="trade_active">Status</label>
          <select id="trade_active" name="is_active" defaultValue={row ? String(row.is_active) : "true"} className="input">
            <option value="true">Aktiv</option>
            <option value="false">Inaktiv</option>
          </select>
        </div>
      </div>
      <FormActions pending={pending} />
    </form>
  );
}

export function TradesClient({ trades }: { trades: TradeRow[] }) {
  const [q, setQ] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<TradeRow | null>(null);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return trades
      .filter((t) => (showInactive ? true : t.is_active))
      .filter((t) => (!needle ? true : t.label.toLowerCase().includes(needle)))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [trades, q, showInactive]);

  const openNew = () => { setEdit(null); setOpen(true); };
  const openEdit = (t: TradeRow) => { setEdit(t); setOpen(true); };

  return (
    <div className="space-y-3">
      <Toolbar
        query={q} setQuery={setQ} showInactive={showInactive} setShowInactive={setShowInactive}
        onNew={openNew} newLabel="+ Neues Gewerk" searchPlaceholder="Gewerk suchen…"
      />

      <TableWrap>
        <thead><tr><Th>Bezeichnung</Th><Th>Status</Th><Th className="text-right">Aktionen</Th></tr></thead>
        <tbody>
          {rows.map((t) => (
            <tr key={t.id} className="border-t border-border">
              <Td className="font-medium">{t.label}</Td>
              <Td><StatusPill active={t.is_active} /></Td>
              <Td className="text-right"><div className="flex justify-end"><RowActions id={t.id} active={t.is_active} onEdit={() => openEdit(t)} toggleAction={setTradeActive} /></div></Td>
            </tr>
          ))}
        </tbody>
      </TableWrap>

      <CardList>
        {rows.map((t) => (
          <div key={t.id} className="card p-3">
            <div className="flex items-center justify-between">
              <span className="font-medium text-foreground">{t.label}</span>
              <StatusPill active={t.is_active} />
            </div>
            <div className="mt-3"><RowActions id={t.id} active={t.is_active} onEdit={() => openEdit(t)} toggleAction={setTradeActive} /></div>
          </div>
        ))}
      </CardList>

      {rows.length === 0 ? <EmptyState text="Keine Gewerke." /> : null}

      <MasterModal open={open} onClose={() => setOpen(false)} title={edit ? "Gewerk bearbeiten" : "Neues Gewerk"}>
        <TradeForm row={edit} onSaved={() => setOpen(false)} />
      </MasterModal>
    </div>
  );
}
