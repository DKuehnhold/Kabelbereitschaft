"use client";

import { useActionState } from "react";
import Link from "next/link";
import { updateIncident } from "@/lib/incident-actions";
import { PRIORITIES, PRIORITY_LABELS } from "@/lib/priority";
import type { FormState, IncidentRow } from "@/lib/incidents";

type Opt = { id: string; label: string };
const initial: FormState = { ok: true, error: null };
const field = "rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 w-full";
const label = "mb-1 block text-sm font-medium text-slate-700";

export function EditIncidentForm({
  incident,
  stages,
  oncall,
}: {
  incident: IncidentRow;
  stages: Opt[];
  oncall: Opt[];
}) {
  const [state, formAction, pending] = useActionState(updateIncident, initial);
  const i = incident;

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="id" value={i.id} />
      {state.error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</div>
      ) : null}

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase text-slate-500">Einordnung</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className={label} htmlFor="construction_stage_id">Baustufe</label>
            <select id="construction_stage_id" name="construction_stage_id" defaultValue={i.construction_stage_id} className={field}>
              {stages.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </div>
          <div>
            <label className={label} htmlFor="on_call_number_id">Bereitschaftsnummer</label>
            <select id="on_call_number_id" name="on_call_number_id" defaultValue={i.on_call_number_id ?? ""} className={field}>
              <option value="">—</option>
              {oncall.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label className={label} htmlFor="priority">Priorität</label>
            <select id="priority" name="priority" defaultValue={i.priority} className={field}>
              {PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>)}
            </select>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase text-slate-500">Standort</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div><label className={label} htmlFor="vzg_line_number">VzG *</label><input id="vzg_line_number" name="vzg_line_number" required defaultValue={i.vzg_line_number} className={field} /></div>
          <div><label className={label} htmlFor="km_from">Kilometer von *</label><input id="km_from" name="km_from" required inputMode="decimal" defaultValue={String(i.km_from)} className={field} /></div>
          <div><label className={label} htmlFor="km_to">Kilometer bis</label><input id="km_to" name="km_to" inputMode="decimal" defaultValue={i.km_to != null ? String(i.km_to) : ""} className={field} /></div>
          <div><label className={label} htmlFor="operating_point">Betriebsstelle</label><input id="operating_point" name="operating_point" defaultValue={i.operating_point ?? ""} className={field} /></div>
          <div><label className={label} htmlFor="track">Gleis</label><input id="track" name="track" defaultValue={i.track ?? ""} className={field} /></div>
          <div><label className={label} htmlFor="direction">Richtung</label><input id="direction" name="direction" defaultValue={i.direction ?? ""} className={field} /></div>
          <div><label className={label} htmlFor="object_type">Objektart</label><input id="object_type" name="object_type" defaultValue={i.object_type ?? ""} className={field} /></div>
          <div><label className={label} htmlFor="object_designation">Objektbezeichnung</label><input id="object_designation" name="object_designation" defaultValue={i.object_designation ?? ""} className={field} /></div>
          <div><label className={label} htmlFor="external_reference">Externe Referenz</label><input id="external_reference" name="external_reference" defaultValue={i.external_reference ?? ""} className={field} /></div>
        </div>
        <div className="mt-4"><label className={label} htmlFor="location_description">Ortsbeschreibung</label><textarea id="location_description" name="location_description" rows={2} defaultValue={i.location_description ?? ""} className={field} /></div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase text-slate-500">Meldung & Bemerkungen</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div><label className={label} htmlFor="caller_name">DB-Ansprechpartner</label><input id="caller_name" name="caller_name" defaultValue={i.caller_name ?? ""} className={field} /></div>
          <div><label className={label} htmlFor="caller_contact">Telefon</label><input id="caller_contact" name="caller_contact" defaultValue={i.caller_contact ?? ""} className={field} /></div>
        </div>
        <div className="mt-4"><label className={label} htmlFor="description">Beschreibung</label><textarea id="description" name="description" rows={3} defaultValue={i.description ?? ""} className={field} /></div>
        <div className="mt-4"><label className={label} htmlFor="internal_note">Interne Bemerkung</label><textarea id="internal_note" name="internal_note" rows={2} defaultValue={i.internal_note ?? ""} className={field} /></div>
      </section>

      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className="rounded-md bg-blue-900 px-5 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-60">
          {pending ? "Speichern…" : "Änderungen speichern"}
        </button>
        <Link href={`/vorgaenge/${i.id}`} className="text-sm text-slate-500 hover:underline">Abbrechen</Link>
      </div>
    </form>
  );
}
