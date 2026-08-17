\set ON_ERROR_STOP on

-- =====================================================================
-- AUFTRAG_7 - Anrufdaten an der Meldung (Anrufzeitpunkt, Anrufender, Gewerk)
-- und das "In Klaerung"-Kennzeichen (Migration 0020) unter der
-- Anwendungsrolle app_user mit AKTIVER RLS.
--
-- Erwartet die vollstaendige Kette einschliesslich 0012 bis 0020 sowie die
-- Smokes 15-26. Diese Datei ist der neue letzte Eintrag der SQL-Kette,
-- unmittelbar HINTER ihrer eigenen Migration 0020 - dieselbe Konvention wie
-- bei 0015/21, 0016/22, 0017/23, 0018/25 und 0019/26.
--
-- GEGENSTAND, alles gemessen statt behauptet:
--   1. SPALTENZUSTAND. reported_at (timestamptz, nullable), caller_contact_id
--      und trade_id (uuid, nullable), is_in_clarification (boolean, NOT NULL
--      DEFAULT false).
--   2. IDEMPOTENZ. Die echte Migrationsdatei 0020 wird ein zweites Mal
--      angewendet (per \ir, keine Kopie); der Spaltenzustand von
--      is_in_clarification und die Ausfuehrungsrechte von
--      create_incident_ap12 duerfen sich dadurch nicht veraendern.
--   3. FK-VERHALTEN von caller_contact_id (-> contacts) und trade_id
--      (-> trades): beide NICHT kaskadierend.
--   4. CREATE_INCIDENT_AP12: die um drei Parameter erweiterte Fassung
--      speichert reported_at/caller_contact_id/trade_id korrekt, UND ein
--      Aufruf mit weiterhin nur 21 Positionsargumenten (der Bestandsweg vor
--      AUFTRAG_7) bleibt lauffaehig und laesst die drei neuen Spalten NULL.
--   5. VIEW. incident_list_view traegt is_in_clarification, trade_id und
--      trade_label als LETZTE drei Spalten mit korrekt aufgeloestem
--      trade_label.
--   6. ROLLENVERHALTEN, KEINE POLICY-AENDERUNG: die Anlage bleibt is_staff()
--      vorbehalten (Monteur wird ueber incidents_insert abgewiesen, nicht
--      ueber einen neuen Mechanismus). is_in_clarification traegt
--      AUSDRUECKLICH KEINEN Waechter - admin, disponent UND der zugewiesene
--      Monteur duerfen es per UPDATE setzen (incidents_update,
--      0001_init.sql:544-546) - anders als is_false_alarm (0018, nur
--      Disponent).
--
-- Verbindliche Eigenschaften dieses Smokes (identisch zu 25/26):
--   * Er fuehrt KEIN `grant` und KEIN `revoke` aus, aendert keine Policy und
--     schaltet keinen Trigger ab (0020 legt ohnehin keinen fuer diese Spalten
--     an). Die einzigen DDL-Anweisungen ausserhalb der per \ir eingebundenen
--     Migration gibt es hier nicht.
--   * Er erzeugt KEIN dauerhaftes Schemaobjekt.
--   * Die Identitaet wird immer mit set_config('app.user_id', ..., true)
--     gesetzt - genau so, wie withUserTransaction() es tut
--     (app/src/lib/db/index.ts). Geprueft wird unter `set role app_user` mit
--     aktiver RLS; der Eigentuemerkontext (`reset role;`) dient
--     ausschliesslich den Fixtures, dem Migrationslauf selbst und der
--     FK-Gegenprobe, die wie in 26_hlk_kataloge.sql (Fall X8) ausdruecklich im
--     Eigentuemerkontext laeuft.
--   * NUR SYNTHETISCHE WERTE. Alle drei Konten tragen den projektweit
--     etablierten Marker '!MIGRATED-ACCOUNT-REQUIRES-RESET!'. E-Mail-Adressen
--     liegen auf @beispiel.invalid.
--
-- WARUM DIE GANZE WIRKUNGSPHASE IN EINER TRANSAKTION MIT ROLLBACK LAEUFT:
--   Dieselbe Begruendung wie in 25/26: ein Aufraeumen per DELETE der
--   Vorgangs-Fixtures ist wegen der unbedingten Loeschsperre
--   trg_incident_tasks_no_delete (0011_ap13_tasks_bulk.sql:113-123) nicht
--   moeglich. Ein expliziter Transaktionsrahmen mit `rollback;` ist das im
--   Projekt durchgehend verwendete, bereits geprueft sichere Muster.
--
-- WARUM Y2 DIE MIGRATION PER `\ir` EINBINDET UND NICHT NACHBAUT:
--   Gegenstand ist die Datei
--   app/supabase/migrations/0020_hlk_meldung_anrufdaten.sql selbst - eine
--   Kopie ihrer Anweisungen wuerde nur die Kopie pruefen. `\ir` loest den Pfad
--   relativ zum Verzeichnis DIESER Datei auf (app/supabase/test/) und
--   funktioniert auch innerhalb einer offenen Transaktion.
--
-- Meldungskennung: Y (Fallkennung Y laut AUFTRAG_7.md), Fixture-Gegenprobe
-- Y-FIXTURES, Abschluss Y-ENDE. Y ist in der Kette bislang frei (siehe
-- Aufzaehlung im Kopf von 25_ap15b_incident_metrics.sql; 26 nutzt X).
-- UUID-Praefix: 27a00000-. Er kommt in keiner anderen Test- oder
-- Migrationsdatei vor (26a00000- gehoert 26_hlk_kataloge.sql).
--
-- Kennungen dieser Datei:
--   ...0001 Administrator - is_staff(), darf incidents_update-Zeilen aendern
--   ...0002 Disponent     - is_staff(), legt Vorgaenge ueber die RPC an
--   ...0003 Monteur       - wird aktiv an ...00b1 zugewiesen
--   ...00a1 Bauabschnitt, ...00a2 VzG-Strecke, ...00a3 Kunde
--   ...00a4 Kabelart (Pflichtangabe von create_incident_ap12)
--   ...00a5 Ansprechpartner (fuer p_caller_contact_id UND die FK-Gegenprobe)
--   ...00a6 Gewerk (fuer p_trade_id UND die FK-Gegenprobe)
--   ...00b1 Vorgang aus Y4 (Disponent, ueber die RPC mit allen drei neuen
--           Feldern), traegt die aktive Zuweisung des Monteurs fuer Y9
--   ...00b2 Vorgang aus Y5 (Disponent, RPC mit nur 21 Positionsargumenten)
--   ...00c1 Anlageversuch von Y6, der NICHT entstehen darf (Monteur)
-- =====================================================================

