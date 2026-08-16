import { getSessionProfile } from "@/lib/auth";
import { isUuid, withUserTransaction, type DatabaseClient } from "@/lib/db";
import { isPgError, PG_INSUFFICIENT_PRIVILEGE } from "@/lib/db/pg-errors";
import { INCIDENT_STATUS, type IncidentStatus, type ConditionRating } from "@/lib/status";
import { PRIORITIES, type Priority } from "@/lib/priority";
import type { AssignMonteurAp13Code } from "@/lib/database.types";
import {
  INCIDENT_PAGE_SIZES,
  INCIDENT_EXPORT_CAP,
  INCIDENT_FULL_EXPORT_CAP,
  type IncidentListFilters,
  type IncidentListSort,
  type IncidentListSortField,
  type IncidentListQuery,
  type IncidentListResult,
  type IncidentListRow,
  type IncidentListFilterOptions,
} from "@/lib/incident-list";

// AP14/B: Vorgangs-Reads auf PostgreSQL (ADR-011 / 2.5).
//
// Jeder Zugriff laeuft ueber withUserTransaction(); die Identitaet stammt
// ausschliesslich aus der serverseitig geprueften Auth.js-Sitzung. Fehlt sie,
// wird kein SQL ausgefuehrt: das Ergebnis ist dasselbe wie bisher (ohne
// Identitaet liefert die RLS keine Zeile), der Abbruch erfolgt aber schon vor
// dem Verbindungsaufbau.
//
// Warum die Zeilen als JSON projiziert werden (`to_json`): der Treiber liefert
// `bigint` und `numeric` als Zeichenkette und `timestamptz` als JS-Date. Beides
// widerspraeche den unten deklarierten Sichtmodellen. Die JSON-Serialisierung
// von PostgreSQL erzeugt stattdessen genau die bisherigen Werte - Zahlen als
// Zahlen und Zeitstempel als ISO-8601-Text in VOLLER Mikrosekundengenauigkeit.
// Die Genauigkeit ist fachlich notwendig: `updated_at` ist die Konfliktbasis
// der Zuweisungen und Massenaktionen, ein auf Millisekunden gekuerzter Wert
// wuerde dort dauerhaft 'conflict' ergeben.

// Sichtmodelle (View-Types) – bewusst entkoppelt von der SQL-Projektion;
// Ergebnisse werden gecastet.
export type StageRef = { id: string; name: string; code: string | null } | null;
export type OnCallRef = { id: string; number: string; label: string | null } | null;
export type MonteurRef = { id: string; full_name: string | null } | null;

export type AssignmentRef = {
  id: string;
  monteur_id: string;
  is_active: boolean;
  assigned_at: string;
  monteur: MonteurRef;
};

// AP10-Referenzen
export type CustomerRef = { id: string; name: string } | null;
export type VzgRef = { id: string; line_number: string } | null;
export type CableTypeRefMini = { id: string; code: string; name: string } | null;
export type CablePositionRef = {
  id: string;
  cable_type_id: string;
  sort_order: number;
  quantity_value: number | null;
  quantity_unit: "piece" | "meter" | null;
  condition_code: "ready" | "restricted" | "damaged" | "unusable" | null;
  cable_type: CableTypeRefMini;
};

export type IncidentRow = {
  id: string;
  incident_no: number;
  status: IncidentStatus;
  priority: Priority;
  condition_rating: ConditionRating | null;
  customer_id: string | null;
  vzg_line_id: string | null;
  vzg_line_number: string | null;
  km_from: number | null;
  km_to: number | null;
  operating_point: string | null;
  track: string | null;
  direction: string | null;
  object_type: string | null;
  object_designation: string | null;
  location_description: string | null;
  external_reference: string | null;
  caller_name: string | null;
  caller_contact: string | null;
  contact_id: string | null;
  contact_phone_number_id: string | null;
  contact_name_snapshot: string | null;
  contact_function_snapshot: string | null;
  contact_phone_snapshot: string | null;
  title: string | null;
  description: string | null;
  internal_note: string | null;
  closing_note: string | null;
  on_call_number_id: string | null;
  call_received_at: string | null;
  construction_stage_id: string;
  closed_at: string | null;
  closed_by: string | null;
  created_at: string;
  updated_at: string;
  // AP15B/RC1: aktueller Wert der Fehlalarm-Kennzeichnung; die Detailansicht
  // braucht ihn, um sie anzuzeigen und umzuschalten. Seit Migration 0018 NOT
  // NULL DEFAULT false - ein Nullwert ist hier nicht moeglich.
  is_false_alarm: boolean;
  // Frühester Wechsel nach „technisch_abgeschlossen" (für CSV-Export); aus Chronik.
  technisch_abgeschlossen_at: string | null;
  stage: StageRef;
  oncall: OnCallRef;
  customer: CustomerRef;
  vzgline: VzgRef;
  cable_positions: CablePositionRef[];
  assignments: AssignmentRef[];
};

export type StatusEvent = {
  id: string;
  old_status: IncidentStatus | null;
  new_status: IncidentStatus;
  note: string | null;
  changed_by: string | null;
  changed_at: string;
};

export type NoteEvent = {
  id: string;
  note_type: string;
  body: string;
  created_by: string | null;
  created_at: string;
};

export type IncidentDetail = {
  incident: IncidentRow;
  history: StatusEvent[];
  notes: NoteEvent[];
};

export type IncidentContactProjection = {
  incident_id: string;
  contact_name: string | null;
  contact_function: string | null;
  operative_phone: string | null;
};

export async function getAssignedIncidentContact(id: string): Promise<IncidentContactProjection | null> {
  const session = await getSessionProfile();
  // Fail-closed und wie bisher ohne Ausnahme: eine fehlende Sitzung oder eine
  // unbrauchbare Kennung ergibt „kein Treffer".
  if (!session || !isUuid(id)) return null;
  return withUserTransaction(session.userId, async (client) => {
    const result = await client.query<IncidentContactProjection>(
      `select incident_id, contact_name, contact_function, operative_phone
         from public.get_assigned_incident_contact($1::uuid)`,
      [id],
    );
    return result.rows[0] ?? null;
  });
}

