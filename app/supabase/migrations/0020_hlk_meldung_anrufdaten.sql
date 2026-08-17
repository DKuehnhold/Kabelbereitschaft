-- =====================================================================
-- Kabelbereitschaft – AUFTRAG_7 (Migration 0020): Anrufdaten an der Meldung
-- (Anrufzeitpunkt, Anrufender, Gewerk) und das "In Klaerung"-Kennzeichen.
--
-- Grundlage: 00-Projektsteuerung/AUFTRAG_7.md und
-- 01-Anforderungen/ANFORDERUNG_DISPO_METADATEN.md (Excel-Bloecke "Meldung"/
-- "Bearbeitung"), Entscheidungen Dennis vom 2026-08-16. Additiv zu 0001-0019,
-- keine bestehende Definition wird entfernt, keine bestehende Policy geloest
-- oder gelockert.
--
-- FACHLICHE FESTLEGUNG "ANNAHME = ANLAGE" (verbindlich, AUFTRAG_7.md): die
-- Excel fuehrt Anrufzeit UND Annahmezeit, weil sie ein Papierfluss ist. In der
-- App ist die Annahme der Anlagezeitpunkt - created_at/created_by
-- (0001_init.sql) bilden "Annahme Datum/Uhrzeit/Mitarbeiter" bereits ab. Diese
-- Migration legt AUSDRUECKLICH KEINE Spalten accepted_at/accepted_by an.
--
-- UMFANG dieser Datei (wortgetreu aus AUFTRAG_7.md, Abschnitt "Umfang"):
--   1. Vier additive Spalten auf public.incidents: reported_at (Anrufzeitpunkt),
--      caller_contact_id (Anrufender, FK contacts), trade_id (Gewerk an der
--      Meldung, FK trades, 0019), is_in_clarification ("In Klaerung"-
--      Kennzeichen, Namensschema wie is_false_alarm/0018, hier OHNE Waechter).
--   2. public.incident_list_view neu definiert mit is_in_clarification,
--      trade_id und trade_label (Join auf public.trades) AUSSCHLIESSLICH ans
--      ENDE der Spaltenliste angehaengt - bestehende Spalten behalten ihre
--      Position (Regel aus 0018 Abschnitt 3).
--   3. create_incident_ap12 additiv um drei nachgestellte, defaultbehaftete
--      Parameter erweitert (p_reported_at, p_caller_contact_id, p_trade_id),
--      damit die Erfassung (createIncident() in incident-actions.ts) die drei
--      neuen Felder optional mitgeben kann. Ausfuehrliche Begruendung des
--      DROP/CREATE-Vorgehens in Abschnitt 5 unten.
--
-- "In Klaerung" ist laut Entscheidung Dennis ein KENNZEICHEN, KEIN STATUS:
-- setzbar von jedem, der die Meldung per incidents_update aendern darf
-- (is_staff() ODER der aktiv zugewiesene Monteur, 0001_init.sql:544-546) - KEIN
-- Waechter-Trigger, KEINE eigene Rollenbeschraenkung ueber incidents_update
-- hinaus. Das unterscheidet is_in_clarification bewusst von is_false_alarm
-- (0018), dessen Waechter ausschliesslich die Rolle Disponent zulaesst. Ein
-- UI-Umschalter fuer is_in_clarification kommt mit der Listen-/Detailscheibe
-- (AUFTRAG_8), NICHT hier.
--
-- IDENTITAETSQUELLE seit 0012/0013: app.current_user_id() statt auth.uid() -
-- diese Migration braucht keine eigene Policy/Funktion und damit auch keinen
-- eigenen Bezug auf die Identitaetsquelle.
-- =====================================================================

set check_function_bodies = off;

-- ---------------------------------------------------------------------
-- 1) Spalte: Anrufzeitpunkt (public.incidents.reported_at)
--
-- Nullable OHNE Default: Bestandsmeldungen bleiben NULL (AUFTRAG_7.md,
-- fachliche Festlegung). Die Erfassung belegt das Feld optional vor (Jetzt,
-- editierbar) - das ist Sache der Anwendung (NewIncidentForm.tsx), nicht der
-- Datenbank. Ein einzelner guarded `add column if not exists` genuegt: ohne
-- NOT NULL/Default gibt es keinen Backfill-Pflichtfall wie bei is_false_alarm
-- (0018) - ein VORLAUF-Fund mit exakt diesem Zieltyp waere bereits im
-- Zielzustand (dasselbe Argument wie bei contacts.function_id, 0019
-- Abschnitt 4).
-- ---------------------------------------------------------------------
alter table public.incidents
  add column if not exists reported_at timestamptz;

