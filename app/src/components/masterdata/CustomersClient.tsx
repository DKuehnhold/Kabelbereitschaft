"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { saveCustomer, setCustomerActive } from "@/lib/masterdata-actions";
import type { CustomerRow } from "@/lib/masterdata";
import type { FormState } from "@/lib/incidents";
import {
  MasterModal, Toolbar, StatusPill, RowActions, FormError, FormActions,
  TableWrap, Th, Td, CardList, EmptyState, labelCls,
} from "@/components/masterdata/shared";

const initial: FormState = { ok: false, error: null };

function CustomerForm({ row, onSaved }: { row: CustomerRow | null; onSaved: () => void }) {
  const [state, action, pending] = useActionState(saveCustomer, initial);
  useEffect(() => { if (state.ok) onSaved(); }, [state.ok, onSaved]);
  return (
    <form action={action} className="space-y-3">
      {row ? <input type="hidden" name="id" value={row.id} /> : null}
      <FormError error={state.error} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className={labelCls} htmlFor="c_name">Kundenname *</label>
          <input id="c_name" name="name" required defaultValue={row?.name ?? ""} className="input" />
        </div>
        <div>
          <label className={labelCls} htmlFor="c_erp">ERP-ID</label>
          <input id="c_erp" name="erp_id" defaultValue={row?.erp_id ?? ""} className="input" placeholder="optional, eindeutig" />
        </div>
        <div>
          <label className={labelCls} htmlFor="c_active">Status</label>
          <select id="c_active" name="is_active" defaultValue={row ? String(row.is_active) : "true"} className="input">
            <option value="true">Aktiv</option>
            <option value="false">Inaktiv</option>
          </select>
        </div>
      </div>
      <FormActions pending={pending} />
    </form>
  );
}

export function CustomersClient({ customers }: { customers: CustomerRow[] }) {
  const [q, setQ] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<CustomerRow | null>(null);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return customers
      .filter((c) => (showInactive ? true : c.is_active))
      .filter((c) => (!needle ? true : [c.name, c.erp_id].filter(Boolean).join(" ").toLowerCase().includes(needle)))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [customers, q, showInactive]);

  const openNew = () => { setEdit(null); setOpen(true); };
  const openEdit = (c: CustomerRow) => { setEdit(c); setOpen(true); };

  return (
    <div className="space-y-3">
      <Toolbar
        query={q} setQuery={setQ} showInactive={showInactive} setShowInactive={setShowInactive}
        onNew={openNew} newLabel="+ Neuer Kunde" searchPlaceholder="Kunde oder ERP-ID suchen…"
      />

      <TableWrap>
        <thead><tr><Th>Name</Th><Th>ERP-ID</Th><Th>Status</Th><Th className="text-right">Aktionen</Th></tr></thead>
        <tbody>
          {rows.map((c) => (
            <tr key={c.id} className="border-t border-border">
              <Td className="font-medium">{c.name}</Td>
              <Td className="text-muted">{c.erp_id ?? "—"}</Td>
              <Td><StatusPill active={c.is_active} /></Td>
              <Td className="text-right"><div className="flex justify-end"><RowActions id={c.id} active={c.is_active} onEdit={() => openEdit(c)} toggleAction={setCustomerActive} /></div></Td>
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
            <div className="mt-1 text-sm text-muted">ERP-ID: {c.erp_id ?? "—"}</div>
            <div className="mt-3"><RowActions id={c.id} active={c.is_active} onEdit={() => openEdit(c)} toggleAction={setCustomerActive} /></div>
          </div>
        ))}
      </CardList>

      {rows.length === 0 ? <EmptyState text="Keine Kunden." /> : null}

      <MasterModal open={open} onClose={() => setOpen(false)} title={edit ? "Kunde bearbeiten" : "Neuer Kunde"}>
        <CustomerForm row={edit} onSaved={() => setOpen(false)} />
      </MasterModal>
    </div>
  );
}