type StaffContactRow = {
  contact_name: string | null;
  contact_function: string | null;
  operative_phone: string | null;
};

export async function getStaffIncidentContact(
  contactId: string | null,
  phoneId: string | null,
): Promise<Omit<IncidentContactProjection, "incident_id"> | null> {
  if (!contactId) return null;
  const session = await getSessionProfile();
  if (!session || !isUuid(contactId)) return null;
  // Eine unbrauchbare Telefonkennung wirkt wie eine fehlende: der Left Join
  // findet keine Zeile und `operative_phone` bleibt NULL.
  const phone = isUuid(phoneId) ? phoneId : null;
  return withUserTransaction(session.userId, async (client) => {
    const result = await client.query<StaffContactRow>(
      `select c.name as contact_name,
              c.function as contact_function,
              p.phone as operative_phone
         from public.contacts c
         left join public.contact_phone_numbers p on p.id = $2::uuid
        where c.id = $1::uuid`,
      [contactId, phone],
    );
    return result.rows[0] ?? null;
  });
}

// Projektion einer Vorgangszeile in der Form von IncidentRow.
//
// Die skalaren Referenzen kommen über Left Joins, die Sammlungen über
// korrelierte Unterabfragen. Beide Sammlungen und die eingebetteten Objekte
// bleiben bewusst „links": ein Monteur darf fremde Profile und ggf. Kabelarten
// nicht lesen, die RLS liefert dort keine Zeile. Ein Inner Join würde die
// Position bzw. Zuweisung dann ganz verschlucken, statt wie bisher nur das
// eingebettete Objekt auf NULL zu setzen.
const INCIDENT_ROW_COLUMNS = `
  i.id, i.incident_no, i.status, i.priority, i.condition_rating,
  i.customer_id, i.vzg_line_id, i.vzg_line_number, i.km_from, i.km_to,
  i.operating_point, i.track, i.direction,
  i.object_type, i.object_designation, i.location_description, i.external_reference,
  i.caller_name, i.caller_contact, i.contact_id, i.contact_phone_number_id,
  i.contact_name_snapshot, i.contact_function_snapshot, i.contact_phone_snapshot,
  i.title, i.description, i.internal_note, i.closing_note,
  i.on_call_number_id, i.call_received_at, i.construction_stage_id,
  i.closed_at, i.closed_by, i.created_at, i.updated_at, i.is_false_alarm,
  (
    select min(h.changed_at)
    from public.incident_status_history h
    where h.incident_id = i.id
      and h.new_status = 'technisch_abgeschlossen'
  ) as technisch_abgeschlossen_at,
  case when cs.id is null then null
       else json_build_object('id', cs.id, 'name', cs.name, 'code', cs.code) end as stage,
  case when ocn.id is null then null
       else json_build_object('id', ocn.id, 'number', ocn.number, 'label', ocn.label) end as oncall,
  case when c.id is null then null
       else json_build_object('id', c.id, 'name', c.name) end as customer,
  case when vl.id is null then null
       else json_build_object('id', vl.id, 'line_number', vl.line_number) end as vzgline,
  (
    select coalesce(
             json_agg(
               json_build_object(
                 'id', cp.id,
                 'cable_type_id', cp.cable_type_id,
                 'sort_order', cp.sort_order,
                 'quantity_value', cp.quantity_value,
                 'quantity_unit', cp.quantity_unit,
                 'condition_code', cp.condition_code,
                 'cable_type', case when ct.id is null then null
                                    else json_build_object('id', ct.id, 'code', ct.code, 'name', ct.name) end
               )
               order by cp.sort_order
             ),
             '[]'::json
           )
    from public.incident_cable_positions cp
    left join public.cable_types ct on ct.id = cp.cable_type_id
    where cp.incident_id = i.id
  ) as cable_positions,
  (
    select coalesce(
             json_agg(
               json_build_object(
                 'id', a.id,
                 'monteur_id', a.monteur_id,
                 'is_active', a.is_active,
                 'assigned_at', a.assigned_at,
                 'monteur', case when p.id is null then null
                                 else json_build_object('id', p.id, 'full_name', p.full_name) end
               )
               order by a.assigned_at
             ),
             '[]'::json
           )
    from public.incident_assignments a
    left join public.profiles p on p.id = a.monteur_id
    where a.incident_id = i.id
  ) as assignments
`;

const INCIDENT_ROW_FROM = `
  from public.incidents i
  left join public.construction_stages cs on cs.id = i.construction_stage_id
  left join public.on_call_numbers ocn on ocn.id = i.on_call_number_id
  left join public.customers c on c.id = i.customer_id
  left join public.vzg_lines vl on vl.id = i.vzg_line_id
`;

// Nur feste Bausteine werden zusammengesetzt; es gelangt kein Eingabewert in
// den SQL-Text.
const LIST_INCIDENTS_SQL = `
  select to_json(r) as incident
  from (select ${INCIDENT_ROW_COLUMNS} ${INCIDENT_ROW_FROM}) r
  order by r.updated_at desc`;

const INCIDENT_DETAIL_SQL = `
  select to_json(r) as incident
  from (select ${INCIDENT_ROW_COLUMNS} ${INCIDENT_ROW_FROM} where i.id = $1::uuid) r`;

const INCIDENT_HISTORY_SQL = `
  select to_json(r) as event
  from (
    select h.id, h.old_status, h.new_status, h.note, h.changed_by, h.changed_at
    from public.incident_status_history h
    where h.incident_id = $1::uuid
  ) r
  order by r.changed_at asc`;

const INCIDENT_NOTES_SQL = `
  select to_json(r) as entry
  from (
    select n.id, n.note_type, n.body, n.created_by, n.created_at
    from public.incident_notes n
    where n.incident_id = $1::uuid
  ) r
  order by r.created_at asc`;