comment on column public.incidents.reported_at is
  'AUFTRAG_7: Anrufzeitpunkt (Excel-Feld "Anruf Datum/Uhrzeit"). Nullable ohne '
  'Default - Bestandsmeldungen bleiben NULL. "Annahme" bleibt ausdruecklich der '
  'Anlagezeitpunkt (created_at/created_by) - es gibt KEINE Spalten '
  'accepted_at/accepted_by (Entscheidung Dennis, AUFTRAG_7.md).';

-- ---------------------------------------------------------------------
-- 2) Spalte: Anrufender (public.incidents.caller_contact_id)
--
-- Nullable, FK auf public.contacts(id), NICHT kaskadierend (keine
-- `on delete`-Klausel = ON DELETE NO ACTION, gleiches Muster wie
-- contacts.function_id, 0019 Abschnitt 4, und incidents.contact_id, 0010
-- Abschnitt 1). Die bestehenden Freitext-Fallbacks caller_name/caller_contact
-- (0001_init.sql) bleiben UNVERAENDERT bestehen - diese Spalte ergaenzt sie,
-- ersetzt sie nicht.
-- ---------------------------------------------------------------------
alter table public.incidents
  add column if not exists caller_contact_id uuid references public.contacts(id);

comment on column public.incidents.caller_contact_id is
  'AUFTRAG_7: Anrufender als Verknuepfung auf public.contacts, nullable, FK '
  'NICHT kaskadierend. Ergaenzt die bestehenden Freitext-Fallbacks '
  'caller_name/caller_contact und ersetzt sie nicht.';

-- ---------------------------------------------------------------------
-- 3) Spalte: Gewerk an der Meldung (public.incidents.trade_id)
--
-- Nullable, FK auf public.trades(id) (0019, AUFTRAG_6), NICHT kaskadierend.
-- Optionales Auswahlfeld in der Erfassung (Stoerungs-Spalte,
-- NewIncidentForm.tsx).
-- ---------------------------------------------------------------------
alter table public.incidents
  add column if not exists trade_id uuid references public.trades(id);

comment on column public.incidents.trade_id is
  'AUFTRAG_7: Gewerk an der Meldung, Verknuepfung auf public.trades (0019), '
  'nullable, FK NICHT kaskadierend.';

-- ---------------------------------------------------------------------
-- 4) Spalte: "In Klaerung"-Kennzeichen (public.incidents.is_in_clarification)
--
-- Idempotente Herstellung sinngemaess nach dem 0018-Abschnitt-1-Muster
-- 1a-1e, HIER OHNE SCHRITT 1a (Waechter voruebergehend entfernen): diese
-- Spalte traegt laut Entscheidung Dennis (AUFTRAG_7.md) AUSDRUECKLICH KEINEN
-- Waechter-Trigger - es gibt schlicht keinen Waechter, der den Backfill in
-- 1d stoeren koennte. Die Schritte 1b-1e bleiben aus demselben Grund wie bei
-- 0018 Pflicht: ein VORLAUF-Fund dieser Spalte als nullable/ohne Default
-- wuerde `add column if not exists` in 1b vollstaendig ueberspringen, NOT
-- NULL und Default also NICHT nachziehen.
-- ---------------------------------------------------------------------

-- 1b) Frischer Fall: Spalte in EINEM Schritt korrekt anlegen.
alter table public.incidents
  add column if not exists is_in_clarification boolean not null default false;

-- 1c) Reparaturfall: Default nachziehen.
alter table public.incidents
  alter column is_in_clarification set default false;

-- 1d) Reparaturfall: bestehende NULL-Werte auffuellen.
update public.incidents
   set is_in_clarification = false
 where is_in_clarification is null;

-- 1e) Reparaturfall: NOT NULL nachziehen.
alter table public.incidents
  alter column is_in_clarification set not null;