reset role;
select set_config('app.user_id', '', false);

-- ---------------------------------------------------------------------
-- Ausgangsstand der Funktionen in schema public, sitzungsweit und ausserhalb
-- des Transaktionsrahmens festgehalten - dient Y-ENDE als Nachweis, dass
-- dieser Smoke kein Schemaobjekt erzeugt (der Idempotenz-Doppellauf in Y2
-- ersetzt create_incident_ap12 zwar erneut, aber unter demselben Namen und
-- derselben Signatur - kein Nettozuwachs). Muster aus 25/26.
-- ---------------------------------------------------------------------
select set_config(
  'kb27a.proc_count_start',
  (
    select count(*)::text
    from pg_proc p
    join pg_namespace ns on ns.oid = p.pronamespace
    where ns.nspname = 'public'
  ),
  false);

begin;

-- ---------------------------------------------------------------------
-- Fixtures im Eigentuemerkontext.
-- ---------------------------------------------------------------------
insert into public.auth_accounts (id, email, password_hash, must_change_password, is_disabled)
values
  ('27a00000-0000-0000-0000-000000000001', 'y27.admin@beispiel.invalid', '!MIGRATED-ACCOUNT-REQUIRES-RESET!', false, false),
  ('27a00000-0000-0000-0000-000000000002', 'y27.dispo@beispiel.invalid', '!MIGRATED-ACCOUNT-REQUIRES-RESET!', false, false),
  ('27a00000-0000-0000-0000-000000000003', 'y27.monteur@beispiel.invalid', '!MIGRATED-ACCOUNT-REQUIRES-RESET!', false, false)
on conflict (id) do nothing;

insert into public.profiles (id, full_name, role, is_active)
values
  ('27a00000-0000-0000-0000-000000000001', 'Y27 Admin', 'admin', true),
  ('27a00000-0000-0000-0000-000000000002', 'Y27 Disponent', 'disponent', true),
  ('27a00000-0000-0000-0000-000000000003', 'Y27 Monteur', 'monteur', true)
on conflict (id) do nothing;

insert into public.construction_stages (id, code, name)
values ('27a00000-0000-0000-0000-0000000000a1', 'B27Y', 'Bauabschnitt AUFTRAG_7 Anrufdaten')
on conflict (id) do nothing;

insert into public.vzg_lines (id, line_number, construction_stage_id)
values ('27a00000-0000-0000-0000-0000000000a2', '1827', '27a00000-0000-0000-0000-0000000000a1')
on conflict (id) do nothing;

insert into public.customers (id, name)
values ('27a00000-0000-0000-0000-0000000000a3', 'Y27 Kunde AUFTRAG_7')
on conflict (id) do nothing;

insert into public.cable_types (id, code, name, sort_order)
values ('27a00000-0000-0000-0000-0000000000a4', 'Y27C', 'Y27 Kabelart', 1)
on conflict (id) do nothing;