type IncidentRowResult = { incident: IncidentRow };
type StatusEventResult = { event: StatusEvent };
type NoteEventResult = { entry: NoteEvent };

// Sichtbarkeit wird durch RLS erzwungen: Disposition/Admin sehen alle,
// Monteur nur zugewiesene Vorgänge.
export async function listIncidents(): Promise<IncidentRow[]> {
  const session = await getSessionProfile();
  if (!session) return [];
  return withUserTransaction(session.userId, async (client) => {
    // Der technische Abschlusszeitpunkt (frühester Wechsel nach
    // technisch_abgeschlossen) kommt als Unterabfrage aus derselben Anweisung.
    const result = await client.query<IncidentRowResult>(LIST_INCIDENTS_SQL);
    return result.rows.map((row) => row.incident);
  });
}

export async function getIncidentDetail(id: string): Promise<IncidentDetail | null> {
  const session = await getSessionProfile();
  if (!session || !isUuid(id)) return null;
  // Vorgang, Chronik und Notizen in EINER Transaktion – drei Anweisungen,
  // damit der Anweisungsschutz je Aufruf genau eine Anweisung sieht.
  return withUserTransaction(session.userId, async (client) => {
    const incidentResult = await client.query<IncidentRowResult>(INCIDENT_DETAIL_SQL, [id]);
    const incident = incidentResult.rows[0]?.incident;
    if (!incident) return null;

    const historyResult = await client.query<StatusEventResult>(INCIDENT_HISTORY_SQL, [id]);
    const notesResult = await client.query<NoteEventResult>(INCIDENT_NOTES_SQL, [id]);
    const history = historyResult.rows.map((row) => row.event);
    const notes = notesResult.rows.map((row) => row.entry);

    incident.technisch_abgeschlossen_at =
      history.find((h) => h.new_status === "technisch_abgeschlossen")?.changed_at ?? null;

    return { incident, history, notes };
  });
}

type MonteurOptionRow = { id: string; full_name: string | null };
type StageOptionRow = { id: string; name: string; code: string | null };
type OnCallOptionRow = { id: string; number: string; label: string | null };

export async function getMonteure(): Promise<{ id: string; full_name: string | null }[]> {
  const session = await getSessionProfile();
  if (!session) return [];
  return withUserTransaction(session.userId, async (client) => {
    const result = await client.query<MonteurOptionRow>(
      `select id, full_name
         from public.profiles
        where role = 'monteur' and is_active
        order by full_name asc`,
    );
    return result.rows;
  });
}

export async function getStages(): Promise<{ id: string; name: string; code: string | null }[]> {
  const session = await getSessionProfile();
  if (!session) return [];
  return withUserTransaction(session.userId, async (client) => {
    const result = await client.query<StageOptionRow>(
      `select id, name, code
         from public.construction_stages
        where is_active
        order by name asc`,
    );
    return result.rows;
  });
}

export async function getOnCallNumbers(): Promise<{ id: string; number: string; label: string | null }[]> {
  const session = await getSessionProfile();
  if (!session) return [];
  return withUserTransaction(session.userId, async (client) => {
    const result = await client.query<OnCallOptionRow>(
      `select id, number, label
         from public.on_call_numbers
        where is_active
        order by number asc`,
    );
    return result.rows;
  });
}

// Aktive Monteurnamen eines Vorgangs.
export function activeMonteurNames(row: IncidentRow): string[] {
  return row.assignments
    .filter((a) => a.is_active)
    .map((a) => a.monteur?.full_name ?? "—");
}

export type FormState = { ok: boolean; error: string | null };

// ---------------------------------------------------------------------
// AP10: Optionen für Erfassungs-/Bearbeitungsmaske (nur aktive Stammdaten).
// Seit AP14/B über withUserTransaction() direkt aus PostgreSQL – siehe die
// Begründung unter den Typen.
// ---------------------------------------------------------------------
export type IncidentFormStage = { id: string; label: string; default_on_call_number_id: string | null };
export type IncidentFormVzg = { id: string; line_number: string; construction_stage_id: string };
export type IncidentFormOption = { id: string; label: string };
export type IncidentFormContact = {
  id: string;
  customer_id: string;
  name: string;
  function: string | null;
  phones: { id: string; phone: string; phone_type: string }[];
};
export type IncidentFormOptions = {
  customers: { id: string; name: string }[];
  stages: IncidentFormStage[];
  vzgLines: IncidentFormVzg[];
  onCall: IncidentFormOption[];
  cableTypes: { id: string; code: string; name: string }[];
  contacts: IncidentFormContact[];
  defaults: { customer_id: string | null; on_call_number_id: string | null };
};

// AP14/B: Die Optionen der Erfassungs-/Bearbeitungsmaske kommen ab hier direkt
// aus PostgreSQL statt aus @/lib/masterdata. Gelesen wird ausschliesslich der
// tatsaechliche Bedarf dieser Datei - die vollen masterdata-Rueckgabetypen
// (stage_ids, customer_name, default_on_call_label, email, description ...)
// werden bewusst NICHT nachgebaut.
//
// Fehlermodell - zweigeteilt und bewusst so:
//   * Fehlende Sitzung (getSessionProfile() liefert null): leere Sammlungen und
//     defaults = { customer_id: null, on_call_number_id: null }. Das ist genau
//     das bisher sichtbare Ergebnis ohne Identitaet (ohne sie liefert die RLS
//     keine Zeile) und haelt die aufrufenden Seiten fehlerfrei.
//   * Ein echter Datenbankfehler wird NICHT gefangen und NICHT geschluckt. Er
//     propagiert wie bei den uebrigen AP14B-Lesewegen dieser Datei
//     (listIncidents, getMonteure, getStages, getOnCallNumbers). Ein fehlendes
//     Tabellenrecht muss laut scheitern, nicht still eine leere Auswahl ergeben.
//
// Die Zeilensichtbarkeit bleibt ausschliesslich Sache der RLS; hier wird KEINE
// Rollenpruefung in TypeScript nachgebaut. Dass ein Monteur keine
// Ansprechpartner sieht, folgt aus contacts_select bzw.
// contact_phone_numbers_select (0010:45-50, an public.is_staff() gebunden).
type CustomerOptionRow = { id: string; name: string };
type FormStageRow = {
  id: string;
  code: string | null;
  name: string;
  default_on_call_number_id: string | null;
};
type VzgLineOptionRow = { id: string; line_number: string; construction_stage_id: string };
type CableTypeOptionRow = { id: string; code: string; name: string };
type ContactOptionResult = { contact: IncidentFormContact };
type AppSettingsRow = { default_customer_id: string | null; default_on_call_number_id: string | null };
type CreatorOptionRow = { id: string; full_name: string | null; role: string };