comment on column public.incidents.is_in_clarification is
  'AUFTRAG_7: "In Klaerung"-Kennzeichen, Namensschema wie is_false_alarm '
  '(0018). Kennzeichen, KEIN Status - setzbar von jedem, der die Meldung per '
  'incidents_update aendern darf (is_staff() ODER der aktiv zugewiesene '
  'Monteur, 0001_init.sql:544-546). KEIN Waechter-Trigger, KEINE eigene '
  'Rollenbeschraenkung (Entscheidung Dennis, AUFTRAG_7.md). Ein UI-Umschalter '
  'folgt mit der Listen-/Detailscheibe (AUFTRAG_8).';

-- ---------------------------------------------------------------------
-- 5) create_incident_ap12: additive Erweiterung um drei nachgestellte,
--    defaultbehaftete Parameter (p_reported_at, p_caller_contact_id,
--    p_trade_id)
--
-- WARUM ERST DROP FUNCTION, DANN CREATE OR REPLACE FUNCTION, ausdruecklich
-- begruendet: Postgres bestimmt die Identitaet einer Funktion fuer
-- `create or replace function` ueber die VOLLSTAENDIGE Parametertypliste
-- (proargtypes) - UNABHAENGIG davon, ob einzelne Parameter einen Default
-- tragen. Ein `create or replace function` mit drei zusaetzlichen,
-- nachgestellten Parametern legt deshalb NICHT die bestehende 21-Parameter-
-- Fassung (0010_ap12_incident_details.sql:83-104) neu an, sondern eine
-- ZWEITE, ueberladene Fassung mit 24 Parametern - beide blieben nebeneinander
-- bestehen, die alte weiterhin mit dem aus 0014_ap14b_data_grants.sql:88-91
-- geerbten Ausfuehrungsrecht fuer app_user. Zwei parallele Anlagewege
-- unter demselben Namen widersprechen dem Auftrag ("additive Felder", kein
-- zweiter Datenpfad). Der ausdrueckliche `drop function if exists` auf die
-- EXAKTE alte 21-Parameter-Signatur entfernt diese Fassung samt ihrer Rechte,
-- bevor die neue, um drei Parameter erweiterte Fassung unter demselben Namen
-- entsteht.
--
-- RUECKWIRKUNGSLOS fuer die bereits GELAUFENEN Smokes 17_ap12_details.sql und
-- 20_ap14b_data.sql: beide rufen create_incident_ap12 mit 21 Positions-
-- argumenten und pruefen die 21-Parameter-Signatur ueber
-- has_function_privilege - aber beide stehen in der Kette (run_db_tests.sh,
-- run_ap14b_local.ps1) VOR dieser Migration 0020 und sehen die 21-Parameter-
-- Fassung an IHRER Stelle in der Kette, als sie noch bestand. Kein spaeterer
-- SQL-Smoke und keine Node-Integrationssuite ruft create_incident_ap12 direkt
-- mit exakt 21 Argumenten oder ueber eine Signaturzeichenkette (geprüft:
-- einzige weitere direkte Aufrufer sind app/src/lib/incident-actions.ts, das
-- mit dieser Migration auf 24 Argumente umgestellt wird).
--
-- BESTEHENDE AUFRUFER MIT WENIGER ALS 24 ARGUMENTEN BLEIBEN LAUFFAEHIG:
-- PostgreSQL loest einen Funktionsaufruf mit weniger Positionsargumenten als
-- deklarierten Parametern gegen die REGULAERE Funktionsaufloesung auf, sofern
-- die fehlenden, nachgestellten Parameter Defaults tragen - ein Aufruf mit
-- genau 21 Argumenten trifft die neue 24-Parameter-Fassung ebenso wie zuvor
-- die 21-Parameter-Fassung, die letzten drei Spalten bleiben dann NULL. Das
-- gilt NICHT fuer eine Signaturaufloesung ueber eine Zeichenkette
-- (has_function_privilege/regprocedure/to_regprocedure): die verlangt eine
-- EXAKTE Parameterliste und braucht deshalb den expliziten drop oben, damit
-- die alte Signatur nach dieser Migration nachweislich NICHT mehr aufloesbar
-- ist (siehe Pruefblock in Abschnitt 7).
drop function if exists public.create_incident_ap12(
  uuid, uuid, uuid, uuid, public.incident_priority, text, text, text, text, text,
  text, text, text, numeric, numeric, text, text, text, uuid, uuid, jsonb
);