insert into public.contacts (id, customer_id, name)
values ('27a00000-0000-0000-0000-0000000000a5', '27a00000-0000-0000-0000-0000000000a3', 'Y27 Ansprechpartner (Anrufender)')
on conflict (id) do nothing;

insert into public.trades (id, label)
values ('27a00000-0000-0000-0000-0000000000a6', 'Y27 Testgewerk')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- Y-FIXTURES: Ausgangslage im Eigentuemerkontext belegen.
-- ---------------------------------------------------------------------
do $$
declare
  v_admin integer;
  v_dispo integer;
  v_monteur integer;
  v_stammdaten integer;
begin
  select count(*) into v_admin from public.profiles
   where id = '27a00000-0000-0000-0000-000000000001' and role = 'admin' and is_active;
  select count(*) into v_dispo from public.profiles
   where id = '27a00000-0000-0000-0000-000000000002' and role = 'disponent' and is_active;
  select count(*) into v_monteur from public.profiles
   where id = '27a00000-0000-0000-0000-000000000003' and role = 'monteur' and is_active;

  if v_admin <> 1 or v_dispo <> 1 or v_monteur <> 1 then
    raise exception
      'SMOKE Y-FIXTURES FAIL Rollen nicht wie gewollt (admin=%, disponent=%, monteur=% - erwartet je 1)',
      v_admin, v_dispo, v_monteur;
  end if;

  select
    (select count(*) from public.customers where id = '27a00000-0000-0000-0000-0000000000a3')
    + (select count(*) from public.construction_stages where id = '27a00000-0000-0000-0000-0000000000a1')
    + (select count(*) from public.vzg_lines where id = '27a00000-0000-0000-0000-0000000000a2')
    + (select count(*) from public.cable_types where id = '27a00000-0000-0000-0000-0000000000a4')
    + (select count(*) from public.contacts where id = '27a00000-0000-0000-0000-0000000000a5')
    + (select count(*) from public.trades where id = '27a00000-0000-0000-0000-0000000000a6')
  into v_stammdaten;

  if v_stammdaten <> 6 then
    raise exception
      'SMOKE Y-FIXTURES FAIL % von 6 Stammdatenzeilen vorhanden (Kunde, Bauabschnitt, VzG-Strecke, Kabelart, Ansprechpartner, Gewerk)',
      v_stammdaten;
  end if;

  raise notice
    'SMOKE Y-FIXTURES OK drei Identitaeten (Administrator, Disponent, Monteur) und sechs Stammdatenzeilen stehen bereit';
end
$$;

-- ---------------------------------------------------------------------
-- Y1: Spaltenzustand nach der regulaeren Kette (Eigentuemerkontext,
-- ungefiltert durch RLS). Gelesen wird der Katalog, nicht das Verhalten.
-- ---------------------------------------------------------------------
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
  where a.attrelid = 'public.incidents'::regclass and a.attname = 'reported_at' and not a.attisdropped;
  select a.atttypid::regtype::text into v_caller_contact_type
  from pg_attribute a
  where a.attrelid = 'public.incidents'::regclass and a.attname = 'caller_contact_id' and not a.attisdropped;
  select a.atttypid::regtype::text into v_trade_type
  from pg_attribute a
  where a.attrelid = 'public.incidents'::regclass and a.attname = 'trade_id' and not a.attisdropped;
  select
    a.atttypid::regtype::text, a.attnotnull, a.atthasdef,
    (select pg_get_expr(d.adbin, d.adrelid) from pg_attrdef d where d.adrelid = a.attrelid and d.adnum = a.attnum)
  into v_clarif_type, v_clarif_notnull, v_clarif_hasdef, v_clarif_default
  from pg_attribute a
  where a.attrelid = 'public.incidents'::regclass and a.attname = 'is_in_clarification' and not a.attisdropped;

  if v_reported_at_type is distinct from 'timestamp with time zone' then
    raise exception 'SMOKE Y1 FAIL incidents.reported_at hat den Typ % statt timestamptz', coalesce(v_reported_at_type, 'NULL (Spalte fehlt)');
  end if;
  if v_caller_contact_type is distinct from 'uuid' then
    raise exception 'SMOKE Y1 FAIL incidents.caller_contact_id hat den Typ % statt uuid', coalesce(v_caller_contact_type, 'NULL (Spalte fehlt)');
  end if;
  if v_trade_type is distinct from 'uuid' then
    raise exception 'SMOKE Y1 FAIL incidents.trade_id hat den Typ % statt uuid', coalesce(v_trade_type, 'NULL (Spalte fehlt)');
  end if;
  if v_clarif_type is distinct from 'boolean' or v_clarif_notnull is distinct from true
     or v_clarif_hasdef is distinct from true or v_clarif_default is distinct from 'false' then
    raise exception
      'SMOKE Y1 FAIL incidents.is_in_clarification nicht im Zielzustand (typ=%, notnull=%, hasdef=%, default=%)',
      coalesce(v_clarif_type, 'NULL'), coalesce(v_clarif_notnull::text, 'NULL'),
      coalesce(v_clarif_hasdef::text, 'NULL'), coalesce(v_clarif_default, 'NULL');
  end if;

  raise notice
    'SMOKE Y1 OK reported_at (timestamptz), caller_contact_id/trade_id (uuid) vorhanden; is_in_clarification ist boolean NOT NULL DEFAULT false';
