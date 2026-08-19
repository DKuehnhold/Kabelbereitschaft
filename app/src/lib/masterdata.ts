import { getSessionProfile } from "@/lib/auth";
import { withUserTransaction } from "@/lib/db";
import type { PhoneType } from "@/lib/status";
import type { QualificationColorKey, QualificationRow } from "@/lib/qualifications";
import { technicianColorKey } from "@/lib/qualifications";

// =====================================================================
// AP9 – Stammdaten: Reads (Sichtmodelle, entkoppelt von Embed-Typen)
//
// AP14/B: die Reads laufen auf PostgreSQL (ADR-011 / 2.5) über
// withUserTransaction(); die Identität stammt ausschließlich aus der
// serverseitig geprüften Auth.js-Sitzung. Fehlt sie, wird kein SQL ausgeführt –
// das Ergebnis ist dasselbe wie bisher (ohne Identität liefert die RLS keine
// Zeile), der Abbruch erfolgt aber schon vor dem Verbindungsaufbau. Ein echter
// Datenbankfehler wird dagegen NICHT gefangen: ein fehlendes Tabellenrecht muss
// laut scheitern und darf nicht still eine leere Liste ergeben (Vorbild
// tasks.ts).
//
// Die Projektionen liefern bewusst genau die bisherige Zeilenform – auch die
// verschachtelten Embeds (oncall, stage, customer, profile, phones, stages,
// members). `json_build_object` und `json_agg` gibt der Treiber als fertiges
// Objekt bzw. Array heraus und nicht als Text; die Mapper unten bleiben dadurch
// unverändert. `coalesce(json_agg(...), '[]'::json)` ist zwingend: json_agg über
// eine leere Menge liefert NULL, und die Mapper arbeiten unmittelbar auf dem
// Array. Ein fehlender LEFT-JOIN-Partner wird über `case when ... is null` zu
// NULL, weil json_build_object sonst ein Objekt aus lauter NULL-Werten liefern
// würde und nicht das bisherige NULL.
//
// Der SQL-Text besteht ausschließlich aus Modulkonstanten; kein Read nimmt einen
// Eingabewert, jede `order by`-Klausel ist festes Literal.
// =====================================================================

export type CustomerRow = {
  id: string;
  name: string;
  erp_id: string | null;
  is_active: boolean;
};

export type StageRow = {
  id: string;
  code: string | null;
  name: string;
  description: string | null;
  wus_bst: string | null;
  default_on_call_number_id: string | null;
  default_on_call_label: string | null;
  is_active: boolean;
};

export type VzgLineRow = {
  id: string;
  line_number: string;
  description: string | null;
  construction_stage_id: string;
  stage_name: string;
  is_active: boolean;
};

export type PhoneRow = {
  id: string;
  phone: string;
  phone_type: PhoneType;
  sort_order: number;
};

export type ContactRow = {
  id: string;
  customer_id: string;
  customer_name: string;
  name: string;
  function: string | null;
  function_id: string | null;
  function_label: string | null;
  email: string | null;
  is_active: boolean;
  phones: PhoneRow[];
  stage_ids: string[];
};

export type TechnicianRow = {
  id: string;
  first_name: string;
  last_name: string;
  profile_id: string | null;
  profile_name: string | null;
  is_active: boolean;
};

export type TeamRow = {
  id: string;
  name: string;
  is_active: boolean;
  member_ids: string[];
  member_names: string[];
};

export type CableTypeRow = {
  id: string;
  code: string;
  name: string;
  sort_order: number;
  is_active: boolean;
};

// AUFTRAG_6: die drei pflegbaren Kataloge Gewerk, Funktion (des
// Anrufenden/Ansprechpartners) und Objektart. Tabellenform bewusst nur
// id/label/is_active (0019_hlk_katalog_stammdaten.sql, Abschnitte 1-3) - kein
// code, kein sort_order wie bei CableTypeRow.
export type TradeRow = {
  id: string;
  label: string;
  is_active: boolean;
};

export type ContactFunctionRow = {
  id: string;
  label: string;
  is_active: boolean;
};

export type ObjectTypeRow = {
  id: string;
  label: string;
  is_active: boolean;
};

export type OnCallRow = {
  id: string;
  number: string;
  label: string | null;
  is_active: boolean;
};

export type StageOption = { id: string; label: string };

export type AppSettingsRow = {
  id: number;
  default_customer_id: string | null;
  default_on_call_number_id: string | null;
};

// Rohzeile einer Projektion mit Embed. Bewusst dieselbe offene Form wie bisher
// (`data as Record<string, unknown>[]`), damit die Mapper unverändert bleiben.
type EmbedRow = Record<string, unknown>;

