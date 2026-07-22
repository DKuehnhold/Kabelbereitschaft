"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { saveTeam, setTeamActive } from "@/lib/masterdata-actions";
import type { TeamRow, StageOption } from "@/lib/masterdata";
import type { FormState } from "@/lib/incidents";
import {
  MasterModal, Toolbar, StatusPill, RowActions, FormError, FormActions,
  TableWrap, Th, Td, CardList, EmptyState, labelCls,
} from "@/components/masterdata/shared";

const initial: FormState = { ok: false, error: null };

function TeamForm({
  row, onSaved, technicianOptions,
}: { row: TeamRow | null; onSaved: () => void; technicianOptions: StageOption[] }) {
  const [state, action, pending] = useActionState(saveTeam, initial);
  const [memberIds, setMemberIds] = useState<string[]>(row?.member_ids ?? []);
  useEffect(() => { if (state.ok) onSaved(); }, [state.ok, onSaved]);

  const toggle = (id: string) =>
    setMemberIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  return (
    <form action={action} className="space-y-3">
      {row ? <input type="hidden" name="id" value={row.id} /> : null}
      {memberIds.map((id) => <input key={id} type="hidden" name="member_ids" value={id} />)}
      <FormError error={state.error} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className={labelCls} htmlFor="t_name">Teamname *</label>
          <input id="t_name" name="name" required defaultValue={row?.name ?? ""} className="input" />
        </div>
        <div>
          <label className={labelCls} htmlFor="t_active">Status</label>
          <select id="t_active" name="is_active" defaultValue={row ? String(row.is_active) : "true"} className="input">
            <option value="true">Aktiv</option>
            <option value="false">Inaktiv</option>
          </select>
        </div>
      </div>

      <div>
        <span className={labelCls}>Mitglieder</span>
        <div className="grid max-h-56 grid-cols-1 gap-1 overflow-y-auto rounded-md border border-border p-2 sm:grid-cols-2">
          {technicianOptions.length === 0 ? <p className="text-xs text-muted">Keine aktiven Monteure vorhanden.</p> : null}
          {technicianOptions.map((t) => (
            <label key={t.id} className="flex items-center gap-2 text-sm text-foreground">
              <input type="checkbox" checked={memberIds.includes(t.id)} onChange={() => toggle(t.id)} />
              {t.label}
            </label>
          ))}
        </div>
        <p className="mt-1 text-xs text-muted">Ein Monteur darf Mitglied mehrerer Teams sein.</p>
      </div>

      <FormActions pending={pending} />
    </form>
  );
}

export function TeamsClient({
  teams, technicianOptions,
}: { teams: TeamRow[]; technicianOptions: StageOption[] }) {
  const [q, setQ] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<TeamRow | null>(null);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return teams
      .filter((t) => (showInactive ? true : t.is_active))
      .filter((t) => (!needle ? true : [t.name, ...t.member_names].join(" ").toLowerCase().includes(needle)))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [teams, q, showInactive]);

  const openNew = () => { setEdit(null); setOpen(true); };
  const openEdit = (t: TeamRow) => { setEdit(t); setOpen(true); };

  return (
    <div className="space-y-3">
      <Toolbar
        query={q} setQuery={setQ} showInactive={showInactive} setShowInactive={setShowInactive}
        onNew={openNew} newLabel="+ Neues Team" searchPlaceholder="Team / Mitglied suchen…"
      />

      <TableWrap>
        <thead><tr><Th>Team</Th><Th>Mitglieder</Th><Th>Status</Th><Th className="text-right">Aktionen</Th></tr></thead>
        <tbody>
          {rows.map((t) => (
            <tr key={t.id} className="border-t border-border">
              <Td className="font-medium">{t.name}</Td>
              <Td className="text-muted">{t.member_names.length ? t.member_names.join(", ") : "—"}</Td>
              <Td><StatusPill active={t.is_active} /></Td>
              <Td className="text-right"><div className="flex justify-end"><RowActions id={t.id} active={t.is_active} onEdit={() => openEdit(t)} toggleAction={setTeamActive} /></div></Td>
            </tr>
          ))}
        </tbody>
      </TableWrap>

      <CardList>
        {rows.map((t) => (
          <div key={t.id} className="card p-3">
            <div className="flex items-center justify-between">
              <span className="font-medium text-foreground">{t.name}</span>
              <StatusPill active={t.is_active} />
            </div>
            <div className="mt-1 text-sm text-muted">Mitglieder: {t.member_names.length ? t.member_names.join(", ") : "—"}</div>
            <div className="mt-3"><RowActions id={t.id} active={t.is_active} onEdit={() => openEdit(t)} toggleAction={setTeamActive} /></div>
          </div>
        ))}
      </CardList>

      {rows.length === 0 ? <EmptyState text="Keine Teams." /> : null}

      <MasterModal open={open} onClose={() => setOpen(false)} title={edit ? "Team bearbeiten" : "Neues Team"}>
        <TeamForm row={edit} onSaved={() => setOpen(false)} technicianOptions={technicianOptions} />
      </MasterModal>
    </div>
  );
}