end
$$;

-- =====================================================================
-- Y2: IDEMPOTENZ-DOPPELLAUF. Die echte Migration wird ein zweites Mal
-- angewendet; die NOTICE-Meldungen ("column ... already exists, skipping",
-- "function ... does not exist, skipping" fuer den zweiten DROP FUNCTION IF
-- EXISTS) sind erwartet.
-- =====================================================================
reset role;
select set_config('app.user_id', '', true);

\ir ../migrations/0020_hlk_meldung_anrufdaten.sql

do $$
declare
  v_clarif_notnull boolean;
  v_clarif_hasdef boolean;
  v_has_new_sig boolean;
  v_old_sig_exists boolean;
begin
  select a.attnotnull, a.atthasdef into v_clarif_notnull, v_clarif_hasdef
  from pg_attribute a
  where a.attrelid = 'public.incidents'::regclass and a.attname = 'is_in_clarification' and not a.attisdropped;
  if v_clarif_notnull is distinct from true or v_clarif_hasdef is distinct from true then
    raise exception
      'SMOKE Y2 FAIL nach dem erneuten Lauf von 0020 ist is_in_clarification nicht mehr NOT NULL DEFAULT false (notnull=%, hasdef=%)',
      coalesce(v_clarif_notnull::text, 'NULL'), coalesce(v_clarif_hasdef::text, 'NULL');
  end if;

  select has_function_privilege(
    'app_user',
    'public.create_incident_ap12(uuid, uuid, uuid, uuid, public.incident_priority, '
      || 'text, text, text, text, text, text, text, text, numeric, numeric, '
      || 'text, text, text, uuid, uuid, jsonb, timestamptz, uuid, uuid)',
    'execute'
  ) into v_has_new_sig;
  if v_has_new_sig is distinct from true then
    raise exception 'SMOKE Y2 FAIL app_user besitzt nach dem erneuten Lauf kein Ausfuehrungsrecht auf die 24-Parameter-Fassung';
  end if;

  select to_regprocedure(
    'public.create_incident_ap12(uuid, uuid, uuid, uuid, public.incident_priority, '
      || 'text, text, text, text, text, text, text, text, numeric, numeric, '
      || 'text, text, text, uuid, uuid, jsonb)'
  ) is not null into v_old_sig_exists;
  if v_old_sig_exists then
    raise exception 'SMOKE Y2 FAIL die alte 21-Parameter-Fassung von create_incident_ap12 besteht nach dem erneuten Lauf wieder';
  end if;

  raise notice
    'SMOKE Y2 OK der erneute Lauf der echten Migration 0020 veraendert weder den Spaltenzustand noch die Funktionssignatur/-rechte von create_incident_ap12 - Idempotenz belegt';
end
$$;

-- =====================================================================
-- Ab hier unter der Anwendungsrolle app_user mit aktiver RLS.
-- =====================================================================
set role app_user;

-- ---------------------------------------------------------------------
-- Y3: create_incident_ap12 mit ALLEN drei neuen Feldern (Disponent).
-- Legt ...00b1 an und weist anschliessend den Monteur aktiv zu (Grundlage
-- fuer Y9).
-- ---------------------------------------------------------------------
do $$
declare
  v_id uuid;
  v_reported_at timestamptz := '2026-08-17 14:30:00+02'::timestamptz;
  v_row record;