// ---------------------------------------------------------------------
// Kunden
// ---------------------------------------------------------------------
const LIST_CUSTOMERS_SQL = `
  select id, name, erp_id, is_active
    from public.customers
   order by name asc`;

export async function listCustomers(): Promise<CustomerRow[]> {
  const session = await getSessionProfile();
  if (!session) return [];
  return withUserTransaction(session.userId, async (client) => {
    const result = await client.query<CustomerRow>(LIST_CUSTOMERS_SQL);
    return result.rows;
  });
}

export async function getActiveCustomers(): Promise<CustomerRow[]> {
  return (await listCustomers()).filter((c) => c.is_active);
}

// ---------------------------------------------------------------------
// Bauabschnitte (construction_stages) inkl. Bereitschaftsnummer-Label
// ---------------------------------------------------------------------
const LIST_STAGES_SQL = `
  select s.id, s.code, s.name, s.description, s.wus_bst,
         s.default_on_call_number_id, s.is_active,
         case
           when o.id is null then null
           else json_build_object('number', o.number, 'label', o.label)
         end as oncall
    from public.construction_stages s
    left join public.on_call_numbers o on o.id = s.default_on_call_number_id
   order by s.name asc`;

export async function listStages(): Promise<StageRow[]> {
  const session = await getSessionProfile();
  if (!session) return [];
  return withUserTransaction(session.userId, async (client) => {
    const result = await client.query<EmbedRow>(LIST_STAGES_SQL);
    return result.rows.map((s) => {
      const oc = s.oncall as { number?: string; label?: string | null } | null;
      const ocLabel = oc ? (oc.label ? `${oc.number} – ${oc.label}` : oc.number ?? null) : null;
      return {
        id: s.id as string,
        code: (s.code as string | null) ?? null,
        name: s.name as string,
        description: (s.description as string | null) ?? null,
        wus_bst: (s.wus_bst as string | null) ?? null,
        default_on_call_number_id: (s.default_on_call_number_id as string | null) ?? null,
        default_on_call_label: ocLabel,
        is_active: s.is_active as boolean,
      };
    });
  });
}

export async function getActiveStageOptions(): Promise<StageOption[]> {
  return (await listStages())
    .filter((s) => s.is_active)
    .map((s) => ({ id: s.id, label: s.code ? `${s.code} – ${s.name}` : s.name }));
}

// ---------------------------------------------------------------------
// Bereitschaftsnummern (bestehende Tabelle on_call_numbers wiederverwendet)
// ---------------------------------------------------------------------
const LIST_ON_CALL_NUMBERS_SQL = `
  select id, number, label, is_active
    from public.on_call_numbers
   order by number asc`;

export async function listOnCallNumbers(): Promise<OnCallRow[]> {
  const session = await getSessionProfile();
  if (!session) return [];
  return withUserTransaction(session.userId, async (client) => {
    const result = await client.query<OnCallRow>(LIST_ON_CALL_NUMBERS_SQL);
    return result.rows;
  });
}

export async function getActiveOnCallOptions(): Promise<StageOption[]> {
  return (await listOnCallNumbers())
    .filter((o) => o.is_active)
    .map((o) => ({ id: o.id, label: o.label ? `${o.number} – ${o.label}` : o.number }));
}

// ---------------------------------------------------------------------
// VzG-Strecken
// ---------------------------------------------------------------------
// line_number ist text; die Sortierung ist damit wie bisher eine Textsortierung.
const LIST_VZG_LINES_SQL = `
  select v.id, v.line_number, v.description, v.construction_stage_id, v.is_active,
         case
           when s.id is null then null
           else json_build_object('name', s.name, 'code', s.code)
         end as stage
    from public.vzg_lines v
    left join public.construction_stages s on s.id = v.construction_stage_id
   order by v.line_number asc`;

export async function listVzgLines(): Promise<VzgLineRow[]> {
  const session = await getSessionProfile();
  if (!session) return [];
  return withUserTransaction(session.userId, async (client) => {
    const result = await client.query<EmbedRow>(LIST_VZG_LINES_SQL);
    return result.rows.map((v) => {
      const st = v.stage as { name?: string; code?: string | null } | null;
      const stageName = st ? (st.code ? `${st.code} – ${st.name}` : st.name ?? "—") : "—";
      return {
        id: v.id as string,
        line_number: v.line_number as string,
        description: (v.description as string | null) ?? null,
        construction_stage_id: v.construction_stage_id as string,
        stage_name: stageName,
        is_active: v.is_active as boolean,
      };
    });
  });
}

