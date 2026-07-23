"use client";

import { useActionState, useMemo, useState } from "react";
import Link from "next/link";
import { updateIncident } from "@/lib/incident-actions";
import { PRIORITIES, PRIORITY_LABELS } from "@/lib/priority";
import type { FormState, IncidentRow, IncidentFormOptions } from "@/lib/incidents";

const initial: FormState = { ok: false, error: null };
const labelCls = "mb-1 block text-sm font-medium text-foreground";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card p-4">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">{title}</h2>
      {children}
    </section>
  );
}

export function EditIncidentForm({
  incident,
  options,
}: {
  incident: IncidentRow;
  options: IncidentFormOptions;
}) {
  const [state, formAction, pending] = useActionState(updateIncident, initial);
  const i = incident;
  const firstPos = i.cable_positions?.[0];

  // Bereits referenzierte, aber ggf. inaktive Stammdaten sichtbar einblenden.
  const customers = useMemo(() => {
    const list = options.customers.map((c) => ({ id: c.id, name: c.name }));
    if (i.customer_id && !list.some((c) => c.id === i.customer_id))
      list.push({ id: i.customer_id, name: `${i.customer?.name ?? "unbekannt"} (inaktiv)` });
    return list;
  }, [options.customers, i.customer_id, i.customer]);

  const stages = useMemo(() => {
    const list = options.stages.map((s) => ({ ...s }));
    if (i.construction_stage_id && !list.some((s) => s.id === i.construction_stage_id))
      list.push({
        id: i.construction_stage_id,
        label: `${i.stage ? (i.stage.code ? `${i.stage.code} – ${i.stage.name}` : i.stage.name) : "unbekannt"} (inaktiv)`,
        default_on_call_number_id: null,
      });
    return list;
  }, [options.stages, i.construction_stage_id, i.stage]);

  const vzgLines = useMemo(() => {
    const list = options.vzgLines.map((v) => ({ ...v }));
    if (i.vzg_line_id && !list.some((v) => v.id === i.vzg_line_id))
      list.push({
        id: i.vzg_line_id,
        line_number: `${i.vzgline?.line_number ?? i.vzg_line_number ?? "?"} (inaktiv)`,
        construction_stage_id: i.construction_stage_id,
      });
    return list;
  }, [options.vzgLines, i.vzg_line_id, i.vzgline, i.vzg_line_number, i.construction_stage_id]);

  const onCall = useMemo(() => {
    const list = options.onCall.map((o) => ({ ...o }));
    if (i.on_call_number_id && !list.some((o) => o.id === i.on_call_number_id))
      list.push({
        id: i.on_call_number_id,
        label: `${i.oncall ? (i.oncall.label ? `${i.oncall.number} – ${i.oncall.label}` : i.oncall.number) : "unbekannt"} (inaktiv)`,
      });
    return list;
  }, [options.onCall, i.on_call_number_id, i.oncall]);

  const cableTypes = useMemo(() => {
    const list = options.cableTypes.map((t) => ({ ...t }));
    if (firstPos && !list.some((t) => t.id === firstPos.cable_type_id))
      list.push({ id: firstPos.cable_type_id, code: "", name: `${firstPos.cable_type?.name ?? "unbekannt"} (inaktiv)` });
    return list;
  }, [options.cableTypes, firstPos]);

  const [customerId, setCustomerId] = useState(i.customer_id ?? "");
  const [stageId, setStageId] = useState(i.construction_stage_id ?? "");
  const [vzgId, setVzgId] = useState(i.vzg_line_id ?? "");
  const [onCallId, setOnCallId] = useState(i.on_call_number_id ?? "");
  const [cableId, setCableId] = useState(firstPos?.cable_type_id ?? "");
  const [priority, setPriority] = useState(i.priority);

  const vzgOptions = useMemo(
    () => vzgLines.filter((v) => v.construction_stage_id === stageId),
    [vzgLines, stageId],
  );

  const onStageChange = (id: string) => {
    setStageId(id);
    setVzgId((cur) => (vzgLines.some((v) => v.id === cur && v.construction_stage_id === id) ? cur : ""));
    const stage = stages.find((s) => s.id === id);
    if (stage?.default_on_call_number_id) setOnCallId(stage.default_on_call_number_id);
  };

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="id" value={i.id} />
      {state.error ? (
        <div
          role="alert"
          className="rounded-md border px-3 py-2 text-sm"
          style={{ background: "var(--danger-bg)", color: "var(--danger)", borderColor: "var(--danger)" }}
        >
          {state.error}
        </div>
      ) : null}

      <Section title="Zuordnung">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={labelCls} htmlFor="customer_id">Kunde *</label>
            <select id="customer_id" name="customer_id" required value={customerId} onChange={(e) => setCustomerId(e.target.value)} className="input">
              <option value="">Bitte wählen…</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls} htmlFor="construction_stage_id">Bauabschnitt *</label>
            <select id="construction_stage_id" name="construction_stage_id" required value={stageId} onChange={(e) => onStageChange(e.target.value)} className="input">
              <option value="">Bitte wählen…</option>
              {stages.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls} htmlFor="vzg_line_id">VzG-Strecke *</label>
            <select id="vzg_line_id" name="vzg_line_id" required value={vzgId} onChange={(e) => setVzgId(e.target.value)} disabled={!stageId} className="input">
              <option value="">{stageId ? "Bitte wählen…" : "Zuerst Bauabschnitt wählen"}</option>
              {vzgOptions.map((v) => <option key={v.id} value={v.id}>{v.line_number}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls} htmlFor="on_call_number_id">Bereitschaftsnummer</label>
            <select id="on_call_number_id" name="on_call_number_id" value={onCallId} onChange={(e) => setOnCallId(e.target.value)} className="input">
              <option value="">— keine —</option>
              {onCall.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
          </div>
        </div>
      </Section>

      <Section title="Störung & Kabel">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={labelCls} htmlFor="priority">Priorität *</label>
            <select id="priority" name="priority" required value={priority} onChange={(e) => setPriority(e.target.value as typeof priority)} className="input">
              {PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls} htmlFor="cable_type_id">Kabelart *</label>
            <select id="cable_type_id" name="cable_type_id" required value={cableId} onChange={(e) => setCableId(e.target.value)} className="input">
              <option value="">Bitte wählen…</option>
              {cableTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
        </div>
        <div className="mt-4">
          <label className={labelCls} htmlFor="description">Beschreibung *</label>
          <textarea id="description" name="description" rows={3} required defaultValue={i.description ?? ""} className="input" />
        </div>
      </Section>

      <Section title="Ort & Objekt (optional)">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div><label className={labelCls} htmlFor="operating_point">Betriebsstelle</label><input id="operating_point" name="operating_point" defaultValue={i.operating_point ?? ""} className="input" /></div>
          <div><label className={labelCls} htmlFor="track">Gleis</label><input id="track" name="track" defaultValue={i.track ?? ""} className="input" /></div>
          <div><label className={labelCls} htmlFor="km_from">Streckenkilometer von</label><input id="km_from" name="km_from" inputMode="decimal" defaultValue={i.km_from != null ? String(i.km_from) : ""} className="input" /></div>
          <div><label className={labelCls} htmlFor="km_to">Streckenkilometer bis</label><input id="km_to" name="km_to" inputMode="decimal" defaultValue={i.km_to != null ? String(i.km_to) : ""} className="input" /></div>
          <div><label className={labelCls} htmlFor="direction">Richtung</label><input id="direction" name="direction" defaultValue={i.direction ?? ""} className="input" /></div>
          <div><label className={labelCls} htmlFor="object_type">Objektart</label><input id="object_type" name="object_type" defaultValue={i.object_type ?? ""} className="input" /></div>
          <div><label className={labelCls} htmlFor="object_designation">Objektbezeichnung</label><input id="object_designation" name="object_designation" defaultValue={i.object_designation ?? ""} className="input" /></div>
        </div>
        <div className="mt-4">
          <label className={labelCls} htmlFor="location_description">Ortsbeschreibung</label>
          <textarea id="location_description" name="location_description" rows={2} defaultValue={i.location_description ?? ""} className="input" />
        </div>
      </Section>

      <Section title="Meldung & Bemerkungen (optional)">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div><label className={labelCls} htmlFor="caller_name">Anrufer/Ansprechpartner</label><input id="caller_name" name="caller_name" defaultValue={i.caller_name ?? ""} className="input" /></div>
          <div><label className={labelCls} htmlFor="caller_contact">Telefon</label><input id="caller_contact" name="caller_contact" defaultValue={i.caller_contact ?? ""} className="input" /></div>
          <div><label className={labelCls} htmlFor="external_reference">Externe Referenz</label><input id="external_reference" name="external_reference" defaultValue={i.external_reference ?? ""} className="input" /></div>
        </div>
        <div className="mt-4">
          <label className={labelCls} htmlFor="internal_note">Interne Bemerkung</label>
          <textarea id="internal_note" name="internal_note" rows={2} defaultValue={i.internal_note ?? ""} className="input" />
        </div>
      </Section>

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className="btn btn-primary">
          {pending ? "Speichern…" : "Änderungen speichern"}
        </button>
        <Link href={`/vorgaenge/${i.id}`} className="btn btn-outline">Abbrechen</Link>
      </div>
    </form>
  );
}