begin
  perform set_config('app.user_id', '27a00000-0000-0000-0000-000000000002', true);

  v_id := public.create_incident_ap12(
    '27a00000-0000-0000-0000-0000000000a3', -- p_customer_id
    '27a00000-0000-0000-0000-0000000000a1', -- p_construction_stage_id
    '27a00000-0000-0000-0000-0000000000a2', -- p_vzg_line_id
    null::uuid,                             -- p_on_call_number_id
    'normal'::public.incident_priority,     -- p_priority
    'AUFTRAG_7 Y3 - Anlage mit allen drei neuen Feldern', -- p_description
    null::text, null::text, null::text, null::text, null::text, null::text,
    'Y27-B1'::text,                         -- p_external_reference
    27.100::numeric, null::numeric,
    null::text, null::text, null::text,     -- p_caller_name/p_caller_contact/p_internal_note
    null::uuid, null::uuid,                 -- p_contact_id/p_contact_phone_number_id
    jsonb_build_array(jsonb_build_object(
      'cable_type_id', '27a00000-0000-0000-0000-0000000000a4',
      'quantity_value', '5', 'quantity_unit', 'meter', 'condition_code', 'ready'
    )),
    v_reported_at,                                          -- p_reported_at
    '27a00000-0000-0000-0000-0000000000a5'::uuid,           -- p_caller_contact_id
    '27a00000-0000-0000-0000-0000000000a6'::uuid            -- p_trade_id
  );

  if v_id is null then
    raise exception 'SMOKE Y3 FAIL create_incident_ap12 liefert keine Kennung';
  end if;
  -- Feste, ausserhalb der Fixture-Transaktion sichtbare Kennung fuer Y9/Y-ENDE.
  perform set_config('kb27a.incident_b1', v_id::text, false);

  select reported_at, caller_contact_id, trade_id into v_row
  from public.incidents where id = v_id;

  if v_row.reported_at is distinct from v_reported_at then
    raise exception 'SMOKE Y3 FAIL reported_at ist % statt %', coalesce(v_row.reported_at::text, 'NULL'), v_reported_at;
  end if;
  if v_row.caller_contact_id is distinct from '27a00000-0000-0000-0000-0000000000a5'::uuid then
    raise exception 'SMOKE Y3 FAIL caller_contact_id ist % statt der uebergebenen Kennung', coalesce(v_row.caller_contact_id::text, 'NULL');
  end if;
  if v_row.trade_id is distinct from '27a00000-0000-0000-0000-0000000000a6'::uuid then
    raise exception 'SMOKE Y3 FAIL trade_id ist % statt der uebergebenen Kennung', coalesce(v_row.trade_id::text, 'NULL');
  end if;

  insert into public.incident_assignments (incident_id, monteur_id, is_active)
  values (v_id, '27a00000-0000-0000-0000-000000000003', true);

  raise notice
    'SMOKE Y3 OK create_incident_ap12 speichert reported_at, caller_contact_id und trade_id korrekt';
end
$$;

-- ---------------------------------------------------------------------
-- Y4: create_incident_ap12 mit weiterhin NUR 21 Positionsargumenten (der
-- Bestandsweg vor AUFTRAG_7) bleibt lauffaehig; die drei neuen Spalten
-- bleiben NULL. Belegt die Rueckwaertskompatibilitaet des DROP/CREATE-
-- Vorgehens aus Migration 0020, Abschnitt 5.
-- ---------------------------------------------------------------------
do $$
declare
  v_id uuid;
  v_row record;
begin
  perform set_config('app.user_id', '27a00000-0000-0000-0000-000000000002', true);

  v_id := public.create_incident_ap12(
    '27a00000-0000-0000-0000-0000000000a3',
    '27a00000-0000-0000-0000-0000000000a1',
    '27a00000-0000-0000-0000-0000000000a2',
    null::uuid,
    'normal'::public.incident_priority,
    'AUFTRAG_7 Y4 - Anlage mit weiterhin 21 Positionsargumenten',
    null::text, null::text, null::text, null::text, null::text, null::text,
    'Y27-B2'::text,
    27.200::numeric, null::numeric,
    null::text, null::text, null::text,
    null::uuid, null::uuid,
    jsonb_build_array(jsonb_build_object(
      'cable_type_id', '27a00000-0000-0000-0000-0000000000a4',
      'quantity_value', '3', 'quantity_unit', 'meter', 'condition_code', 'ready'
    ))
  );

  if v_id is null then
    raise exception 'SMOKE Y4 FAIL create_incident_ap12 mit 21 Argumenten liefert keine Kennung';
  end if;

  select reported_at, caller_contact_id, trade_id into v_row
  from public.incidents where id = v_id;
  if v_row.reported_at is not null or v_row.caller_contact_id is not null or v_row.trade_id is not null then
    raise exception
      'SMOKE Y4 FAIL ein Aufruf mit 21 Argumenten haette reported_at/caller_contact_id/trade_id NULL lassen muessen (reported_at=%, caller_contact_id=%, trade_id=%)',
      coalesce(v_row.reported_at::text, 'NULL'), coalesce(v_row.caller_contact_id::text, 'NULL'), coalesce(v_row.trade_id::text, 'NULL');
  end if;

  raise notice
    'SMOKE Y4 OK ein Aufruf von create_incident_ap12 mit weiterhin nur 21 Positionsargumenten bleibt lauffaehig und laesst die drei neuen Spalten NULL - Rueckwaertskompatibilitaet des DROP/CREATE-Vorgehens belegt';
end
$$;

-- ---------------------------------------------------------------------
-- Y5: KEINE POLICY-AENDERUNG - der Monteur wird ueber incidents_insert
-- weiterhin abgewiesen, auch mit den drei neuen Parametern besetzt.
-- ---------------------------------------------------------------------
do $$
declare
  v_state text;
  v_zeilen integer;