// ---------------------------------------------------------------------
// Ansprechpartner inkl. Telefonnummern + Bauabschnitts-Zuordnung
// ---------------------------------------------------------------------
// `c."function"` bleibt in Anführungszeichen: function ist ein Schlüsselwort,
// und der Spaltenname muss exakt `function` bleiben, weil der Mapper darauf
// zugreift.
const LIST_CONTACTS_SQL = `
  select c.id, c.customer_id, c.name, c."function", c.function_id, c.email, c.is_active,
         case when cu.id is null then null else json_build_object('name', cu.name) end as customer,
         case when cf.id is null then null else json_build_object('label', cf.label) end as contact_function,
         ph.phones,
         cs.stages
    from public.contacts c
    left join public.customers cu on cu.id = c.customer_id
    left join public.contact_functions cf on cf.id = c.function_id
    left join lateral (
      select coalesce(
               json_agg(
                 json_build_object(
                   'id', p.id,
                   'phone', p.phone,
                   'phone_type', p.phone_type,
                   'sort_order', p.sort_order
                 )
                 order by p.sort_order asc
               ),
               '[]'::json
             ) as phones
        from public.contact_phone_numbers p
       where p.contact_id = c.id
    ) ph on true
    left join lateral (
      select coalesce(
               json_agg(json_build_object('construction_stage_id', x.construction_stage_id)),
               '[]'::json
             ) as stages
        from public.construction_stage_contacts x
       where x.contact_id = c.id
    ) cs on true
   order by c.name asc`;

export async function listContacts(): Promise<ContactRow[]> {
  const session = await getSessionProfile();
  if (!session) return [];
  return withUserTransaction(session.userId, async (client) => {
    const result = await client.query<EmbedRow>(LIST_CONTACTS_SQL);
    return result.rows.map((c) => {
      const cust = c.customer as { name?: string } | null;
      const phones = ((c.phones as Record<string, unknown>[]) ?? [])
        .map((p) => ({
          id: p.id as string,
          phone: p.phone as string,
          phone_type: p.phone_type as PhoneType,
          sort_order: Number(p.sort_order ?? 0),
        }))
        .sort((a, b) => a.sort_order - b.sort_order);
      const stage_ids = ((c.stages as Record<string, unknown>[]) ?? []).map(
        (s) => s.construction_stage_id as string,
      );
      const cfn = c.contact_function as { label?: string } | null;
      return {
        id: c.id as string,
        customer_id: c.customer_id as string,
        customer_name: cust?.name ?? "—",
        name: c.name as string,
        function: (c.function as string | null) ?? null,
        function_id: (c.function_id as string | null) ?? null,
        function_label: cfn?.label ?? null,
        email: (c.email as string | null) ?? null,
        is_active: c.is_active as boolean,
        phones,
        stage_ids,
      };
    });
  });
}

// ---------------------------------------------------------------------
// Monteure
// ---------------------------------------------------------------------
const LIST_TECHNICIANS_SQL = `
  select t.id, t.first_name, t.last_name, t.profile_id, t.is_active,
         case when p.id is null then null else json_build_object('full_name', p.full_name) end as profile
    from public.technicians t
    left join public.profiles p on p.id = t.profile_id
   order by t.last_name asc, t.first_name asc`;

export async function listTechnicians(): Promise<TechnicianRow[]> {
  const session = await getSessionProfile();
  if (!session) return [];
  return withUserTransaction(session.userId, async (client) => {
    const result = await client.query<EmbedRow>(LIST_TECHNICIANS_SQL);
    return result.rows.map((t) => {
      const p = t.profile as { full_name?: string | null } | null;
      return {
        id: t.id as string,
        first_name: t.first_name as string,
        last_name: t.last_name as string,
        profile_id: (t.profile_id as string | null) ?? null,
        profile_name: p?.full_name ?? null,
        is_active: t.is_active as boolean,
      };
    });
  });
}

export async function getActiveTechnicians(): Promise<TechnicianRow[]> {
  return (await listTechnicians()).filter((t) => t.is_active);
}

// ---------------------------------------------------------------------
// Teams inkl. Mitglieder
// ---------------------------------------------------------------------
// Die Mitglieder bleiben wie bisher ohne festgelegte Reihenfolge: der Mapper
// sortiert die Namen selbst, und member_ids wird als Menge weiterverwendet.
const LIST_TEAMS_SQL = `
  select t.id, t.name, t.is_active, m.members
    from public.teams t
    left join lateral (
      select coalesce(
               json_agg(
                 json_build_object(
                   'technician_id', tm.technician_id,
                   'technician',
                   case
                     when te.id is null then null
                     else json_build_object('first_name', te.first_name, 'last_name', te.last_name)
                   end
                 )
               ),
               '[]'::json
             ) as members
        from public.team_members tm
        left join public.technicians te on te.id = tm.technician_id
       where tm.team_id = t.id
    ) m on true
   order by t.name asc`;