create or replace function public.create_incident_ap12(
  p_customer_id uuid,
  p_construction_stage_id uuid,
  p_vzg_line_id uuid,
  p_on_call_number_id uuid,
  p_priority public.incident_priority,
  p_description text,
  p_operating_point text,
  p_track text,
  p_direction text,
  p_object_type text,
  p_object_designation text,
  p_location_description text,
  p_external_reference text,
  p_km_from numeric,
  p_km_to numeric,
  p_caller_name text,
  p_caller_contact text,
  p_internal_note text,
  p_contact_id uuid,
  p_contact_phone_number_id uuid,
  p_cable_positions jsonb,
  p_reported_at timestamptz default null,
  p_caller_contact_id uuid default null,
  p_trade_id uuid default null
) returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_id uuid;
  v_vzg_number text;
  v_vzg_stage uuid;
  v_contact_name text;
  v_contact_function text;
  v_contact_customer uuid;
  v_phone text;
  v_phone_contact uuid;
  v_position jsonb;
  v_cable_type_id uuid;
  v_quantity numeric(12,3);
  v_unit text;
  v_condition text;
  v_sort integer := 0;
begin
  if p_customer_id is null or p_construction_stage_id is null or p_vzg_line_id is null
     or p_priority is null or nullif(btrim(p_description), '') is null
     or p_cable_positions is null or jsonb_typeof(p_cable_positions) <> 'array'
     or jsonb_array_length(p_cable_positions) = 0 then
    raise exception 'Pflichtfelder fehlen.' using errcode = '23514';
  end if;

  select line_number, construction_stage_id into v_vzg_number, v_vzg_stage
  from public.vzg_lines where id = p_vzg_line_id;
  if v_vzg_number is null then
    raise exception 'VzG-Strecke nicht gefunden.' using errcode = '23503';
  end if;
  if v_vzg_stage <> p_construction_stage_id then
    raise exception 'VzG-Strecke gehört nicht zum gewählten Bauabschnitt.' using errcode = '23514';
  end if;

  if p_contact_id is not null then
    select name, function, customer_id
      into v_contact_name, v_contact_function, v_contact_customer
    from public.contacts where id = p_contact_id and is_active;
    if v_contact_name is null then
      raise exception 'Ansprechpartner nicht gefunden oder inaktiv.' using errcode = '23503';
    end if;
    if v_contact_customer <> p_customer_id then
      raise exception 'Ansprechpartner gehört nicht zum gewählten Kunden.' using errcode = '23514';
    end if;
    if p_contact_phone_number_id is not null then
      select phone, contact_id into v_phone, v_phone_contact
      from public.contact_phone_numbers where id = p_contact_phone_number_id;
      if v_phone is null or v_phone_contact <> p_contact_id then
        raise exception 'Telefonnummer gehört nicht zum Ansprechpartner.' using errcode = '23514';
      end if;
    end if;
  elsif p_contact_phone_number_id is not null then
    raise exception 'Telefonnummer erfordert einen Ansprechpartner.' using errcode = '23514';
  end if;

  -- p_caller_contact_id und p_trade_id werden bewusst OHNE zusaetzliche
  -- fachliche Pruefung (Aktiv-Status, Kundenzugehoerigkeit) uebernommen - der
  -- Auftrag verlangt das nicht, und die FK-Constraints (Abschnitte 2/3 oben)
  -- erzwingen bereits die Existenz. Anders als p_contact_id (der
  -- benachrichtigte Ansprechpartner der Disposition/des Monteurs, mit
  -- Aktiv-/Kundenpruefung oben) ist caller_contact_id ein rein
  -- dokumentarischer Verweis auf "wer hat angerufen" ohne weitere fachliche
  -- Kopplung.
  insert into public.incidents (
    customer_id, construction_stage_id, vzg_line_id, vzg_line_number, on_call_number_id,
    priority, description, operating_point, track, direction, object_type, object_designation,
    location_description, external_reference, km_from, km_to, caller_name, caller_contact,
    internal_note, call_received_at, status, contact_id, contact_phone_number_id,
    contact_name_snapshot, contact_function_snapshot, contact_phone_snapshot,
    reported_at, caller_contact_id, trade_id
  ) values (
    p_customer_id, p_construction_stage_id, p_vzg_line_id, v_vzg_number, p_on_call_number_id,
    p_priority, p_description, p_operating_point, p_track, p_direction, p_object_type, p_object_designation,
    p_location_description, p_external_reference, p_km_from, p_km_to, p_caller_name, p_caller_contact,
    p_internal_note, now(), 'neu', p_contact_id, p_contact_phone_number_id,
    v_contact_name, v_contact_function, v_phone,
    p_reported_at, p_caller_contact_id, p_trade_id
  ) returning id into v_id;

  for v_position in select value from jsonb_array_elements(p_cable_positions)
  loop
    begin
      v_cable_type_id := nullif(v_position->>'cable_type_id', '')::uuid;
      v_quantity := nullif(replace(v_position->>'quantity_value', ',', '.'), '')::numeric;
    exception when invalid_text_representation then
      raise exception 'Ungültige Kabelposition.' using errcode = '23514';
    end;
    v_unit := nullif(v_position->>'quantity_unit', '');
    v_condition := nullif(v_position->>'condition_code', '');
    if v_cable_type_id is null or v_quantity is null or v_unit is null or v_condition is null then
      raise exception 'Jede neue Kabelposition benötigt Kabelart, Menge, Einheit und Zustand.' using errcode = '23514';
    end if;
    insert into public.incident_cable_positions (
      incident_id, cable_type_id, sort_order, quantity_value, quantity_unit, condition_code
    ) values (
      v_id, v_cable_type_id, v_sort, v_quantity, v_unit, v_condition
    );
    v_sort := v_sort + 1;
  end loop;
  return v_id;
