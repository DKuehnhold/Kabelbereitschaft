"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { ChevronDownIcon } from "lucide-react";
import { createIncident } from "@/lib/incident-actions";
import { PRIORITIES, PRIORITY_LABELS } from "@/lib/priority";
import type { FormState, IncidentFormOptions } from "@/lib/incidents";
import { formatBerlinDatetimeLocal } from "@/lib/date-local";
import { CablePositionsEditor } from "@/components/incidents/CablePositionsEditor";
import { ContactSelector } from "@/components/incidents/ContactSelector";
import { Button } from "@/components/ui/shadcn/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/shadcn/collapsible";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/shadcn/toggle-group";

// Muss mit dem `form`-Attribut der Primäraktion oben in
// app/src/app/(app)/vorgaenge/neu/page.tsx übereinstimmen (HTML5-Formularbindung
// über getrennte DOM-Bäume hinweg, kein gemeinsames Modul nötig).
export const NEW_INCIDENT_FORM_ID = "new-incident-form";

const initial: FormState = { ok: false, error: null };
const labelCls = "mb-1 block text-sm font-medium text-foreground";
// AUFTRAG_5, Punkt 6: Mindest-Touchziel 44px für alle in dieser Datei direkt
// gerenderten Bedienelemente. Die bestehende `.input`/`.btn`-Klasse aus
// globals.css definiert 2.5rem (40px) und wird NICHT verändert (Negativliste).
// Inline-Style überschreibt zuverlässig unabhängig von der CSS-Kaskadenreihenfolge.
const touchStyle = { minHeight: "44px" } as const;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card h-full p-4">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">{title}</h2>
      {children}
    </section>
  );
}