export async function listTeams(): Promise<TeamRow[]> {
  const session = await getSessionProfile();
  if (!session) return [];
  return withUserTransaction(session.userId, async (client) => {
    const result = await client.query<EmbedRow>(LIST_TEAMS_SQL);
    return result.rows.map((t) => {
      const members = (t.members as Record<string, unknown>[]) ?? [];
      const member_ids = members.map((m) => m.technician_id as string);
      const member_names = members
        .map((m) => {
          const tech = m.technician as { first_name?: string; last_name?: string } | null;
          return tech ? `${tech.first_name ?? ""} ${tech.last_name ?? ""}`.trim() : "";
        })
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b));
      return {
        id: t.id as string,
        name: t.name as string,
        is_active: t.is_active as boolean,
        member_ids,
        member_names,
      };
    });
  });
}

// ---------------------------------------------------------------------
// Kabelarten
// ---------------------------------------------------------------------
// Zweistufige Sortierung: sort_order ist die fachliche Reihenfolge, name nur
// der Tiebreaker. Beide Stufen sind nötig.
const LIST_CABLE_TYPES_SQL = `
  select id, code, name, sort_order, is_active
    from public.cable_types
   order by sort_order asc, name asc`;

export async function listCableTypes(): Promise<CableTypeRow[]> {
  const session = await getSessionProfile();
  if (!session) return [];
  return withUserTransaction(session.userId, async (client) => {
    const result = await client.query<CableTypeRow>(LIST_CABLE_TYPES_SQL);
    return result.rows;
  });
}

// ---------------------------------------------------------------------
// AUFTRAG_6 – Gewerke (public.trades)
// ---------------------------------------------------------------------
const LIST_TRADES_SQL = `
  select id, label, is_active
    from public.trades
   order by label asc`;

export async function listTrades(): Promise<TradeRow[]> {
  const session = await getSessionProfile();
  if (!session) return [];
  return withUserTransaction(session.userId, async (client) => {
    const result = await client.query<TradeRow>(LIST_TRADES_SQL);
    return result.rows;
  });
}

export async function getActiveTradeOptions(): Promise<StageOption[]> {
  return (await listTrades())
    .filter((t) => t.is_active)
    .map((t) => ({ id: t.id, label: t.label }));
}

// ---------------------------------------------------------------------
// AUFTRAG_6 – Funktionen des Anrufenden/Ansprechpartners
// (public.contact_functions)
// ---------------------------------------------------------------------
const LIST_CONTACT_FUNCTIONS_SQL = `
  select id, label, is_active
    from public.contact_functions
   order by label asc`;

export async function listContactFunctions(): Promise<ContactFunctionRow[]> {
  const session = await getSessionProfile();
  if (!session) return [];
  return withUserTransaction(session.userId, async (client) => {
    const result = await client.query<ContactFunctionRow>(LIST_CONTACT_FUNCTIONS_SQL);
    return result.rows;
  });
}

export async function getActiveContactFunctionOptions(): Promise<StageOption[]> {
  return (await listContactFunctions())
    .filter((f) => f.is_active)
    .map((f) => ({ id: f.id, label: f.label }));
}

// ---------------------------------------------------------------------
// AUFTRAG_6 – Objektarten (Anlagen, inkl. LST-Elemente) (public.object_types)
// ---------------------------------------------------------------------
const LIST_OBJECT_TYPES_SQL = `
  select id, label, is_active
    from public.object_types
   order by label asc`;

export async function listObjectTypes(): Promise<ObjectTypeRow[]> {
  const session = await getSessionProfile();
  if (!session) return [];
  return withUserTransaction(session.userId, async (client) => {
    const result = await client.query<ObjectTypeRow>(LIST_OBJECT_TYPES_SQL);
    return result.rows;
  });
}

export async function getActiveObjectTypeOptions(): Promise<StageOption[]> {
  return (await listObjectTypes())
    .filter((o) => o.is_active)
    .map((o) => ({ id: o.id, label: o.label }));
}

// ---------------------------------------------------------------------
// Benutzerkonten (profiles) – Optionen für optionale Monteur-Verknüpfung
// ---------------------------------------------------------------------
const LIST_PROFILE_OPTIONS_SQL = `
  select id, full_name, role
    from public.profiles
   order by full_name asc`;

type ProfileOptionRow = { id: string; full_name: string | null; role: string };