end $$;

-- Rechte ausschliesslich fuer app_user, direkt (kein `grant` an public, anon
-- oder authenticated) - dieselbe Konvention wie jede seit 0014 neu vergebene
-- Ausfuehrungsberechtigung (0018 braucht keine, 0019 vergibt nur
-- Tabellenrechte). Das `drop function` oben hat die Rechte der alten
-- 21-Parameter-Fassung bereits mit dem Objekt entfernt.
revoke all on function public.create_incident_ap12(
  uuid, uuid, uuid, uuid, public.incident_priority, text, text, text, text, text,
  text, text, text, numeric, numeric, text, text, text, uuid, uuid, jsonb,
  timestamptz, uuid, uuid
) from public, anon, authenticated;
grant execute on function public.create_incident_ap12(
  uuid, uuid, uuid, uuid, public.incident_priority, text, text, text, text, text,
  text, text, text, numeric, numeric, text, text, text, uuid, uuid, jsonb,
  timestamptz, uuid, uuid
) to app_user;

-- ---------------------------------------------------------------------
-- 6) View: incident_list_view um is_in_clarification, trade_id und
--    trade_label ergaenzen
--
-- Vollstaendige Neudefinition (wie bei jeder Aenderung dieser View seit
-- 0009): `create or replace view` verlangt dieselbe Spaltenreihenfolge fuer
-- alle bereits vorhandenen Spalten; neue Spalten duerfen nur am ENDE
-- angehaengt werden (Regel aus 0018 Abschnitt 3). Quelle dieser Definition:
-- 0018_ap15b_incident_metrics.sql (letzte Neudefinition, fuegte
-- is_false_alarm hinzu; 0019 aenderte diese View nicht). Die drei neuen
-- Spalten stehen in der im Auftrag genannten Reihenfolge ganz am Ende:
-- is_in_clarification, trade_id, trade_label.
-- ---------------------------------------------------------------------
create or replace view public.incident_list_view
with (security_invoker = true) as
select
  i.id,
  i.incident_no,
  i.status,
  i.priority,
  i.customer_id,
  c.name                                   as customer_name,
  i.construction_stage_id,
  cs.code                                  as stage_code,
  cs.name                                  as stage_name,
  i.vzg_line_id,
  i.vzg_line_number,
  vl.line_number                           as vzg_line_ref,
  i.on_call_number_id,
  ocn.number                               as on_call_number,
  ocn.label                                as on_call_label,
  i.operating_point,
  i.km_from,
  i.km_to,
  i.created_at,
  i.created_by,
  i.updated_at,
  (i.created_at at time zone 'Europe/Berlin')::date as created_date_local,
  coalesce(img.cnt, 0)                      as image_count,
  coalesce(cab.names, array[]::text[])      as cable_arts,
  coalesce(mon.names, array[]::text[])      as monteur_names,
  coalesce(mon.ids, array[]::uuid[])        as monteur_ids,
  (mon.ids is null or array_length(mon.ids, 1) is null)   as no_monteur,
  (coalesce(img.cnt, 0) = 0)                              as no_images,
  (cab.names is null or array_length(cab.names, 1) is null) as no_cable,
  (i.vzg_line_id is null and i.vzg_line_number is not null) as historic_vzg,
  lower(
    coalesce(i.incident_no::text, '') || ' ' ||
    coalesce(c.name, '') || ' ' ||
    coalesce(cs.code, '') || ' ' ||
    coalesce(cs.name, '') || ' ' ||
    coalesce(vl.line_number, i.vzg_line_number, '') || ' ' ||
    coalesce(i.operating_point, '') || ' ' ||
    coalesce(i.description, '') || ' ' ||
    coalesce(i.external_reference, '')
  ) as search_text,
  exists (
    select 1 from public.incident_tasks t
    where t.incident_id = i.id
      and t.status in ('open', 'in_progress')
  )                                         as has_open_task,
  i.is_false_alarm,
  i.is_in_clarification,
  i.trade_id,
  tr.label                                  as trade_label