begin
  perform set_config('app.user_id', '27a00000-0000-0000-0000-000000000003', true);

  v_state := null;
  begin
    perform public.create_incident_ap12(
      '27a00000-0000-0000-0000-0000000000a3',
      '27a00000-0000-0000-0000-0000000000a1',
      '27a00000-0000-0000-0000-0000000000a2',
      null::uuid,
      'normal'::public.incident_priority,
      'AUFTRAG_7 Y5 - unzulaessige Anlage durch den Monteur',
      null::text, null::text, null::text, null::text, null::text, null::text,
      'Y27-C1'::text,
      27.300::numeric, null::numeric,
      null::text, null::text, null::text,
      null::uuid, null::uuid,
      jsonb_build_array(jsonb_build_object(
        'cable_type_id', '27a00000-0000-0000-0000-0000000000a4',
        'quantity_value', '1', 'quantity_unit', 'meter', 'condition_code', 'ready'
      )),
      now()::timestamptz,
      '27a00000-0000-0000-0000-0000000000a5'::uuid,
      '27a00000-0000-0000-0000-0000000000a6'::uuid
    );
  exception
    when insufficient_privilege then v_state := sqlstate;
    when others then v_state := sqlstate;
  end;

  if v_state is distinct from '42501' then
    raise exception
      'SMOKE Y5 FAIL SQLSTATE % statt 42501',
      coalesce(v_state, 'kein Fehler - der Monteur hat einen Vorgang angelegt');
  end if;

  reset role;
  select count(*) into v_zeilen from public.incidents where external_reference = 'Y27-C1';
  set role app_user;
  if v_zeilen <> 0 then
    raise exception 'SMOKE Y5 FAIL der abgewiesene Vorgang Y27-C1 besteht trotzdem (% Zeile(n))', v_zeilen;
  end if;

  raise notice
    'SMOKE Y5 OK die drei neuen, optionalen Parameter aendern nichts an incidents_insert - der Monteur wird weiterhin mit 42501 abgewiesen, es entsteht keine Zeile';
end
$$;

-- ---------------------------------------------------------------------
-- Y6: FK-VERHALTEN von caller_contact_id - NICHT kaskadierend. Laeuft im
-- EIGENTUEMERKONTEXT wie X8 in 26_hlk_kataloge.sql: app_user hat zwar
-- select/insert/update auf public.contacts (0014), aber kein delete - ein
-- Loeschversuch unter app_user wuerde am Tabellenrecht scheitern und nichts
-- ueber das FK-Verhalten selbst aussagen.
-- ---------------------------------------------------------------------
reset role;
select set_config('app.user_id', '27a00000-0000-0000-0000-000000000002', true);

do $$
declare
  v_contact uuid := '27a00000-0000-0000-0000-0000000000a7';
  v_incident uuid;
  v_state text;
  v_after uuid;
begin
  insert into public.contacts (id, customer_id, name)
  values (v_contact, '27a00000-0000-0000-0000-0000000000a3', 'Y27 FK-Ansprechpartner');

  insert into public.incidents (customer_id, construction_stage_id, vzg_line_id, vzg_line_number, km_from, status, description, caller_contact_id)
  values ('27a00000-0000-0000-0000-0000000000a3', '27a00000-0000-0000-0000-0000000000a1', '27a00000-0000-0000-0000-0000000000a2', '1827', 27.400, 'neu', 'AUFTRAG_7 Y6 - FK-Gegenprobe caller_contact_id', v_contact)
  returning id into v_incident;

  v_state := null;
  begin
    delete from public.contacts where id = v_contact;
  exception
    when foreign_key_violation then v_state := sqlstate;
    when others then v_state := sqlstate;
  end;

  if v_state is distinct from '23503' then
    raise exception
      'SMOKE Y6 FAIL SQLSTATE % statt 23503 beim Loeschversuch des referenzierten Ansprechpartners - caller_contact_id waere kaskadierend oder ON DELETE SET NULL',
      coalesce(v_state, 'kein Fehler - der Ansprechpartner wurde geloescht');
  end if;

  select caller_contact_id into v_after from public.incidents where id = v_incident;
  if v_after is distinct from v_contact then
    raise exception
      'SMOKE Y6 FAIL caller_contact_id wurde auf % geaendert statt unveraendert % zu bleiben - das waere ON DELETE SET NULL',
      coalesce(v_after::text, 'NULL'), v_contact;
  end if;

  raise notice
    'SMOKE Y6 OK incidents.caller_contact_id ist NICHT kaskadierend: das Loeschen des referenzierten Ansprechpartners wird mit 23503 abgewiesen, der Verweis bleibt unveraendert';
end
$$;

