"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { saveOnCallNumber, setOnCallNumberActive } from "@/lib/masterdata-actions";
import type { OnCallRow } from "@/lib/masterdata";
import type { FormState } from "@/lib/incidents";
import {
  MasterModal, Toolbar, StatusPill, RowActions, FormError, FormActions,
  TableWrap, Th, Td, CardList, EmptyState, labelCls,
} from "@/components/masterdata/shared";

const initial: FormState = { ok: false, error: null };

function OnCallForm({ row, onSaved }: { row: OnCallRow | null; onSaved: () => void }) {
  const [state, action, pending] = useActionState(saveOnCallNumber, initial);
  useEffect(() => { if (state.ok) onSaved(); }, [state.ok, onSaved]);
  return (
    <form action={action} className="space-y-3">
      {row ? <input type="hidden" name="id" value={row.id} /> : null}
      <FormError error={state.error} />
      <div>
        <label className={labelCls} htmlFor="oc_number">Telefonnummer *</label>
        <input id="oc_number" name="number" required defaultValue={row?.number ?? ""} className="input" />
      </div>
      <div>
        <label className={labelCls} htmlFor="oc_label">Bezeichnung</label>
        <input id="oc_label" name="label" defaultValue={row?.label ?? ""} className="input" placeholder="z. B. Nord" />
      </div>
      <div>
        <label className={labelCls} htmlFor="oc_active">Status</label>
        <select id="oc_active" name="is_active" defaultValue={row ? String(row.is_active) : "true"} className="input">
          <option value="true">Aktiv</option>
          <option value="false">Inaktiv</option>
        </select>
      </div>
      <FormActions pending={pending} />
    </form>
  );
}

export function OnCallNumbersClient({ rows: source }: { rows: OnCallRow[] }) {
  const [q, setQ] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<OnCallRow | null>(null);
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return source
      .filter((row) => showInactive || row.is_active)
      .filter((row) => !needle || `${row.number} ${row.label ?? ""}`.toLowerCase().includes(needle));
  }, [source, q, showInactive]);

  return (
    <div className="space-y-3">
      <Toolbar
        query={q}
        setQuery={setQ}
        showInactive={showInactive}
        setShowInactive={setShowInactive}
        onNew={() => { setEdit(null); setOpen(true); }}
        newLabel="+ Neue Bereitschaftsnummer"
        searchPlaceholder="Nummer suchen…"
      />
      <TableWrap>
        <thead><tr><Th>Telefonnummer</Th><Th>Bezeichnung</Th><Th>Status</Th><Th className="text-right">Aktionen</Th></tr></thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-t border-border">
              <Td className="font-medium">{row.number}</Td>
              <Td>{row.label ?? "—"}</Td>
              <Td><StatusPill active={row.is_active} /></Td>
              <Td className="text-right">
                <div className="flex justify-end">
                  <RowActions
                    id={row.id}
                    active={row.is_active}
                    onEdit={() => { setEdit(row); setOpen(true); }}
                    toggleAction={setOnCallNumberActive}
                  />
                </div>
              </Td>
            </tr>
          ))}
        </tbody>
      </TableWrap>
      <CardList>
        {rows.map((row) => (
          <div key={row.id} className="card p-3">
            <div className="flex items-center justify-between">
              <span className="font-medium">{row.number}</span>
              <StatusPill active={row.is_active} />
            </div>
            <div className="mt-1 text-sm text-muted">{row.label ?? "Keine Bezeichnung"}</div>
            <div className="mt-3">
              <RowActions
                id={row.id}
                active={row.is_active}
                onEdit={() => { setEdit(row); setOpen(true); }}
                toggleAction={setOnCallNumberActive}
              />
            </div>
          </div>
        ))}
      </CardList>
      {rows.length === 0 ? <EmptyState text="Keine Bereitschaftsnummern." /> : null}
      <MasterModal open={open} onClose={() => setOpen(false)} title={edit ? "Bereitschaftsnummer bearbeiten" : "Neue Bereitschaftsnummer"}>
        <OnCallForm row={edit} onSaved={() => setOpen(false)} />
      </MasterModal>
    </div>
  );
}
