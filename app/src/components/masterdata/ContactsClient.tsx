"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { saveContact, setContactActive } from "@/lib/masterdata-actions";
import type { ContactRow, CustomerRow, StageOption } from "@/lib/masterdata";
import { PHONE_TYPES, PHONE_TYPE_LABELS, type PhoneType } from "@/lib/status";
import type { FormState } from "@/lib/incidents";
import {
  MasterModal, Toolbar, StatusPill, RowActions, FormError, FormActions,
  TableWrap, Th, Td, CardList, EmptyState, labelCls,
} from "@/components/masterdata/shared";

const initial: FormState = { ok: false, error: null };
type PhoneEntry = { phone: string; phone_type: PhoneType };

function ContactForm({
  row, onSaved, customers, stageOptions,
}: {
  row: ContactRow | null;
  onSaved: () => void;
  customers: CustomerRow[];
  stageOptions: StageOption[];
}) {
  const [state, action, pending] = useActionState(saveContact, initial);
  const [phones, setPhones] = useState<PhoneEntry[]>(
    row?.phones.length ? row.phones.map((p) => ({ phone: p.phone, phone_type: p.phone_type })) : [{ phone: "", phone_type: "mobil" }],
  );
  const [stageIds, setStageIds] = useState<string[]>(row?.stage_ids ?? []);
  useEffect(() => { if (state.ok) onSaved(); }, [state.ok, onSaved]);

  const setPhone = (i: number, patch: Partial<PhoneEntry>) =>
    setPhones((prev) => prev.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  const addPhone = () => setPhones((prev) => [...prev, { phone: "", phone_type: "sonstige" }]);
  const removePhone = (i: number) => setPhones((prev) => prev.filter((_, idx) => idx !== i));
  const toggleStage = (id: string) =>
    setStageIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const phonesJson = JSON.stringify(phones.filter((p) => p.phone.trim() !== ""));

  return (
    <form action={action} className="space-y-3">
      {row ? <input type="hidden" name="id" value={row.id} /> : null}
      <input type="hidden" name="phones_json" value={phonesJson} />
      {stageIds.map((id) => <input key={id} type="hidden" name="stage_ids" value={id} />)}
      <FormError error={state.error} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className={labelCls} htmlFor="k_customer">Kunde *</label>
          <select id="k_customer" name="customer_id" required defaultValue={row?.customer_id ?? ""} className="input">
            <option value="">Bitte wählen…</option>
            {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls} htmlFor="k_name">Name *</label>
          <input id="k_name" name="name" required defaultValue={row?.name ?? ""} className="input" />
        </div>
        <div>
          <label className={labelCls} htmlFor="k_func">Funktion</label>
          <input id="k_func" name="function" defaultValue={row?.function ?? ""} className="input" />
        </div>
        <div>
          <label className={labelCls} htmlFor="k_email">E-Mail</label>
          <input id="k_email" name="email" type="email" defaultValue={row?.email ?? ""} className="input" />
        </div>
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between">
          <span className={labelCls}>Telefonnummern</span>
          <button type="button" onClick={addPhone} className="btn btn-outline px-3 py-1.5">+ Nummer</button>
        </div>
        <div className="space-y-2">
          {phones.map((p, i) => (
            <div key={i} className="flex gap-2">
              <input
                className="input" placeholder="Telefonnummer" value={p.phone}
                onChange={(e) => setPhone(i, { phone: e.target.value })} aria-label={`Telefonnummer ${i + 1}`}
              />
              <select
                className="input max-w-[160px]" value={p.phone_type}
                onChange={(e) => setPhone(i, { phone_type: e.target.value as PhoneType })} aria-label={`Typ ${i + 1}`}
              >
                {PHONE_TYPES.map((t) => <option key={t} value={t}>{PHONE_TYPE_LABELS[t]}</option>)}
              </select>
              <button
                type="button" onClick={() => removePhone(i)} aria-label="Nummer entfernen"
                className="btn btn-outline px-3 py-1.5" style={{ color: "var(--danger)", borderColor: "var(--danger)" }}
              >
                Entfernen
              </button>
            </div>
          ))}
          {phones.length === 0 ? <p className="text-xs text-muted">Keine Telefonnummer hinterlegt.</p> : null}
        </div>
      </div>

      <div>
        <span className={labelCls}>Zugeordnete Bauabschnitte</span>
        <div className="grid max-h-40 grid-cols-1 gap-1 overflow-y-auto rounded-md border border-border p-2 sm:grid-cols-2">
          {stageOptions.length === 0 ? <p className="text-xs text-muted">Keine aktiven Bauabschnitte vorhanden.</p> : null}
          {stageOptions.map((s) => (
            <label key={s.id} className="flex items-center gap-2 text-sm text-foreground">
              <input type="checkbox" checked={stageIds.includes(s.id)} onChange={() => toggleStage(s.id)} />
              {s.label}
            </label>
          ))}
        </div>
      </div>

      <div className="max-w-[200px]">
        <label className={labelCls} htmlFor="k_active">Status</label>
        <select id="k_active" name="is_active" defaultValue={row ? String(row.is_active) : "true"} className="input">
          <option value="true">Aktiv</option>
          <option value="false">Inaktiv</option>
        </select>
      </div>

      <FormActions pending={pending} />
    </form>
  );
}

export function ContactsClient({
  contacts, customers, stageOptions,
}: { contacts: ContactRow[]; customers: CustomerRow[]; stageOptions: StageOption[] }) {
  const [q, setQ] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<ContactRow | null>(null);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return contacts
      .filter((c) => (showInactive ? true : c.is_active))
      .filter((c) => (!needle ? true : [c.name, c.customer_name, c.function, c.email, ...c.phones.map((p) => p.phone)].filter(Boolean).join(" ").toLowerCase().includes(needle)))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [contacts, q, showInactive]);

  const openNew = () => { setEdit(null); setOpen(true); };
  const openEdit = (c: ContactRow) => { setEdit(c); setOpen(true); };

  return (
    <div className="space-y-3">
      <Toolbar
        query={q} setQuery={setQ} showInactive={showInactive} setShowInactive={setShowInactive}
        onNew={openNew} newLabel="+ Neuer Ansprechpartner" searchPlaceholder="Name / Kunde / Nummer suchen…"
      />

      <TableWrap>
        <thead><tr><Th>Name</Th><Th>Kunde</Th><Th>Funktion</Th><Th>Telefon</Th><Th>Bauabschnitte</Th><Th>Status</Th><Th className="text-right">Aktionen</Th></tr></thead>
        <tbody>
          {rows.map((c) => (
            <tr key={c.id} className="border-t border-border">
              <Td className="font-medium">{c.name}</Td>
              <Td className="text-muted">{c.customer_name}</Td>
              <Td className="text-muted">{c.function ?? "—"}</Td>
              <Td className="text-muted">{c.phones.length ? `${c.phones[0].phone}${c.phones.length > 1 ? ` (+${c.phones.length - 1})` : ""}` : "—"}</Td>
              <Td className="text-muted">{c.stage_ids.length}</Td>
              <Td><StatusPill active={c.is_active} /></Td>
              <Td className="text-right"><div className="flex justify-end"><RowActions id={c.id} active={c.is_active} onEdit={() => openEdit(c)} toggleAction={setContactActive} /></div></Td>
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
            <div className="mt-1 text-sm text-muted">{c.customer_name}{c.function ? ` · ${c.function}` : ""}</div>
            <div className="text-sm text-muted">Tel.: {c.phones.length ? c.phones.map((p) => p.phone).join(", ") : "—"}</div>
            <div className="text-sm text-muted">Bauabschnitte: {c.stage_ids.length}</div>
            <div className="mt-3"><RowActions id={c.id} active={c.is_active} onEdit={() => openEdit(c)} toggleAction={setContactActive} /></div>
          </div>
        ))}
      </CardList>

      {rows.length === 0 ? <EmptyState text="Keine Ansprechpartner." /> : null}

      <MasterModal open={open} onClose={() => setOpen(false)} title={edit ? "Ansprechpartner bearbeiten" : "Neuer Ansprechpartner"}>
        <ContactForm row={edit} onSaved={() => setOpen(false)} customers={customers} stageOptions={stageOptions} />
      </MasterModal>
    </div>
  );
}