export async function listProfileOptions(): Promise<StageOption[]> {
  const session = await getSessionProfile();
  if (!session) return [];
  return withUserTransaction(session.userId, async (client) => {
    const result = await client.query<ProfileOptionRow>(LIST_PROFILE_OPTIONS_SQL);
    return result.rows.map((p) => ({
      id: p.id,
      label: `${p.full_name ?? p.id} (${p.role})`,
    }));
  });
}

// ---------------------------------------------------------------------
// AUFTRAG_14 – Qualifikationen (public.qualifications) und ihre Zuordnung zu
// Monteuren (public.technician_qualifications, n:m). Tabellenform laut
// 0022_hlk_dispo_board.sql: id/label/rank/color/is_active - Muster der
// 0019-Kataloge, ergänzt um rank/color (der Auftrag zählt diese beiden
// zusätzlichen Spalten ausdrücklich auf).
// ---------------------------------------------------------------------
const LIST_QUALIFICATIONS_SQL = `
  select id, label, rank, color, is_active
    from public.qualifications
   order by rank desc, label asc`;

export async function listQualifications(): Promise<QualificationRow[]> {
  const session = await getSessionProfile();
  if (!session) return [];
  return withUserTransaction(session.userId, async (client) => {
    const result = await client.query<QualificationRow>(LIST_QUALIFICATIONS_SQL);
    return result.rows;
  });
}

export async function getActiveQualifications(): Promise<QualificationRow[]> {
  return (await listQualifications()).filter((q) => q.is_active);
}

const LIST_TECHNICIAN_QUALIFICATIONS_SQL = `
  select technician_id, qualification_id
    from public.technician_qualifications`;

type TechnicianQualificationLink = { technician_id: string; qualification_id: string };

/** Alle Zuordnungen Monteur<->Qualifikation, flach - Gruppieren macht der Aufrufer. */
export async function listTechnicianQualificationLinks(): Promise<TechnicianQualificationLink[]> {
  const session = await getSessionProfile();
  if (!session) return [];
  return withUserTransaction(session.userId, async (client) => {
    const result = await client.query<TechnicianQualificationLink>(LIST_TECHNICIAN_QUALIFICATIONS_SQL);
    return result.rows;
  });
}

/** Qualifikations-Kennungen eines EINZELNEN Monteurs (Pflegeseite Monteure). */
export async function getQualificationIdsForTechnician(technicianId: string): Promise<string[]> {
  const links = await listTechnicianQualificationLinks();
  return links.filter((l) => l.technician_id === technicianId).map((l) => l.qualification_id);
}

export type TechnicianWithColor = TechnicianRow & {
  qualification_ids: string[];
  color: QualificationColorKey;
};

/**
 * Aktive Monteure für das Dispo-Board, je Monteur ergänzt um seine
 * Qualifikations-Kennungen und die daraus abgeleitete Farbe (höchster rank
 * einer AKTIVEN Qualifikation, sonst die neutrale Standardfarbe) - Punkt 3
 * des Auftrags ("höchste Qualifikation bestimmt die Hintergrundfarbe").
 */
export async function getActiveTechniciansWithColor(): Promise<TechnicianWithColor[]> {
  const [technicians, links, catalog] = await Promise.all([
    getActiveTechnicians(),
    listTechnicianQualificationLinks(),
    getActiveQualifications(),
  ]);
  return technicians.map((t) => {
    const qualification_ids = links.filter((l) => l.technician_id === t.id).map((l) => l.qualification_id);
    return { ...t, qualification_ids, color: technicianColorKey(qualification_ids, catalog) };
  });
}

// ---------------------------------------------------------------------
// App-Einstellungen (Singleton)
// ---------------------------------------------------------------------
// `id = 1` ist die feste Singletonbedingung aus der Migration (app_settings.id
// ist smallint mit check id = 1) und kein Eingabewert.
const APP_SETTINGS_SQL = `
  select id, default_customer_id, default_on_call_number_id
    from public.app_settings
   where id = 1`;

// Vorgabewert für "keine Sitzung" und "keine Zeile" – wie bisher identisch.
function defaultAppSettings(): AppSettingsRow {
  return {
    id: 1,
    default_customer_id: null,
    default_on_call_number_id: null,
  };
}

export async function getAppSettings(): Promise<AppSettingsRow> {
  const session = await getSessionProfile();
  if (!session) return defaultAppSettings();
  return withUserTransaction(session.userId, async (client) => {
    const result = await client.query<AppSettingsRow>(APP_SETTINGS_SQL);
    return result.rows[0] ?? defaultAppSettings();
  });
}