// Ansprechpartner samt Telefonnummern in EINER Anweisung.
//
// `coalesce(json_agg(...), '[]'::json)` ist zwingend: json_agg ueber eine leere
// Menge liefert NULL, und die Aufrufer arbeiten unmittelbar auf `phones`.
// `as "function"` haelt den JSON-Schluessel exakt bei `function`.
const FORM_CONTACTS_SQL = `
  select to_json(r) as contact
  from (
    select c.id, c.customer_id, c.name, c.function as "function",
           (
             select coalesce(
                      json_agg(
                        json_build_object('id', p.id, 'phone', p.phone, 'phone_type', p.phone_type)
                        order by p.sort_order asc, p.id asc
                      ),
                      '[]'::json
                    )
             from public.contact_phone_numbers p
             where p.contact_id = c.id
           ) as phones
    from public.contacts c
    where c.is_active
  ) r
  order by r.name asc`;

function emptyIncidentFormOptions(): IncidentFormOptions {
  return {
    customers: [],
    stages: [],
    vzgLines: [],
    onCall: [],
    cableTypes: [],
    contacts: [],
    defaults: { customer_id: null, on_call_number_id: null },
  };
}

export async function getIncidentFormOptions(): Promise<IncidentFormOptions> {
  const session = await getSessionProfile();
  if (!session) return emptyIncidentFormOptions();
  // EINE Transaktion, mehrere Anweisungen: sequenziell auf demselben client,
  // je client.query genau eine Anweisung (Anweisungsschutz in
  // @/lib/db/statement-guard). Kein Promise.all auf demselben client.
  return withUserTransaction(session.userId, async (client) => {
    const customers = await client.query<CustomerOptionRow>(
      `select id, name
         from public.customers
        where is_active
        order by name asc`,
    );
    const stages = await client.query<FormStageRow>(
      `select id, code, name, default_on_call_number_id
         from public.construction_stages
        where is_active
        order by name asc`,
    );
    // line_number ist text; die Sortierung ist damit eine Textsortierung.
    const vzg = await client.query<VzgLineOptionRow>(
      `select id, line_number, construction_stage_id
         from public.vzg_lines
        where is_active
        order by line_number asc`,
    );
    const onCall = await client.query<OnCallOptionRow>(
      `select id, number, label
         from public.on_call_numbers
        where is_active
        order by number asc`,
    );
    // Zweistufige Sortierung: sort_order ist die fachliche Reihenfolge, name
    // nur der Tiebreaker. Beide Stufen sind noetig.
    const cableTypes = await client.query<CableTypeOptionRow>(
      `select id, code, name
         from public.cable_types
        where is_active
        order by sort_order asc, name asc`,
    );
    const contacts = await client.query<ContactOptionResult>(FORM_CONTACTS_SQL);
    // Singleton der Anwendungsvorgaben. Fehlt die Zeile, gilt wie bisher die
    // leere Vorbelegung - niemals eine Ausnahme.
    const settings = await client.query<AppSettingsRow>(
      `select default_customer_id, default_on_call_number_id
         from public.app_settings
        where id = 1`,
    );
    const defaults = settings.rows[0] ?? {
      default_customer_id: null,
      default_on_call_number_id: null,
    };

    return {
      customers: customers.rows.map((c) => ({ id: c.id, name: c.name })),
      stages: stages.rows.map((s) => ({
        id: s.id,
        label: s.code ? `${s.code} – ${s.name}` : s.name,
        default_on_call_number_id: s.default_on_call_number_id,
      })),
      vzgLines: vzg.rows.map((v) => ({
        id: v.id,
        line_number: v.line_number,
        construction_stage_id: v.construction_stage_id,
      })),
      onCall: onCall.rows.map((o) => ({
        id: o.id,
        label: o.label ? `${o.number} – ${o.label}` : o.number,
      })),
      cableTypes: cableTypes.rows.map((t) => ({ id: t.id, code: t.code, name: t.name })),
      contacts: contacts.rows.map((row) => row.contact),
      defaults: {
        customer_id: defaults.default_customer_id,
        on_call_number_id: defaults.default_on_call_number_id,
      },
    };
  });
}

// =====================================================================
// AP11: Operative Vorgangsliste (serverseitig, RLS über View security_invoker).
// Typen/Helfer in @/lib/incident-list; hier nur die DB-Reads.
// =====================================================================
const LIST_SELECT =
  "id, incident_no, status, priority, customer_id, customer_name, construction_stage_id, stage_code, stage_name, " +
  "vzg_line_id, vzg_line_number, vzg_line_ref, on_call_number_id, on_call_number, on_call_label, operating_point, " +
  "km_from, km_to, created_at, created_by, updated_at, image_count, cable_arts, monteur_names, monteur_ids, " +
  "no_monteur, no_images, no_cable, historic_vzg, has_open_task, is_false_alarm";

const SORT_COLUMN: Record<IncidentListSortField, string> = {
  incident_no: "incident_no",
  priority: "priority",
  status: "status",
  customer: "customer_name",
  construction_stage: "stage_name",
  created_at: "created_at",
  updated_at: "updated_at",
};

