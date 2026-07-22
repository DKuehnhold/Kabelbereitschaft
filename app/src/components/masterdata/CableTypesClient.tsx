"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { saveCableType, setCableTypeActive } from "@/lib/masterdata-actions";
import type { CableTypeRow } from "@/lib/masterdata";
import type { FormState } from "@/lib/incidents";
import {
  MasterModal, Toolbar, StatusPill, RowActions, FormError, FormActions,
  TableWrap, Th, Td, CardList, EmptyState, labelCls,
} from "@/components/masterdata/shared";

const initial: FormState = { ok: false, error: null };

function CableTypeForm({ row, onSaved }: { row: CableTypeRow | null; onSaved: () => void }) {
  const [state, action, pending] = useActionState(saveCableType, initial);
  useEffect(() => { if (state.ok) onSaved(); }, [state.ok, onSaved]);
  return (
    <form action={action} className="space-y-3">
      {row ? <input type="hidden" name="id" value={row.id} /> : null}
      <FormError error={state.error} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className={labelCls} htmlFor="ct_code">Code *</label>
          <input id="ct_code" name="code" required defaultValue={row?.code ?? ""} className="input" placeholder="z. B. lst" />
        </div>
        <div>
          <label className={labelCls} htmlFor="ct_name">Bezeichnung *</label>
          <input id="ct_name" name="name" required defaultValue={row?.name ?? ""} className="input" placeholder="z. B. LST" />
        </div>
        <div>
          <label className={labelCls} htmlFor="ct_sort">Sortierung</label>
          <input id="ct_sort" name="sort_order" inputMode="numeric" defaultValue={row ? String(row.sort_order) : "0"} className="input" />
        </div>
        <div>
          <label className={labelCls} htmlFor="ct_active">Status</label>
          <select id="ct_active" name="is_active" defaultValue={row ? String(row.is_active) : "true"} className="input">
            <option value="true">Aktiv</option>
            <option value="false">Inaktiv</option>
          </select>
        </div>
      </div>
      <FormActions pending={pending} />
    </form>
  );
}

export function CableTypesClient({ cableTypes }: { cableTypes: CableTypeRow[] }) {
  const [q, setQ] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<CableTypeRow | null>(null);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return cableTypes
      .filter((c) => (showInactive ? true : c.is_active))
      .filter((c) => (!needle ? true : [c.code, c.name].join(" ").toLowerCase().includes(needle)))
      .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
  }, [cableTypes, q, showInactive]);

  const openNew = () => { setEdit(null); setOpen(true); };
  const openEdit = (c: CableTypeRow) => { setEdit(c); setOpen(true); };

  return (
    <div className="space-y-3">
      <Toolbar
        query={q} setQuery={setQ} showInactive={showInactive} setShowInactive={setShowInactive}
        onNew={openNew} newLabel="+ Neue Kabelart" searchPlaceholder="Kabelart suchen…"
      />

      <TableWrap>
        <thead><tr><Th>Code</Th><Th>Bezeichnung</Th><Th>Sortierung</Th><Th>Status</Th><Th className="text-right">Aktionen</Th></tr></thead>
        <tbody>
          {rows.map((c) => (
            <tr key={c.id} className="border-t border-border">
              <Td className="font-mono text-muted">{c.code}</Td>
              <Td className="font-medium">{c.name}</Td>
              <Td className="text-muted">{c.sort_order}</Td>
              <Td><StatusPill active={c.is_active} /></Td>
              <Td className="text-right"><div className="flex justify-end"><RowActions id={c.id} active={c.is_active} onEdit={() => openEdit(c)} toggleAction={setCableTypeActive} /></div></Td>
            </tr>
          ))}
        </tbody>
      </TableWrap>

      <CardList>
        {rows.map((c) => (
          <div key={c.id} className="card p-3">
            <div className="flex items-center justify-between">
              <span className="font-medium text-foreground">{c.name}</span>
              <StatusPill active={c.is_active} />
            </div>
            <div className="mt-1 text-sm text-muted">Code: <span className="font-mono">{c.code}</span> · Sortierung: {c.sort_order}</div>
            <div className="mt-3"><RowActions id={c.id} active={c.is_active} onEdit={() => openEdit(c)} toggleAction={setCableTypeActive} /></div>
          </div>
        ))}
      </CardList>

      {rows.length === 0 ? <EmptyState text="Keine Kabelarten." /> : null}

      <MasterModal open={open} onClose={() => setOpen(false)} title={edit ? "Kabelart bearbeiten" : "Neue Kabelart"}>
        <CableTypeForm row={edit} onSaved={() => setOpen(false)} />
      </MasterModal>
    </div>
  );
}