from public.incidents i
left join public.customers c            on c.id = i.customer_id
left join public.construction_stages cs on cs.id = i.construction_stage_id
left join public.vzg_lines vl           on vl.id = i.vzg_line_id
left join public.on_call_numbers ocn    on ocn.id = i.on_call_number_id
left join public.trades tr              on tr.id = i.trade_id
left join lateral (
  select count(*)::int as cnt
  from public.incident_images ii
  where ii.incident_id = i.id and ii.deleted_at is null
) img on true
left join lateral (
  select array_agg(ct.name order by cp.sort_order) as names
  from public.incident_cable_positions cp
  join public.cable_types ct on ct.id = cp.cable_type_id
  where cp.incident_id = i.id
) cab on true
left join lateral (
  select array_agg(p.full_name order by p.full_name) as names,
         array_agg(a.monteur_id) as ids
  from public.incident_assignments a
  join public.profiles p on p.id = a.monteur_id
  where a.incident_id = i.id and a.is_active
) mon on true;

-- Die View ist security_invoker; ihre Grants (0014_ap14b_data_grants.sql)
-- gelten fuer die View als Objekt, nicht fuer einzelne Spalten - kein
-- erneutes GRANT hier noetig. Das neue LEFT JOIN auf public.trades aendert
-- daran nichts: SELECT auf public.trades ist seit 0019 fuer jeden
-- Angemeldeten erlaubt (trades_select using app.current_user_id() is not
-- null), und security_invoker fuehrt die View mit den Rechten UND der RLS
-- des aufrufenden Benutzers aus - keine Rechteausweitung.

-- =====================================================================
-- 7) Abschlusspruefungen (fail-closed)
-- =====================================================================

-- 7a) Spalten vorhanden mit den richtigen Typen; is_in_clarification
--     zusaetzlich im Zielzustand NOT NULL DEFAULT false (Muster aus 0018 W1).
do $$
declare
  v_reported_at_type text;
  v_caller_contact_type text;
  v_trade_type text;
  v_clarif_type text;
  v_clarif_notnull boolean;
  v_clarif_hasdef boolean;
  v_clarif_default text;