-- ---------------------------------------------------------------------
-- Y7: FK-VERHALTEN von trade_id - NICHT kaskadierend. Dieselbe Begruendung
-- und derselbe Kontext wie Y6.
-- ---------------------------------------------------------------------
do $$
declare
  v_trade uuid := '27a00000-0000-0000-0000-0000000000a8';
  v_incident uuid;
  v_state text;
  v_after uuid;
begin
  insert into public.trades (id, label) values (v_trade, 'Y27 FK-Gewerk');

  insert into public.incidents (customer_id, construction_stage_id, vzg_line_id, vzg_line_number, km_from, status, description, trade_id)
  values ('27a00000-0000-0000-0000-0000000000a3', '27a00000-0000-0000-0000-0000000000a1', '27a00000-0000-0000-0000-0000000000a2', '1827', 27.500, 'neu', 'AUFTRAG_7 Y7 - FK-Gegenprobe trade_id', v_trade)
  returning id into v_incident;

  v_state := null;
  begin
    delete from public.trades where id = v_trade;
  exception
    when foreign_key_violation then v_state := sqlstate;
    when others then v_state := sqlstate;
  end;

  if v_state is distinct from '23503' then
    raise exception
      'SMOKE Y7 FAIL SQLSTATE % statt 23503 beim Loeschversuch des referenzierten Gewerks - trade_id waere kaskadierend oder ON DELETE SET NULL',
      coalesce(v_state, 'kein Fehler - das Gewerk wurde geloescht');
  end if;

  select trade_id into v_after from public.incidents where id = v_incident;
  if v_after is distinct from v_trade then
    raise exception
      'SMOKE Y7 FAIL trade_id wurde auf % geaendert statt unveraendert % zu bleiben - das waere ON DELETE SET NULL',
      coalesce(v_after::text, 'NULL'), v_trade;
  end if;

  raise notice
    'SMOKE Y7 OK incidents.trade_id ist NICHT kaskadierend: das Loeschen des referenzierten Gewerks wird mit 23503 abgewiesen, der Verweis bleibt unveraendert';
end
$$;

set role app_user;

-- ---------------------------------------------------------------------
-- Y8: VIEW - incident_list_view liefert is_in_clarification, trade_id und
-- trade_label korrekt fuer den in Y3 angelegten Vorgang ...00b1, und die
-- drei Spalten stehen an den letzten drei Positionen (Data-Level-Gegenprobe
-- zur Katalogpruefung in Migration 0020 Abschnitt 7c).
-- ---------------------------------------------------------------------
do $$
declare
  v_id uuid;
  v_clarif boolean;
  v_trade uuid;
  v_label text;
  v_total integer;
  v_pos_clarif integer;
  v_pos_trade integer;
  v_pos_label integer;
begin
  perform set_config('app.user_id', '27a00000-0000-0000-0000-000000000002', true);
  v_id := nullif(current_setting('kb27a.incident_b1', true), '')::uuid;
  if v_id is null then
    raise exception 'SMOKE Y8 FAIL kb27a.incident_b1 ist nicht gesetzt - Y3 haette vorher laufen muessen';
  end if;

  select is_in_clarification, trade_id, trade_label
    into v_clarif, v_trade, v_label
  from public.incident_list_view where id = v_id;

  if v_clarif is distinct from false then
    raise exception 'SMOKE Y8 FAIL is_in_clarification ist % statt false (Default)', coalesce(v_clarif::text, 'NULL');
  end if;
  if v_trade is distinct from '27a00000-0000-0000-0000-0000000000a6'::uuid then
    raise exception 'SMOKE Y8 FAIL trade_id ist % statt der in Y3 gesetzten Kennung', coalesce(v_trade::text, 'NULL');
  end if;
  if v_label is distinct from 'Y27 Testgewerk' then
    raise exception 'SMOKE Y8 FAIL trade_label ist % statt "Y27 Testgewerk" - der Join auf public.trades loest nicht korrekt auf', coalesce(v_label, 'NULL');
  end if;

  select count(*) into v_total
  from information_schema.columns
  where table_schema = 'public' and table_name = 'incident_list_view';
  select ordinal_position into v_pos_clarif from information_schema.columns
   where table_schema = 'public' and table_name = 'incident_list_view' and column_name = 'is_in_clarification';
  select ordinal_position into v_pos_trade from information_schema.columns
   where table_schema = 'public' and table_name = 'incident_list_view' and column_name = 'trade_id';
  select ordinal_position into v_pos_label from information_schema.columns
   where table_schema = 'public' and table_name = 'incident_list_view' and column_name = 'trade_label';
  if v_pos_clarif <> v_total - 2 or v_pos_trade <> v_total - 1 or v_pos_label <> v_total then
    raise exception
      'SMOKE Y8 FAIL die drei neuen Spalten stehen nicht an den letzten drei Positionen (is_in_clarification=%, trade_id=%, trade_label=% von % Spalten insgesamt)',
      v_pos_clarif, v_pos_trade, v_pos_label, v_total;
  end if;

  raise notice
    'SMOKE Y8 OK incident_list_view liefert is_in_clarification/trade_id/trade_label korrekt und fuehrt sie als letzte drei Spalten (% insgesamt)',
    v_total;
