"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { saveObjectType, setObjectTypeActive } from "@/lib/masterdata-actions";
import type { ObjectTypeRow } from "@/lib/masterdata";
import type { FormState } from "@/lib/incidents";
import {
  MasterModal, Toolbar, StatusPill, RowActions, FormError, FormActions,
  TableWrap, Th, Td, CardList, EmptyState, labelCls,
} from "@/components/masterdata/shared";

// AUFTRAG_6: pflegbarer Katalog "Objektarten" (Anlagen, inkl. LST-Elemente) -
// exaktes Muster von CableTypesClient.tsx, aber ohne code/sort_order
// (Tabellenform laut Auftrag nur id/label/is_active,
// 0019_hlk_katalog_stammdaten.sql Abschnitt 3).

const initial: FormState = { ok: false, error: null };

function ObjectTypeForm({ row, onSaved }: { row: ObjectTypeRow | null; onSaved: () => void }) {
  const [state, action, pending] = useActionState(saveObjectType, initial);
  useEffect(() => { if (state.ok) onSaved(); }, [state.ok, onSaved]);
  return (
    <form action={action} className="space-y-3">
      {row ? <input type="hidden" name="id" value={row.id} /> : null}
      <FormError error={state.error} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className={labelCls} htmlFor="ot_label">Bezeichnung *</label>
          <input id="ot_label" name="label" required defaultValue={row?.label ?? ""} className="input" placeholder="z. B. BÜ" />
        </div>
        <div>
          <label className={labelCls} htmlFor="ot_active">Status</label>
          <select id="ot_active" name="is_active" defaultValue={row ? String(row.is_active) : "true"} className="input">
            <option value="true">Aktiv</option>
            <option value="false">Inaktiv</option>
          </select>
        </div>
      </div>
      <FormActions pending={pending} />
    </form>
  );
}

export function ObjectTypesClient({ objectTypes }: { objectTypes: ObjectTypeRow[] }) {
  const [q, setQ] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<ObjectTypeRow | null>(null);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return objectTypes
      .filter((o) => (showInactive ? true : o.is_active))
      .filter((o) => (!needle ? true : o.label.toLowerCase().includes(needle)))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [objectTypes, q, showInactive]);

  const openNew = () => { setEdit(null); setOpen(true); };
  const openEdit = (o: ObjectTypeRow) => { setEdit(o); setOpen(true); };

  return (
    <div className="space-y-3">
      <Toolbar
        query={q} setQuery={setQ} showInactive={showInactive} setShowInactive={setShowInactive}
        onNew={openNew} newLabel="+ Neue Objektart" searchPlaceholder="Objektart suchen…"
      />

      <TableWrap>
        <thead><tr><Th>Bezeichnung</Th><Th>Status</Th><Th className="text-right">Aktionen</Th></tr></thead>
        <tbody>
          {rows.map((o) => (
            <tr key={o.id} className="border-t border-border">
              <Td className="font-medium">{o.label}</Td>
              <Td><StatusPill active={o.is_active} /></Td>
              <Td className="text-right"><div className="flex justify-end"><RowActions id={o.id} active={o.is_active} onEdit={() => openEdit(o)} toggleAction={setObjectTypeActive} /></div></Td>
            </tr>
          ))}
        </tbody>
      </TableWrap>

      <CardList>
        {rows.map((o) => (
          <div key={o.id} className="card p-3">
            <div className="flex items-center justify-between">
              <span className="font-medium text-foreground">{o.label}</span>
              <StatusPill active={o.is_active} />
            </div>
            <div className="mt-3"><RowActions id={o.id} active={o.is_active} onEdit={() => openEdit(o)} toggleAction={setObjectTypeActive} /></div>
          </div>
        ))}
      </CardList>

      {rows.length === 0 ? <EmptyState text="Keine Objektarten." /> : null}

      <MasterModal open={open} onClose={() => setOpen(false)} title={edit ? "Objektart bearbeiten" : "Neue Objektart"}>
        <ObjectTypeForm row={edit} onSaved={() => setOpen(false)} />
      </MasterModal>
    </div>
  );
}