begin
  select a.atttypid::regtype::text into v_reported_at_type
  from pg_attribute a
  where a.attrelid = 'public.incidents'::regclass
    and a.attname = 'reported_at' and not a.attisdropped;
  if v_reported_at_type is distinct from 'timestamp with time zone' then
    raise exception
      'AUFTRAG_7/0020: incidents.reported_at fehlt oder hat den falschen Typ (%)',
      coalesce(v_reported_at_type, 'Spalte fehlt');
  end if;

  select a.atttypid::regtype::text into v_caller_contact_type
  from pg_attribute a
  where a.attrelid = 'public.incidents'::regclass
    and a.attname = 'caller_contact_id' and not a.attisdropped;
  if v_caller_contact_type is distinct from 'uuid' then
    raise exception
      'AUFTRAG_7/0020: incidents.caller_contact_id fehlt oder hat den falschen Typ (%)',
      coalesce(v_caller_contact_type, 'Spalte fehlt');
  end if;

  select a.atttypid::regtype::text into v_trade_type
  from pg_attribute a
  where a.attrelid = 'public.incidents'::regclass
    and a.attname = 'trade_id' and not a.attisdropped;
  if v_trade_type is distinct from 'uuid' then
    raise exception
      'AUFTRAG_7/0020: incidents.trade_id fehlt oder hat den falschen Typ (%)',
      coalesce(v_trade_type, 'Spalte fehlt');
  end if;

  select
    a.atttypid::regtype::text, a.attnotnull, a.atthasdef,
    (
      select pg_get_expr(d.adbin, d.adrelid)
      from pg_attrdef d
      where d.adrelid = a.attrelid and d.adnum = a.attnum
    )
  into v_clarif_type, v_clarif_notnull, v_clarif_hasdef, v_clarif_default
  from pg_attribute a
  where a.attrelid = 'public.incidents'::regclass
    and a.attname = 'is_in_clarification' and not a.attisdropped;

  if v_clarif_type is distinct from 'boolean' then
    raise exception
      'AUFTRAG_7/0020: incidents.is_in_clarification fehlt oder hat den falschen Typ (%)',
      coalesce(v_clarif_type, 'Spalte fehlt');
  end if;
  if v_clarif_notnull is distinct from true then
    raise exception
      'AUFTRAG_7/0020: incidents.is_in_clarification ist nicht NOT NULL (attnotnull=%)',
      coalesce(v_clarif_notnull::text, 'NULL');
  end if;
  if v_clarif_hasdef is distinct from true or v_clarif_default is distinct from 'false' then
    raise exception
      'AUFTRAG_7/0020: incidents.is_in_clarification hat nicht den Defaultausdruck false (atthasdef=%, default=%)',
      coalesce(v_clarif_hasdef::text, 'NULL'), coalesce(v_clarif_default, 'NULL');
  end if;

  raise notice
    'AUFTRAG_7/0020 OK: reported_at (timestamptz), caller_contact_id/trade_id (uuid) vorhanden; is_in_clarification ist boolean NOT NULL DEFAULT false';
end
$$;

-- 7b) Fremdschluesselpruefung: caller_contact_id und trade_id sind NICHT
--     kaskadierend (confdeltype 'a' = NO ACTION bzw. 'r' = RESTRICT;
--     kaskadierend waere 'c'). Muster aus 0019, Abschlusspruefung.
do $$
declare
  v_confdeltype "char";
begin
  select con.confdeltype into v_confdeltype
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_namespace ns on ns.oid = rel.relnamespace
  join pg_attribute att on att.attrelid = con.conrelid and att.attnum = any(con.conkey)
  where ns.nspname = 'public' and rel.relname = 'incidents'
    and con.contype = 'f' and att.attname = 'caller_contact_id';

  if v_confdeltype is null then
    raise exception 'AUFTRAG_7/0020: kein Fremdschluessel auf incidents.caller_contact_id gefunden';
  end if;
  if v_confdeltype = 'c' then
    raise exception
      'AUFTRAG_7/0020: incidents.caller_contact_id ist entgegen dem Auftrag kaskadierend (ON DELETE CASCADE)';
  end if;
end
$$;

do $$
declare
  v_confdeltype "char";
begin
  select con.confdeltype into v_confdeltype
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_namespace ns on ns.oid = rel.relnamespace
  join pg_attribute att on att.attrelid = con.conrelid and att.attnum = any(con.conkey)
  where ns.nspname = 'public' and rel.relname = 'incidents'
    and con.contype = 'f' and att.attname = 'trade_id';

  if v_confdeltype is null then
    raise exception 'AUFTRAG_7/0020: kein Fremdschluessel auf incidents.trade_id gefunden';
  end if;
  if v_confdeltype = 'c' then
    raise exception
      'AUFTRAG_7/0020: incidents.trade_id ist entgegen dem Auftrag kaskadierend (ON DELETE CASCADE)';
  end if;