// Eingeklappter, optionaler Abschnitt. WICHTIG: `CollapsibleContent` bekommt
// `forceMount`, damit Radix die Inputs beim Zuklappen NICHT aus dem DOM entfernt
// (Standardverhalten von Radix Collapsible ohne forceMount: Presence-Unmount nach
// der Schließanimation → unkontrollierte Eingaben würden verloren gehen). Das
// Ein-/Ausblenden erfolgt stattdessen rein visuell über die Tailwind-Variante
// `data-[state=closed]:hidden` (entspricht `display:none`). Ein per CSS
// verstecktes Formularfeld wird von `FormData`/nativer Formularübermittlung
// trotzdem berücksichtigt (nur `disabled` oder ein fehlendes `name`-Attribut
// schließen ein Feld aus) - die Werte bleiben also sowohl im React-Baum als auch
// im übermittelten FormData erhalten. Bewusster Verzicht auf die Standard-
// Höhenanimation von Radix Collapsible (die auf dem Unmount-Verhalten aufbaut);
// das ist eine gleichwertige, einfachere Lösung ohne Funktionsverlust.
function OptionalSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Collapsible defaultOpen={false} className="card p-4">
      <CollapsibleTrigger
        className="group flex w-full items-center justify-between gap-2 text-left text-sm font-semibold uppercase tracking-wide text-muted"
        style={touchStyle}
      >
        <span>
          {title} <span className="text-xs font-normal normal-case text-muted">(optional)</span>
        </span>
        <ChevronDownIcon className="size-4 shrink-0 transition-transform group-data-[state=open]:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent forceMount className="mt-3 space-y-4 data-[state=closed]:hidden">
        {children}
      </CollapsibleContent>
    </Collapsible>
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
  const [priority, setPriority] = useState<(typeof PRIORITIES)[number]>("normal");
  // AUFTRAG_7: Anrufzeit, vorbelegt mit "jetzt" (Europe/Berlin), editierbar,
  // optional. Die Vorbelegung erfolgt erst in einem Effekt NACH dem ersten
  // Rendern (leerer Startwert bei Server- und Client-Rendering identisch) -
  // sonst wichen der auf dem Server berechnete und der beim Hydrieren auf dem
  // Client berechnete Zeitpunkt voneinander ab (Hydration-Mismatch).
  const [reportedAt, setReportedAt] = useState("");
  useEffect(() => {
    // Einmaliges Vorbelegen mit "jetzt" (Europe/Berlin). Bewusst im Effect, um
    // Hydration-Mismatch zu vermeiden (Server und Client würden sonst zu
    // unterschiedlichen Zeitpunkten rendern) - dasselbe Muster wie in
    // ThemeToggle.tsx.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setReportedAt(formatBerlinDatetimeLocal(new Date()));
  }, []);
  // AUFTRAG_7: Anrufender - einfaches Select über die bestehende Kontaktliste
  // (options.contacts), unabhängig vom Ansprechpartner-Feld des
  // ContactSelector (contact_id/contact_phone_number_id). Der bestehende
  // ContactSelector eignet sich hier NICHT: er bindet seine <select>-Elemente
  // fest an die Namen "contact_id"/"contact_phone_number_id" - eine zweite
  // Einbindung würde denselben FormData-Schlüssel doppelt belegen und
  // contact_id für den Ansprechpartner-Datenpfad verfälschen (Stopppunkt-Fall
  // aus AUFTRAG_7.md, hier gelöst über ein einfaches Select mit Bestandsmitteln).
  const [callerContactId, setCallerContactId] = useState("");
  const callerContacts = useMemo(
    () => options.contacts.filter((c) => c.customer_id === customerId),
    [options.contacts, customerId],
  );
  const selectedCallerContactId = callerContacts.some((c) => c.id === callerContactId) ? callerContactId : "";
  const [tradeId, setTradeId] = useState("");

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
    <form id={NEW_INCIDENT_FORM_ID} action={formAction} className="space-y-5 pb-24 md:pb-8">
      {state.error ? (
        <div
          role="alert"
          className="rounded-md border px-3 py-2 text-sm"
          style={{ background: "var(--danger-bg)", color: "var(--danger)", borderColor: "var(--danger)" }}
        >
          {state.error}
        </div>
      ) : null}

      {/* Desktop (md+): zwei Spalten - links Zuordnung, rechts Störung. Mobil: eine Spalte,
          Zuordnung vor Störung (DOM-Reihenfolge bleibt gleich, nur das Grid greift ab md). */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 md:items-start">
        <Section title="Zuordnung">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={labelCls} htmlFor="customer_id">Kunde *</label>
              <select
                id="customer_id"
                name="customer_id"
                required
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                className="input"
                style={touchStyle}
              >
                <option value="">Bitte wählen…</option>
                {options.customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls} htmlFor="construction_stage_id">Bauabschnitt *</label>
              <select
                id="construction_stage_id"
                name="construction_stage_id"
                required
                value={stageId}
                onChange={(e) => onStageChange(e.target.value)}
                className="input"
                style={touchStyle}
              >
                <option value="">Bitte wählen…</option>
                {options.stages.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls} htmlFor="vzg_line_id">VzG-Strecke *</label>
              <select
                id="vzg_line_id"
                name="vzg_line_id"
                required
                value={vzgId}
                onChange={(e) => setVzgId(e.target.value)}
                disabled={!stageId}
                className="input"
                style={touchStyle}
              >
                <option value="">{stageId ? "Bitte wählen…" : "Zuerst Bauabschnitt wählen"}</option>
                {vzgOptions.map((v) => <option key={v.id} value={v.id}>{v.line_number}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls} htmlFor="on_call_number_id">Bereitschaftsnummer</label>
              <select
                id="on_call_number_id"
                name="on_call_number_id"
                value={onCallId}
                onChange={(e) => setOnCallId(e.target.value)}
                className="input"
                style={touchStyle}
              >
                <option value="">— keine —</option>
                {options.onCall.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
              </select>
            </div>
          </div>

          {/* AUFTRAG_7: neuer Block "Anruf" im Pflichtbereich der
              Zuordnungs-Spalte (beide Felder selbst bleiben optional/nullable -
              nur die Platzierung ist Pflichtbereich, nicht hinter der
              Aufklapp-Trennlinie). Anrufender greift auf die bestehende
              Kontaktliste zurück; die Freitext-Fallbacks caller_name/
              caller_contact bleiben unverändert im optionalen Abschnitt
              "Meldung & Bemerkungen" weiter unten. */}
          <div className="mt-4 border-t border-border pt-4">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">Anruf</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={labelCls} htmlFor="reported_at">Anrufzeit</label>
                <input
                  type="datetime-local"
                  id="reported_at"
                  name="reported_at"
                  value={reportedAt}
                  onChange={(e) => setReportedAt(e.target.value)}
                  className="input"
                  style={touchStyle}
                />
              </div>
              <div>
                <label className={labelCls} htmlFor="caller_contact_id">Anrufender</label>
                <select
                  id="caller_contact_id"
                  name="caller_contact_id"
                  value={selectedCallerContactId}
                  onChange={(e) => setCallerContactId(e.target.value)}
                  className="input"
                  style={touchStyle}
                >
                  <option value="">— Freitext verwenden —</option>
                  {callerContacts.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}{c.function ? ` – ${c.function}` : ""}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </Section>

        <Section title="Störung">
          <fieldset className="m-0 border-0 p-0">
            <legend className={`${labelCls} float-none p-0`}>Priorität *</legend>
            <ToggleGroup
              type="single"
              value={priority}
              onValueChange={(value) => {
                if (value) setPriority(value as (typeof PRIORITIES)[number]);
              }}
              variant="outline"
              spacing={2}
              aria-required="true"
              className="flex flex-wrap gap-2"
            >
              {PRIORITIES.map((p) => (
                <ToggleGroupItem
                  key={p}
                  value={p}
                  className="h-11 min-w-[5.5rem] rounded-md border border-border px-4 data-[state=on]:border-primary data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
                >
                  {PRIORITY_LABELS[p]}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
            {/* Verstecktes Feld: identisches name/value-Paar wie beim vorherigen
                <select name="priority">, damit createIncident() unverändert
                dieselbe FormData erhält (fd.get("priority") liefert weiterhin
                genau einen der PRIORITIES-Werte). */}
            <input type="hidden" name="priority" value={priority} />
          </fieldset>

          {/* AUFTRAG_7: Gewerk-Select (optional) in der Störungs-Spalte. */}
          <div className="mt-4">
            <label className={labelCls} htmlFor="trade_id">Gewerk</label>
            <select
              id="trade_id"
              name="trade_id"
              value={tradeId}
              onChange={(e) => setTradeId(e.target.value)}
              className="input"
              style={touchStyle}
            >
              <option value="">— keines —</option>
              {options.trades.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
          </div>

          <div className="mt-4">
            <label className={labelCls} htmlFor="description">Beschreibung *</label>
            <textarea id="description" name="description" rows={3} required className="input" style={touchStyle} />
          </div>
          <div className="mt-4">
            <CablePositionsEditor cableTypes={options.cableTypes} />
          </div>
        </Section>
      </div>

      <OptionalSection title="Ort & Objekt">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div><label className={labelCls} htmlFor="operating_point">Betriebsstelle</label><input id="operating_point" name="operating_point" className="input" style={touchStyle} /></div>
          <div><label className={labelCls} htmlFor="track">Gleis</label><input id="track" name="track" className="input" style={touchStyle} /></div>
          <div><label className={labelCls} htmlFor="km_from">Streckenkilometer von</label><input id="km_from" name="km_from" inputMode="decimal" placeholder="z. B. 12,500" className="input" style={touchStyle} /></div>
          <div><label className={labelCls} htmlFor="km_to">Streckenkilometer bis</label><input id="km_to" name="km_to" inputMode="decimal" className="input" style={touchStyle} /></div>
          <div><label className={labelCls} htmlFor="direction">Richtung</label><input id="direction" name="direction" className="input" style={touchStyle} /></div>
          <div><label className={labelCls} htmlFor="object_type">Objektart</label><input id="object_type" name="object_type" className="input" style={touchStyle} /></div>
          <div><label className={labelCls} htmlFor="object_designation">Objektbezeichnung</label><input id="object_designation" name="object_designation" className="input" style={touchStyle} /></div>
        </div>
        <div className="mt-4">
          <label className={labelCls} htmlFor="location_description">Ortsbeschreibung</label>
          <textarea id="location_description" name="location_description" rows={2} className="input" style={touchStyle} />
        </div>
      </OptionalSection>

      <OptionalSection title="Meldung & Bemerkungen">
        <ContactSelector contacts={options.contacts} customerId={customerId} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div><label className={labelCls} htmlFor="caller_name">Freitext-Ansprechpartner / Fallback</label><input id="caller_name" name="caller_name" className="input" style={touchStyle} /></div>
          <div><label className={labelCls} htmlFor="caller_contact">Freitext-Telefon / Fallback</label><input id="caller_contact" name="caller_contact" className="input" style={touchStyle} /></div>
          <div><label className={labelCls} htmlFor="external_reference">Externe Referenz</label><input id="external_reference" name="external_reference" className="input" style={touchStyle} /></div>
        </div>
        <div className="mt-4">
          <label className={labelCls} htmlFor="internal_note">Interne Bemerkung</label>
          <textarea id="internal_note" name="internal_note" rows={2} className="input" style={touchStyle} />
        </div>
      </OptionalSection>

      {/* Primäraktion, Desktop-Variante: zusätzlich am Formularende (die zweite
          Primäraktion "oben rechts" wird in page.tsx neben der Seitenüberschrift
          gerendert und über das `form`-Attribut mit NEW_INCIDENT_FORM_ID an dieses
          <form> gebunden). Auf Mobil ausgeblendet, dort übernimmt die unten fixierte
          Leiste die alleinige Primäraktion. */}
      <div className="hidden flex-wrap items-center gap-3 md:flex">
        <Button type="submit" disabled={pending} className="h-11 px-6">
          {pending ? "Speichern…" : "Meldung anlegen"}
        </Button>
        <span className="text-xs text-muted">
          Nach dem Speichern öffnet sich die Meldungsseite – Bilder werden dort ergänzt. Status wird auf Neu gesetzt.
        </span>
      </div>

      {/* Primäraktion, Mobil-Variante: unten fixierte Leiste in der Daumenzone,
          respektiert die Safe-Area (Notch/Home-Indicator, vgl. .safe-b in globals.css). */}
      <div className="safe-b fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface px-4 py-3 shadow md:hidden">
        <Button type="submit" disabled={pending} className="h-11 w-full">
          {pending ? "Speichern…" : "Meldung anlegen"}
        </Button>
      </div>
    </form>
  );
}
