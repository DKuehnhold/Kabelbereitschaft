"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { saveContactFunction, setContactFunctionActive } from "@/lib/masterdata-actions";
import type { ContactFunctionRow } from "@/lib/masterdata";
import type { FormState } from "@/lib/incidents";
import {
  MasterModal, Toolbar, StatusPill, RowActions, FormError, FormActions,
  TableWrap, Th, Td, CardList, EmptyState, labelCls,
} from "@/components/masterdata/shared";

// AUFTRAG_6: pflegbarer Katalog "Funktionen" (des Anrufenden/Ansprechpartners)
// - exaktes Muster von CableTypesClient.tsx, aber ohne code/sort_order
// (Tabellenform laut Auftrag nur id/label/is_active,
// 0019_hlk_katalog_stammdaten.sql Abschnitt 2).

const initial: FormState = { ok: false, error: null };

function ContactFunctionForm({ row, onSaved }: { row: ContactFunctionRow | null; onSaved: () => void }) {
  const [state, action, pending] = useActionState(saveContactFunction, initial);
  useEffect(() => { if (state.ok) onSaved(); }, [state.ok, onSaved]);
  return (
    <form action={action} className="space-y-3">
      {row ? <input type="hidden" name="id" value={row.id} /> : null}
      <FormError error={state.error} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className={labelCls} htmlFor="cf_label">Bezeichnung *</label>
          <input id="cf_label" name="label" required defaultValue={row?.label ?? ""} className="input" placeholder="z. B. BÜW" />
        </div>
        <div>
          <label className={labelCls} htmlFor="cf_active">Status</label>
          <select id="cf_active" name="is_active" defaultValue={row ? String(row.is_active) : "true"} className="input">
            <option value="true">Aktiv</option>
            <option value="false">Inaktiv</option>
          </select>
        </div>
      </div>
      <FormActions pending={pending} />
    </form>
  );
}

export function ContactFunctionsClient({ functions }: { functions: ContactFunctionRow[] }) {
  const [q, setQ] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<ContactFunctionRow | null>(null);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return functions
      .filter((f) => (showInactive ? true : f.is_active))
      .filter((f) => (!needle ? true : f.label.toLowerCase().includes(needle)))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [functions, q, showInactive]);

  const openNew = () => { setEdit(null); setOpen(true); };
  const openEdit = (f: ContactFunctionRow) => { setEdit(f); setOpen(true); };

  return (
    <div className="space-y-3">
      <Toolbar
        query={q} setQuery={setQ} showInactive={showInactive} setShowInactive={setShowInactive}
        onNew={openNew} newLabel="+ Neue Funktion" searchPlaceholder="Funktion suchen…"
      />

      <TableWrap>
        <thead><tr><Th>Bezeichnung</Th><Th>Status</Th><Th className="text-right">Aktionen</Th></tr></thead>
        <tbody>
          {rows.map((f) => (
            <tr key={f.id} className="border-t border-border">
              <Td className="font-medium">{f.label}</Td>
              <Td><StatusPill active={f.is_active} /></Td>
              <Td className="text-right"><div className="flex justify-end"><RowActions id={f.id} active={f.is_active} onEdit={() => openEdit(f)} toggleAction={setContactFunctionActive} /></div></Td>
            </tr>
          ))}
        </tbody>
      </TableWrap>

      <CardList>
        {rows.map((f) => (
          <div key={f.id} className="card p-3">
            <div className="flex items-center justify-between">
              <span className="font-medium text-foreground">{f.label}</span>
              <StatusPill active={f.is_active} />
            </div>
            <div className="mt-3"><RowActions id={f.id} active={f.is_active} onEdit={() => openEdit(f)} toggleAction={setContactFunctionActive} /></div>
          </div>
        ))}
      </CardList>

      {rows.length === 0 ? <EmptyState text="Keine Funktionen." /> : null}

      <MasterModal open={open} onClose={() => setOpen(false)} title={edit ? "Funktion bearbeiten" : "Neue Funktion"}>
        <ContactFunctionForm row={edit} onSaved={() => setOpen(false)} />
      </MasterModal>
    </div>
  );
}