end
$$;

-- ---------------------------------------------------------------------
-- Y9: is_in_clarification traegt KEINEN Waechter - anders als is_false_alarm
-- (0018, nur Disponent) duerfen Administrator UND der aktiv zugewiesene
-- Monteur die Kennzeichnung per gewoehnlichem UPDATE setzen, weil beide ueber
-- incidents_update ohnehin zeilenberechtigt sind (0001_init.sql:544-546).
-- ---------------------------------------------------------------------
do $$
declare
  v_id uuid;
  v_flag boolean;
begin
  v_id := nullif(current_setting('kb27a.incident_b1', true), '')::uuid;

  -- Teil 1: Administrator setzt true.
  perform set_config('app.user_id', '27a00000-0000-0000-0000-000000000001', true);
  update public.incidents set is_in_clarification = true where id = v_id;
  select is_in_clarification into v_flag from public.incidents where id = v_id;
  if v_flag is distinct from true then
    raise exception 'SMOKE Y9 FAIL der Administrator konnte is_in_clarification nicht auf true setzen (%)', coalesce(v_flag::text, 'NULL');
  end if;

  -- Teil 2: der aktiv zugewiesene Monteur nimmt es zurueck.
  perform set_config('app.user_id', '27a00000-0000-0000-0000-000000000003', true);
  update public.incidents set is_in_clarification = false where id = v_id;
  select is_in_clarification into v_flag from public.incidents where id = v_id;
  if v_flag is distinct from false then
    raise exception 'SMOKE Y9 FAIL der zugewiesene Monteur konnte is_in_clarification nicht auf false zuruecknehmen (%)', coalesce(v_flag::text, 'NULL');
  end if;

  raise notice
    'SMOKE Y9 OK is_in_clarification traegt keinen Waechter: Administrator UND der aktiv zugewiesene Monteur duerfen es ueber die bestehende incidents_update-Policy setzen und zuruecknehmen';
end
$$;

-- =====================================================================
-- Ende der Wirkungsphase.
-- =====================================================================
reset role;
select set_config('app.user_id', '', false);

rollback;

-- ---------------------------------------------------------------------
-- Y-ENDE: Gegenprobe nach dem Rollback, im Eigentuemerkontext.
-- ---------------------------------------------------------------------
do $$
declare
  v_rest integer;
  v_start integer;
  v_jetzt integer;
begin
  select
    (select count(*) from public.profiles where id::text like '27a00000-%')
    + (select count(*) from public.auth_accounts where id::text like '27a00000-%')
    + (select count(*) from public.customers where id::text like '27a00000-%')
    + (select count(*) from public.construction_stages where id::text like '27a00000-%')
    + (select count(*) from public.vzg_lines where id::text like '27a00000-%')
    + (select count(*) from public.cable_types where id::text like '27a00000-%')
    + (select count(*) from public.contacts where id::text like '27a00000-%')
    + (select count(*) from public.trades where id::text like '27a00000-%')
    + (select count(*) from public.incidents where external_reference like 'Y27-%')
    + (select count(*) from public.incidents where description like 'AUFTRAG_7 Y%')
  into v_rest;

  if v_rest <> 0 then
    raise exception
      'SMOKE Y-ENDE FAIL % Zeile(n) mit dem Praefix/Marker 27a00000-/"Y27-"/"AUFTRAG_7 Y" bleiben nach dem Rollback zurueck',
      v_rest;
  end if;

  v_start := nullif(current_setting('kb27a.proc_count_start', true), '')::integer;
  select count(*) into v_jetzt
  from pg_proc p
  join pg_namespace ns on ns.oid = p.pronamespace
  where ns.nspname = 'public';
  if v_start is null or v_jetzt <> v_start then
    raise exception
      'SMOKE Y-ENDE FAIL Funktionszahl in schema public: jetzt %, beim Laufbeginn %',
      v_jetzt, coalesce(v_start::text, 'unbekannt');
  end if;

  raise notice
    'SMOKE Y-ENDE OK AUFTRAG_7/Migration 0020 belegt (Spaltenzustand, Idempotenz, FK-Verhalten, create_incident_ap12 rueckwaertskompatibel erweitert, View-Spalten, kein Waechter auf is_in_clarification); die Wirkungsphase wurde per rollback vollstaendig zurueckgenommen, und es ist kein neues Schemaobjekt entstanden';
end
$$;

select set_config('kb27a.proc_count_start', '', false);
select set_config('kb27a.incident_b1', '', false);