end
$$;

-- 7c) View enthaelt die drei neuen Spalten GENAU an den letzten drei
--     Positionen, in der im Auftrag genannten Reihenfolge.
do $$
declare
  v_total integer;
  v_pos_clarif integer;
  v_pos_trade integer;
  v_pos_label integer;
begin
  select count(*) into v_total
  from information_schema.columns
  where table_schema = 'public' and table_name = 'incident_list_view';

  select ordinal_position into v_pos_clarif from information_schema.columns
   where table_schema = 'public' and table_name = 'incident_list_view'
     and column_name = 'is_in_clarification';
  select ordinal_position into v_pos_trade from information_schema.columns
   where table_schema = 'public' and table_name = 'incident_list_view'
     and column_name = 'trade_id';
  select ordinal_position into v_pos_label from information_schema.columns
   where table_schema = 'public' and table_name = 'incident_list_view'
     and column_name = 'trade_label';

  if v_pos_clarif is null or v_pos_trade is null or v_pos_label is null then
    raise exception
      'AUFTRAG_7/0020: mindestens eine der neuen Spalten fehlt in incident_list_view (is_in_clarification=%, trade_id=%, trade_label=%)',
      coalesce(v_pos_clarif::text, 'fehlt'), coalesce(v_pos_trade::text, 'fehlt'), coalesce(v_pos_label::text, 'fehlt');
  end if;
  if v_pos_clarif <> v_total - 2 or v_pos_trade <> v_total - 1 or v_pos_label <> v_total then
    raise exception
      'AUFTRAG_7/0020: die neuen Spalten stehen nicht an den letzten drei Positionen der View (erwartet is_in_clarification=%, trade_id=%, trade_label=% von % Spalten insgesamt; tatsaechlich %/%/%)',
      v_total - 2, v_total - 1, v_total, v_total, v_pos_clarif, v_pos_trade, v_pos_label;
  end if;

  raise notice
    'AUFTRAG_7/0020 OK: incident_list_view traegt is_in_clarification, trade_id und trade_label als letzte drei Spalten (Positionen %/%/% von % insgesamt)',
    v_pos_clarif, v_pos_trade, v_pos_label, v_total;
end
$$;

-- 7d) create_incident_ap12: die neue 24-Parameter-Fassung traegt das
--     Ausfuehrungsrecht fuer app_user, die alte 21-Parameter-Fassung ist
--     nachweislich nicht mehr aufloesbar (to_regprocedure liefert NULL statt
--     eines Fehlers, anders als eine `::regprocedure`-Typumwandlung).
do $$
declare
  v_new_sig text :=
    'public.create_incident_ap12(uuid, uuid, uuid, uuid, public.incident_priority, '
    || 'text, text, text, text, text, text, text, text, numeric, numeric, '
    || 'text, text, text, uuid, uuid, jsonb, timestamptz, uuid, uuid)';
  v_old_sig text :=
    'public.create_incident_ap12(uuid, uuid, uuid, uuid, public.incident_priority, '
    || 'text, text, text, text, text, text, text, text, numeric, numeric, '
    || 'text, text, text, uuid, uuid, jsonb)';
begin
  if not has_function_privilege('app_user', v_new_sig, 'execute') then
    raise exception
      'AUFTRAG_7/0020: app_user fehlt das Ausfuehrungsrecht auf die um drei Parameter erweiterte Fassung von create_incident_ap12';
  end if;
  if to_regprocedure(v_old_sig) is not null then
    raise exception
      'AUFTRAG_7/0020: die alte 21-Parameter-Fassung von create_incident_ap12 besteht noch - haette per DROP FUNCTION entfernt werden muessen';
  end if;

  raise notice
    'AUFTRAG_7/0020 OK: create_incident_ap12 besteht nur noch als 24-Parameter-Fassung mit Ausfuehrungsrecht fuer app_user';
end
$$;

-- =====================================================================
-- Ende Migration 0020
-- =====================================================================
