"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { saveQualification, setQualificationActive } from "@/lib/masterdata-actions";
import type { FormState } from "@/lib/incidents";
import type { QualificationRow } from "@/lib/qualifications";
import {
  QUALIFICATION_COLOR_KEYS,
  qualificationColorLabel,
  qualificationColorVars,
  isQualificationColorKey,
} from "@/lib/qualifications";
import {
  MasterModal, Toolbar, StatusPill, RowActions, FormError, FormActions,
  TableWrap, Th, Td, CardList, EmptyState, labelCls,
} from "@/components/masterdata/shared";

// AUFTRAG_14: pflegbarer Katalog "Qualifikationen" - Muster von
// TradesClient.tsx (0019), ergänzt um rank (Ganzzahl, größer = höher) und
// color (feste Palette aus src/lib/qualifications.ts statt Freitext/Hex).

const initial: FormState = { ok: false, error: null };

function ColorSwatch({ colorKey }: { colorKey: string }) {
  const key = isQualificationColorKey(colorKey) ? colorKey : "grau";
  const vars = qualificationColorVars(key);
  return (
    <span
      className="inline-block h-4 w-4 rounded-full border border-border align-middle"
      style={{ backgroundColor: vars.bg }}
      aria-hidden="true"
    />
  );
}

function QualificationForm({ row, onSaved }: { row: QualificationRow | null; onSaved: () => void }) {
  const [state, action, pending] = useActionState(saveQualification, initial);
  useEffect(() => { if (state.ok) onSaved(); }, [state.ok, onSaved]);
  return (
    <form action={action} className="space-y-3">
      {row ? <input type="hidden" name="id" value={row.id} /> : null}
      <FormError error={state.error} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className={labelCls} htmlFor="qual_label">Bezeichnung *</label>
          <input id="qual_label" name="label" required defaultValue={row?.label ?? ""} className="input" placeholder="z. B. Fachkraft" />
        </div>
        <div>
          <label className={labelCls} htmlFor="qual_rank">Rang (höher = wichtiger) *</label>
          <input
            id="qual_rank" name="rank" type="number" step={1} required
            defaultValue={row ? String(row.rank) : "0"} className="input"
          />
        </div>
        <div>
          <label className={labelCls} htmlFor="qual_color">Farbe *</label>
          <select id="qual_color" name="color" required defaultValue={row?.color ?? "grau"} className="input">
            {QUALIFICATION_COLOR_KEYS.map((key) => (
              <option key={key} value={key}>{qualificationColorLabel(key)}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls} htmlFor="qual_active">Status</label>
          <select id="qual_active" name="is_active" defaultValue={row ? String(row.is_active) : "true"} className="input">
            <option value="true">Aktiv</option>
            <option value="false">Inaktiv</option>
          </select>
        </div>
      </div>
      <FormActions pending={pending} />
    </form>
  );
}

export function QualificationsClient({ qualifications }: { qualifications: QualificationRow[] }) {
  const [q, setQ] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<QualificationRow | null>(null);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return qualifications
      .filter((r) => (showInactive ? true : r.is_active))
      .filter((r) => (!needle ? true : r.label.toLowerCase().includes(needle)))
      .sort((a, b) => b.rank - a.rank || a.label.localeCompare(b.label));
  }, [qualifications, q, showInactive]);

  const openNew = () => { setEdit(null); setOpen(true); };
  const openEdit = (r: QualificationRow) => { setEdit(r); setOpen(true); };

  return (
    <div className="space-y-3">
      <Toolbar
        query={q} setQuery={setQ} showInactive={showInactive} setShowInactive={setShowInactive}
        onNew={openNew} newLabel="+ Neue Qualifikation" searchPlaceholder="Qualifikation suchen…"
      />

      <TableWrap>
        <thead><tr><Th>Bezeichnung</Th><Th>Rang</Th><Th>Farbe</Th><Th>Status</Th><Th className="text-right">Aktionen</Th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-border">
              <Td className="font-medium">{r.label}</Td>
              <Td>{r.rank}</Td>
              <Td><ColorSwatch colorKey={r.color} /> <span className="ml-1 align-middle text-sm text-muted">{isQualificationColorKey(r.color) ? qualificationColorLabel(r.color) : r.color}</span></Td>
              <Td><StatusPill active={r.is_active} /></Td>
              <Td className="text-right"><div className="flex justify-end"><RowActions id={r.id} active={r.is_active} onEdit={() => openEdit(r)} toggleAction={setQualificationActive} /></div></Td>
            </tr>
          ))}
        </tbody>
      </TableWrap>

      <CardList>
        {rows.map((r) => (
          <div key={r.id} className="card p-3">
            <div className="flex items-center justify-between">
              <span className="font-medium text-foreground"><ColorSwatch colorKey={r.color} /> <span className="ml-1 align-middle">{r.label}</span></span>
              <StatusPill active={r.is_active} />
            </div>
            <div className="mt-1 text-sm text-muted">Rang {r.rank}</div>
            <div className="mt-3"><RowActions id={r.id} active={r.is_active} onEdit={() => openEdit(r)} toggleAction={setQualificationActive} /></div>
          </div>
        ))}
      </CardList>

      {rows.length === 0 ? <EmptyState text="Keine Qualifikationen." /> : null}

      <MasterModal open={open} onClose={() => setOpen(false)} title={edit ? "Qualifikation bearbeiten" : "Neue Qualifikation"}>
        <QualificationForm row={edit} onSaved={() => setOpen(false)} />
      </MasterModal>
    </div>
  );
}