// Allow-List der Sortierrichtung: nur diese beiden festen Zeichenketten
// können in den SQL-Text gelangen.
const SORT_DIRECTION = { asc: "asc", desc: "desc" } as const;

// Aktivitätsfilter „aktiv": diese Status sind ausgeschlossen.
const CLOSED_STATUS = ["abgeschlossen", "storniert"] as const;

function escapeLike(term: string): string {
  return term.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

/**
 * Bindet einen Wert und liefert AUSSCHLIESSLICH dessen Platzhalter ($1, $2, …).
 *
 * Damit bleibt der zusammengesetzte SQL-Text frei von Eingabewerten: in den
 * Text gelangt nur die Nummer des Platzhalters, der Wert ausschliesslich in die
 * Werteliste.
 */
function bind(values: unknown[], value: unknown): string {
  values.push(value);
  return `$${values.length}`;
}

/**
 * Kennungsfilter, der nur kanonische UUIDs zulaesst.
 *
 * Die Filterwerte kommen aus der Adresszeile und sind dort nicht auf UUIDs
 * geprueft. Ein unbrauchbarer Wert wird als NULL gebunden: der Vergleich ist
 * dann niemals wahr und die Liste bleibt leer - genau das bisherige Ergebnis,
 * nur ohne Ausnahme aus der Typumwandlung.
 */
function uuidOrNull(value: string | undefined): string | null {
  return isUuid(value) ? value : null;
}

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * True fuer einen kanonisch geschriebenen, tatsaechlich existierenden Kalendertag.
 *
 * Die Datumsfilter stammen aus der Adresszeile bzw. beim Export aus dem vom
 * Client uebergebenen IncidentListQuery und sind dort nicht geprueft. Die
 * Musterpruefung allein genuegt nicht: '2026-02-31' passt auf das Muster, wird
 * von `::date` aber mit 22008 abgewiesen. Der Wert wird deshalb zusaetzlich
 * zurueckgerechnet - nur ein Tag, der unveraendert wieder herauskommt, gilt.
 */
function isIsoDate(value: string | undefined): boolean {
  if (!value || !ISO_DATE_PATTERN.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

/**
 * Sortierklausel aus der Allow-List.
 *
 * Ein nicht hinterlegtes Feld wird verworfen; die Richtung stammt aus
 * SORT_DIRECTION. Es kann kein Wert aus der Anfrage in den SQL-Text gelangen.
 */
function orderBy(sort: IncidentListSort): string {
  const parts: string[] = [];
  // AP15B/RC1: `sort` kommt wie die Filter unveraendert vom Client und ist
  // dort nicht gegen den Typ geprueft. Anders als bei den Filtern oben wird
  // hier NICHT fail-closed verworfen: ungueltige Sortierangaben werden schon
  // heute von parseIncidentListQuery() (incident-list-url.ts) auf eine leere
  // Sortierliste reduziert, und die stabilen Tiebreaker unten liefern ohnehin
  // eine wohldefinierte Reihenfolge. Ein `sort`, das kein Array ist, wirkt
  // deshalb wie eine leere Sortierliste; ein Eintrag, der kein Objekt ist
  // (null, Zahl, Zeichenkette), wird uebersprungen.
  const rawSort: unknown = sort;
  const entries = Array.isArray(rawSort) ? rawSort : [];
  for (const rawEntry of entries) {
    if (typeof rawEntry !== "object" || rawEntry === null) continue;
    const entry = rawEntry as Record<string, unknown>;
    if (typeof entry.field !== "string" || !Object.prototype.hasOwnProperty.call(SORT_COLUMN, entry.field)) continue;
    const column = SORT_COLUMN[entry.field as IncidentListSortField];
    parts.push(`r.${column} ${SORT_DIRECTION[entry.dir === "asc" ? "asc" : "desc"]}`);
  }
  // Stabile Standard-/Tiebreaker-Sortierung
  parts.push("r.updated_at desc", "r.incident_no desc");
  return parts.join(", ");
}

type IncidentListPageRow = { list_row: IncidentListRow; total_count: number };
type IncidentListPage = { rows: IncidentListRow[]; total: number };

/**
 * Eine Seite der Liste samt Gesamtzahl.
 *
 * `count(*) over ()` wird nach den Filtern und vor LIMIT/OFFSET ausgewertet und
 * liefert deshalb die vollständige Treffermenge – aber nur als Spalte AUF einer
 * zurückgegebenen Zeile. Liefert der OFFSET keine Zeile, gibt es auch keine
 * Zelle mit der Gesamtzahl; der Normalfall kostet dennoch keine zweite
 * Anweisung. Für genau diesen Randfall zählt fetchList unten nach, damit die
 * Gesamtzahl unabhängig vom angeforderten Bereich stimmt. `created_date_local`
 * und `search_text` werden nur gefiltert (in der inneren Abfrage) und bewusst
 * nicht projiziert.
 */
async function fetchList(
  client: DatabaseClient,
  filters: IncidentListFilters,
  sort: IncidentListSort,
  offset: number,
  limit: number,
): Promise<IncidentListPage> {
  const f = filters;

  // AP15B/RC1: `filters` kommt unveraendert vom Client (IncidentListQuery,
  // insbesondere ueber die beiden Exportpfade) und ist dort nicht gegen den
  // TypeScript-Vertrag geprueft. Ein Wert, der kein Objekt ist, wuerde jeden
  // folgenden Feldzugriff auf `f` mit einer Ausnahme abbrechen; die Pruefung
  // steht deshalb vor jedem Feldzugriff.
  if (!f || typeof f !== "object") return { rows: [], total: 0 };

  // Aufzählungsfilter gegen die bestehenden Allow-Lists prüfen, BEVOR SQL läuft.
  //
  // `status` und `priority` werden unten als Aufzählungstyp gebunden; ein Wert
  // außerhalb der Aufzählung löst dort eine Umwandlungsausnahme (22P02) aus. Die
  // Werte sind von außen erreichbar: sie stammen aus der Adresszeile bzw. beim
  // Export aus dem vom Client übergebenen IncidentListQuery und sind dort nicht
  // gegen die Aufzählung geprüft. Ein unbrauchbarer Wert ergibt deshalb eine
  // leere Treffermenge statt einer Ausnahme – genau das bisher sichtbare
  // Verhalten (leere Liste, total = 0), nur ohne Fehlerpfad.
  if (f.status && !INCIDENT_STATUS.includes(f.status)) return { rows: [], total: 0 };
  if (f.priority && !PRIORITIES.includes(f.priority)) return { rows: [], total: 0 };
  // Dieselbe Vorabpruefung fuer die Datumsfilter. Ohne sie brach ein
  // unbrauchbarer Wert aus der Adresszeile die Umwandlung nach `::date` ab; die
  // Ausnahme verliess listIncidentsPaged()/listIncidentsForExport() ungefangen
  // und ergab eine Fehlerseite bzw. eine unbehandelte Server-Action-Ausnahme.
  // Der abgeloeste Supabase-Pfad lieferte hier `data ?? []`, also eine leere
  // Liste. Dieses sichtbare Verhalten bleibt damit unveraendert.
  if (f.date_from && !isIsoDate(f.date_from)) return { rows: [], total: 0 };
  if (f.date_to && !isIsoDate(f.date_to)) return { rows: [], total: 0 };
  // AP15B/RC1: Freitextsuche - derselbe Ursprung (Adresszeile bzw. das vom
  // Client uebergebene IncidentListQuery) und dort nicht gegen den Typ
  // geprueft. Ein Wert, der kein Text ist, wuerde unten `.trim()` mit einer
  // TypeError abbrechen; die leere Treffermenge bleibt das sichtbare
  // Verhalten statt einer Ausnahme.
  if (f.q !== undefined && typeof f.q !== "string") return { rows: [], total: 0 };
  // AP15B/RC1: Fehlalarm-Statusfilter - derselbe Ursprung. Ein Wert, der kein
  // boolescher Wert ist, wuerde unten mit ::boolean gebunden und eine
  // Umwandlungsausnahme (22P02) ausloesen; `null` speziell wuerde als
  // SQL-NULL binden und den Vergleich `is_false_alarm = NULL` unbemerkt
  // dauerhaft unwahr machen. Beides gilt hier ausdruecklich als unbrauchbar.
  if (f.falseAlarm !== undefined && typeof f.falseAlarm !== "boolean") return { rows: [], total: 0 };

  const values: unknown[] = [];
  const conditions: string[] = [];

  if (f.status) conditions.push(`status = ${bind(values, f.status)}::public.incident_status`);
  else if (f.activity === "active")
    conditions.push(`status <> all(${bind(values, [...CLOSED_STATUS])}::public.incident_status[])`);
  else if (f.activity === "closed")
    conditions.push(`status = ${bind(values, "abgeschlossen")}::public.incident_status`);
  if (f.priority) conditions.push(`priority = ${bind(values, f.priority)}::public.incident_priority`);
  if (f.customer_id) conditions.push(`customer_id = ${bind(values, uuidOrNull(f.customer_id))}::uuid`);
  if (f.stage_id) conditions.push(`construction_stage_id = ${bind(values, uuidOrNull(f.stage_id))}::uuid`);
  if (f.vzg_line_id) conditions.push(`vzg_line_id = ${bind(values, uuidOrNull(f.vzg_line_id))}::uuid`);
  if (f.on_call_number_id)
    conditions.push(`on_call_number_id = ${bind(values, uuidOrNull(f.on_call_number_id))}::uuid`);
  if (f.created_by) conditions.push(`created_by = ${bind(values, uuidOrNull(f.created_by))}::uuid`);
  if (f.monteur_id) conditions.push(`monteur_ids @> array[${bind(values, uuidOrNull(f.monteur_id))}]::uuid[]`);
  if (f.images === "with") conditions.push("image_count > 0");
  else if (f.images === "without") conditions.push("image_count = 0");
  // AP13: „hat offene Aufgabe" wird serverseitig auf der View gefiltert.
  if (f.hasOpenTask) conditions.push("has_open_task = true");
  // AP15-b: Fehlalarm-Statusfilter. undefined = kein Filter (beide Werte).
  if (f.falseAlarm !== undefined)
    conditions.push(`is_false_alarm = ${bind(values, f.falseAlarm)}::boolean`);
  if (f.date_from) conditions.push(`created_date_local >= ${bind(values, f.date_from)}::date`);
  if (f.date_to) conditions.push(`created_date_local <= ${bind(values, f.date_to)}::date`);
  const term = (f.q ?? "").trim();
  if (term) {
    // escapeLike maskiert mit Backslash. `escape E'\\'` benennt genau dieses
    // Zeichen und ist von standard_conforming_strings unabhängig.
    const pattern = `%${escapeLike(term.toLowerCase())}%`;
    conditions.push(`search_text like ${bind(values, pattern)} escape E'\\\\'`);
  }

  const where = conditions.length > 0 ? `where ${conditions.join(" and ")}` : "";
  // Stand der Werteliste VOR limit/offset. Die Zaehlabfrage unten benutzt genau
  // diese Werte und damit dieselben Platzhalternummern wie `where`; limit und
  // offset werden erst danach gebunden und gehoeren nicht in die Zaehlung.
  const filterValues = values.slice();
  const limitPlaceholder = bind(values, limit);
  const offsetPlaceholder = bind(values, offset);

  const result = await client.query<IncidentListPageRow>(
    `select to_json(r) as list_row, (count(*) over ())::int as total_count
       from (select ${LIST_SELECT} from public.incident_list_view ${where}) r
      order by ${orderBy(sort)}
      limit ${limitPlaceholder} offset ${offsetPlaceholder}`,
    values,
  );
  const rows = result.rows.map((row) => row.list_row);

  // `count(*) over ()` allein genuegt nicht: die Gesamtzahl ist eine SPALTE der
  // Ergebniszeilen. Liegt der OFFSET hinter der Treffermenge, kommt keine Zeile
  // zurueck und damit auch keine Gesamtzahl - `total` fiele auf 0. Die
  // Seitennormalisierung in listIncidentsPaged() waere dann genau dann
  // wirkungslos, wenn sie gebraucht wird (z. B. /vorgaenge?page=99). Nur in
  // diesem Randfall wird nachgezaehlt; der Normalfall bleibt bei EINER
  // Anweisung. Die Zaehlung laeuft auf demselben client und damit in derselben
  // Transaktion wie die Seitenabfrage, sieht also denselben Datenstand.
  if (rows.length === 0 && offset > 0) {
    const totalResult = await client.query<{ total_count: number }>(
      `select count(*)::int as total_count from public.incident_list_view ${where}`,
      filterValues,
    );
    return { rows, total: totalResult.rows[0]?.total_count ?? 0 };
  }

  return { rows, total: result.rows[0]?.total_count ?? 0 };
}

export async function listIncidentsPaged(query: IncidentListQuery): Promise<IncidentListResult> {
  const pageSize = (INCIDENT_PAGE_SIZES as readonly number[]).includes(query.pageSize) ? query.pageSize : 50;
  let page = Math.max(1, Math.trunc(query.page) || 1);

  const session = await getSessionProfile();
  if (!session) return { rows: [], total: 0, page, pageSize };

  return withUserTransaction(session.userId, async (client) => {
    let from = (page - 1) * pageSize;
    let res = await fetchList(client, query.filters, query.sort, from, pageSize);
    let total = res.total;

    // Ungültige Seite auf gültigen Bereich normalisieren.
    const lastPage = Math.max(1, Math.ceil(total / pageSize));
    if (total > 0 && page > lastPage) {
      page = lastPage;
      from = (page - 1) * pageSize;
      res = await fetchList(client, query.filters, query.sort, from, pageSize);
      total = res.total;
    }

    return { rows: res.rows, total, page, pageSize };
  });
}

export async function listIncidentsForExport(
  query: IncidentListQuery,
): Promise<{ rows: IncidentListRow[]; total: number; capped: boolean }> {
  const session = await getSessionProfile();
  if (!session) return { rows: [], total: 0, capped: false };
  return withUserTransaction(session.userId, async (client) => {
    const res = await fetchList(client, query.filters, query.sort, 0, INCIDENT_EXPORT_CAP);
    return { rows: res.rows, total: res.total, capped: res.total > INCIDENT_EXPORT_CAP };
  });
}

// AP15-b: Vollmengen-Export-Pfad. Dieselbe gefilterte/sortierte Treffermenge
// wie listIncidentsForExport, aber mit der hoeheren Obergrenze
// INCIDENT_FULL_EXPORT_CAP (20000) statt INCIDENT_EXPORT_CAP (5000). Die
// interaktive UI (exportIncidentList/listIncidentsForExport) bleibt
// UNVERAENDERT bei 5000 - dieser Pfad ist additiv fuer den separaten
// Vollmengen-Export (siehe exportIncidentListFull in incident-list-actions.ts).
// Rollenpruefung erfolgt wie beim bestehenden Export ausschliesslich in der
// Server-Action, nicht hier - RLS greift ohnehin ueber die security_invoker-
// View.
export async function listIncidentsForFullExport(
  query: IncidentListQuery,
): Promise<{ rows: IncidentListRow[]; total: number; capped: boolean }> {
  const session = await getSessionProfile();
  if (!session) return { rows: [], total: 0, capped: false };
  return withUserTransaction(session.userId, async (client) => {
    const res = await fetchList(client, query.filters, query.sort, 0, INCIDENT_FULL_EXPORT_CAP);
    return { rows: res.rows, total: res.total, capped: res.total > INCIDENT_FULL_EXPORT_CAP };
  });
}

/**
 * Urheberfilter der Vorgangsliste.
 *
 * Bewusst OHNE is_active- und ohne Rollenfilter: der Filter soll auch Vorgaenge
 * inaktiver oder nicht-monteurischer Urheber auffindbar halten. Nicht mit
 * getMonteure() verwechseln, das `where role = 'monteur' and is_active` traegt.
 * Die Sichtbarkeit regelt allein profiles_select
 * (`id = app.current_user_id() or public.is_staff()`).
 *
 * Fehlende Sitzung ergibt wie bisher eine leere Auswahl; ein Datenbankfehler
 * propagiert.
 */
async function getCreatorOptions(): Promise<IncidentFormOption[]> {
  const session = await getSessionProfile();
  if (!session) return [];
  return withUserTransaction(session.userId, async (client) => {
    const result = await client.query<CreatorOptionRow>(
      `select id, full_name, role::text as role
         from public.profiles
        order by full_name asc`,
    );
    // Fehlt der Anzeigename, steht wie bisher die rohe Kennung im Label.
    return result.rows.map((p) => ({ id: p.id, label: `${p.full_name ?? p.id} (${p.role})` }));
  });
}

export async function getIncidentListFilterOptions(): Promise<IncidentListFilterOptions> {
  const [opts, monteure, creators] = await Promise.all([
    getIncidentFormOptions(),
    getMonteure(),
    getCreatorOptions(),
  ]);
  return {
    customers: opts.customers.map((c) => ({ id: c.id, label: c.name })),
    stages: opts.stages.map((s) => ({ id: s.id, label: s.label })),
    vzgLines: opts.vzgLines.map((v) => ({ id: v.id, label: v.line_number, construction_stage_id: v.construction_stage_id })),
    onCall: opts.onCall,
    monteure: monteure.map((m) => ({ id: m.id, label: m.full_name ?? "—" })),
    creators,
  };
}

// =====================================================================
// AP13: Einzelzuweisung eines Monteurs über den kontrollierten RPC-Pfad.
//
// Einzel- und Massenzuweisung nutzen denselben gesperrten Pfad
// (assign_incident_monteur_ap13, SECURITY INVOKER). Konfliktbasis sind
// incidents.updated_at UND die erwartete sortierte Menge aktiver
// monteur_ids, weil updated_at konkurrierende Zuweisungen nicht erkennt.
// =====================================================================
const ASSIGN_MESSAGES: Record<Exclude<AssignMonteurAp13Code, "ok">, string> = {
  conflict:
    "Der Vorgang wurde zwischenzeitlich geändert (Status oder Zuweisungen). Bitte die Seite neu laden und erneut zuweisen.",
  not_found: "Der Vorgang wurde nicht gefunden.",
  invalid_monteur: "Der gewählte Monteur ist nicht aktiv oder hat nicht die Rolle Monteur.",
};

type IncidentConflictBaseRow = { updated_at: string };
type ActiveAssignmentRow = { monteur_id: string };
type AssignResultRow = { code: AssignMonteurAp13Code | null };

export async function assignIncidentMonteur(incidentId: string, monteurId: string): Promise<FormState> {
  const session = await getSessionProfile();
  // Ohne Identität sah die RLS bisher keinen Vorgang; die Meldung bleibt
  // deshalb dieselbe wie bei einem unbekannten Vorgang.
  if (!session || !isUuid(incidentId)) return { ok: false, error: ASSIGN_MESSAGES.not_found };

  try {
    // Konfliktbasis lesen, erwartete Zuweisungsmenge lesen und zuweisen laufen
    // in EINER Transaktion; der RPC sperrt den Vorgang zusätzlich selbst.
    const code = await withUserTransaction<AssignMonteurAp13Code>(session.userId, async (client) => {
      // `updated_at::text` erhält die Mikrosekunden; ein als JS-Date
      // zurückgegebener Wert würde auf Millisekunden gekürzt und die
      // Konfliktprüfung des RPC dauerhaft scheitern lassen.
      const incident = await client.query<IncidentConflictBaseRow>(
        `select i.updated_at::text as updated_at
           from public.incidents i
          where i.id = $1::uuid`,
        [incidentId],
      );
      const base = incident.rows[0];
      if (!base) return "not_found";

      const assignments = await client.query<ActiveAssignmentRow>(
        `select a.monteur_id
           from public.incident_assignments a
          where a.incident_id = $1::uuid and a.is_active`,
        [incidentId],
      );
      const expectedMonteurIds = assignments.rows.map((a) => a.monteur_id).sort();

      const assigned = await client.query<AssignResultRow>(
        `select public.assign_incident_monteur_ap13($1::uuid, $2::uuid, $3::timestamptz, $4::uuid[]) as code`,
        [incidentId, monteurId, base.updated_at, expectedMonteurIds],
      );
      return assigned.rows[0]?.code ?? "conflict";
    });

    if (code === "ok") return { ok: true, error: null };
    return { ok: false, error: ASSIGN_MESSAGES[code] ?? "Die Zuweisung ist fehlgeschlagen." };
  } catch (error) {
    // Der SQLSTATE macht die Klassifizierung eindeutig: 42501 deckt sowohl die
    // RLS-Verweigerung als auch die Staff-Prüfung des RPC ab. Die
    // Datenbankmeldung bleibt serverseitig.
    if (isPgError(error, PG_INSUFFICIENT_PRIVILEGE))
      return { ok: false, error: "Nur Disposition und Administration dürfen Monteure zuweisen." };
    console.error(
      "Monteurzuweisung fehlgeschlagen",
      error instanceof Error ? error.message : "unbekannter Fehler",
    );
    return { ok: false, error: "Die Zuweisung ist fehlgeschlagen. Bitte erneut versuchen." };
  }
}

// =====================================================================
// AP15-b: Fehlalarm-Kennzeichnung setzen/aendern.
//
// Die eigentliche Durchsetzung "nur Disponent" liegt datenbankseitig im BEFORE
// INSERT OR UPDATE-Waechter tg_incident_guard_false_alarm (Migration 0018, SQLSTATE
// 42501); sie gilt damit auch fuer die Anlage. RLS selbst ist nicht spaltengranular
// (incidents_update erlaubt is_staff() ODER dem zugewiesenen Monteur das UPDATE der
// Zeile als Ganzes). Diese Funktion bindet den neuen Wert ausschliesslich als
// Parameter; kein Eingabewert gelangt in den SQL-Text.
// =====================================================================
type FalseAlarmUpdateRow = { id: string };

export async function setIncidentFalseAlarm(incidentId: string, value: boolean): Promise<FormState> {
  const session = await getSessionProfile();
  if (!session || !isUuid(incidentId)) return { ok: false, error: "Der Vorgang wurde nicht gefunden." };

  try {
    const updated = await withUserTransaction(session.userId, async (client) => {
      const result = await client.query<FalseAlarmUpdateRow>(
        `update public.incidents set is_false_alarm = $2::boolean where id = $1::uuid returning id`,
        [incidentId, value],
      );
      return result.rows[0] ?? null;
    });

    if (!updated) return { ok: false, error: "Der Vorgang wurde nicht gefunden." };
    return { ok: true, error: null };
  } catch (error) {
    // 42501 deckt sowohl eine RLS-Verweigerung (kein Zugriff auf die Zeile)
    // als auch den Waechter tg_incident_guard_false_alarm ab (Zugriff auf die
    // Zeile vorhanden, aber Rolle ungleich Disponent). Die Datenbankmeldung
    // bleibt serverseitig.
    if (isPgError(error, PG_INSUFFICIENT_PRIVILEGE))
      return { ok: false, error: "Die Fehlalarm-Kennzeichnung darf nur die Disposition ändern." };
    console.error(
      "Fehlalarm-Kennzeichnung konnte nicht geändert werden",
      error instanceof Error ? error.message : "unbekannter Fehler",
    );
    return { ok: false, error: "Die Änderung ist fehlgeschlagen. Bitte erneut versuchen." };
  }
}
