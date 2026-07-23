"use client";

import { useActionState, useMemo, useState } from "react";
import { createIncident } from "@/lib/incident-actions";
import { PRIORITIES, PRIORITY_LABELS } from "@/lib/priority";
import type { FormState, IncidentFormOptions } from "@/lib/incidents";

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

export function NewIncidentForm({ options }: { options: IncidentFormOptions }) {
  const [state, formAction, pending] = useActionState(createIncident, initial);

  const defaultCustomer =
    options.defaults.customer_id && options.customers.some((c) => c.id === options.defaults.customer_id)
      ? options.defaults.customer_id
      : "";

  const [customerId, setCustomerId] = useState(defaultCustomer);
  const [stageId, setStageId] = useState("");
  const [vzgId, setVzgId] = useState("");
  const [onCallId, setOnCallId] = useState("");
  const [cableId, setCableId] = useState("");
  const [priority, setPriority] = useState<(typeof PRIORITIES)[number]>("normal");

  const vzgOptions = useMemo(
    () => options.vzgLines.filter((v) => v.construction_stage_id === stageId),
    [options.vzgLines, stageId],
  );

  const onStageChange = (id: string) => {
    setStageId(id);
    setVzgId((cur) => (options.vzgLines.some((v) => v.id === cur && v.construction_stage_id === id) ? cur : ""));
    const stage = options.stages.find((s) => s.id === id);
    setOnCallId(stage?.default_on_call_number_id ?? options.defaults.on_call_number_id ?? "");
  };

  return (
    <form action={formAction} className="space-y-5">
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
              {options.customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls} htmlFor="construction_stage_id">Bauabschnitt *</label>
            <select id="construction_stage_id" name="construction_stage_id" required value={stageId} onChange={(e) => onStageChange(e.target.value)} className="input">
              <option value="">Bitte wählen…</option>
              {options.stages.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
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
              {options.onCall.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
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
              {options.cableTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <p className="mt-1 text-xs text-muted">Erste Kabelposition; weitere Positionen folgen in einem späteren Ausbau.</p>
          </div>
        </div>
        <div className="mt-4">
          <label className={labelCls} htmlFor="description">Beschreibung *</label>
          <textarea id="description" name="description" rows={3} required className="input" />
        </div>
      </Section>

      <Section title="Ort & Objekt (optional)">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div><label className={labelCls} htmlFor="operating_point">Betriebsstelle</label><input id="operating_point" name="operating_point" className="input" /></div>
          <div><label className={labelCls} htmlFor="track">Gleis</label><input id="track" name="track" className="input" /></div>
          <div><label className={labelCls} htmlFor="km_from">Streckenkilometer von</label><input id="km_from" name="km_from" inputMode="decimal" placeholder="z. B. 12,500" className="input" /></div>
          <div><label className={labelCls} htmlFor="km_to">Streckenkilometer bis</label><input id="km_to" name="km_to" inputMode="decimal" className="input" /></div>
          <div><label className={labelCls} htmlFor="direction">Richtung</label><input id="direction" name="direction" className="input" /></div>
          <div><label className={labelCls} htmlFor="object_type">Objektart</label><input id="object_type" name="object_type" className="input" /></div>
          <div><label className={labelCls} htmlFor="object_designation">Objektbezeichnung</label><input id="object_designation" name="object_designation" className="input" /></div>
        </div>
        <div className="mt-4">
          <label className={labelCls} htmlFor="location_description">Ortsbeschreibung</label>
          <textarea id="location_description" name="location_description" rows={2} className="input" />
        </div>
      </Section>

      <Section title="Meldung & Bemerkungen (optional)">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div><label className={labelCls} htmlFor="caller_name">Anrufer/Ansprechpartner</label><input id="caller_name" name="caller_name" className="input" /></div>
          <div><label className={labelCls} htmlFor="caller_contact">Telefon</label><input id="caller_contact" name="caller_contact" className="input" /></div>
          <div><label className={labelCls} htmlFor="external_reference">Externe Referenz</label><input id="external_reference" name="external_reference" className="input" /></div>
        </div>
        <div className="mt-4">
          <label className={labelCls} htmlFor="internal_note">Interne Bemerkung</label>
          <textarea id="internal_note" name="internal_note" rows={2} className="input" />
        </div>
      </Section>

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className="btn btn-primary">
          {pending ? "Speichern…" : "Vorgang anlegen"}
        </button>
        <span className="text-xs text-muted">
          Nach dem Speichern öffnet sich die Vorgangsseite – Bilder werden dort ergänzt. Status wird auf Neu gesetzt.
        </span>
      </div>
    </form>
  );
}
