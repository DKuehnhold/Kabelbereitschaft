\set ON_ERROR_STOP on

-- =====================================================================
-- AUFTRAG_6 - pflegbare Stammdaten-Kataloge Gewerk, Funktion, Objektart
-- (Migration 0019) unter der Anwendungsrolle app_user mit AKTIVER RLS.
--
-- Erwartet die vollstaendige Kette einschliesslich 0012 bis 0019 sowie die
-- Smokes 15-25. Diese Datei ist der neue letzte Eintrag der SQL-Kette,
-- unmittelbar HINTER ihrer eigenen Migration 0019 - dieselbe Konvention wie
-- bei 0015/21, 0016/22, 0017/23 und 0018/25.
--
-- GEGENSTAND, alles gemessen statt behauptet:
--   1. IDEMPOTENZ. Die echte Migrationsdatei 0019 wird ein zweites Mal
--      angewendet (per \ir, keine Kopie); Zeilenzahlen der drei Kataloge
--      duerfen sich dadurch nicht veraendern.
--   2. SEEDS. Alle im Auftrag genannten Startwerte bestehen (Gewerke: 50 Hz,
--      LST, TK, OSE, LWL-LST, LWL-TK, Unbekannt; Funktionen: BÜW, LBÜW,
--      örtl. LST; Objektarten: BÜ, LSW).
--   3. ROLLENMATRIX. Monteur darf lesen, nicht schreiben; Disponent und
--      Administrator (is_staff()) duerfen schreiben; app_user besitzt auf
--      keinem der drei Kataloge ein delete-Tabellenrecht - der Versuch
--      scheitert auch fuer Staff, obwohl die Policy `for all` delete
--      grundsaetzlich zuliesse.
--   4. FK-VERHALTEN von contacts.function_id: nicht kaskadierend. Solange ein
--      Ansprechpartner eine Funktion referenziert, weist die Datenbank das
--      Loeschen dieser Funktion ab (kein automatisches Entfernen, kein
--      automatisches Nullsetzen).
--
-- Verbindliche Eigenschaften dieses Smokes (identisch zu 25):
--   * Er fuehrt KEIN `grant` und KEIN `revoke` aus, aendert keine Policy und
--     schaltet keinen Trigger ab. Die einzige DDL-Anweisung ausserhalb der
--     per \ir eingebundenen Migration ist keine - im Unterschied zu Smoke 25
--     braucht dieser Nachweis keinen absichtlich hergestellten Vorzustand
--     (die neuen Spalten/Tabellen sind bereits im Zielzustand, sobald 0019
--     einmal gelaufen ist).
--   * Er erzeugt KEIN dauerhaftes Schemaobjekt.
--   * Die Identitaet wird immer mit set_config('app.user_id', ..., true)
--     gesetzt - genau so, wie withUserTransaction() es tut
--     (app/src/lib/db/index.ts). Geprueft wird unter `set role app_user` mit
--     aktiver RLS; der Eigentuemerkontext (`reset role;`) dient ausschliesslich
--     den Fixtures, dem Migrationslauf selbst und der FK-Gegenprobe in X8, die
--     ausdruecklich im Eigentuemerkontext laeuft (app_user besitzt ohnehin
--     kein delete-Recht auf public.contact_functions).
--   * NUR SYNTHETISCHE WERTE. Alle drei Konten tragen den projektweit
--     etablierten Marker '!MIGRATED-ACCOUNT-REQUIRES-RESET!'
--     (0012_ap14b_platform_auth.sql:205, wie in 19_ap14b_platform.sql,
--     20_ap14b_data.sql und 25_ap15b_incident_metrics.sql). E-Mail-Adressen
--     liegen auf @beispiel.invalid.
--
-- WARUM DIE GANZE WIRKUNGSPHASE IN EINER TRANSAKTION MIT ROLLBACK LAEUFT:
--   Dieselbe Begruendung wie in 25_ap15b_incident_metrics.sql: ein Aufraeumen
--   per DELETE der Fixture-Zeilen ist nicht in jedem Fall risikofrei (contacts
--   traegt keine Loeschsperre, aber ein expliziter Transaktionsrahmen mit
--   rollback ist das im Projekt durchgehend verwendete, bereits geprueft
--   sichere Muster fuer jeden SQL-Smoke seit 20_ap14b_data.sql). DDL ist in
--   PostgreSQL transaktional; der Rollback nimmt daher auch den erneuten Lauf
--   von 0019 (reine `create or replace`/`on conflict do nothing`/idempotente
--   Guards, ohnehin ohne Wirkung auf den bereits erreichten Zielzustand)
--   folgenlos zurueck.
--
-- WARUM X2 DIE MIGRATION PER `\ir` EINBINDET UND NICHT NACHBAUT:
--   Gegenstand ist die Datei app/supabase/migrations/0019_hlk_katalog_stammdaten.sql
--   selbst - eine Kopie ihrer Anweisungen wuerde nur die Kopie pruefen. `\ir`
--   loest den Pfad relativ zum Verzeichnis DIESER Datei auf (app/supabase/test/)
--   und funktioniert auch innerhalb einer offenen Transaktion.
--
-- HERKUNFT DER GEPRUEFTEN REGELN:
--   * Tabellenform, Audit-Trigger, RLS-Formulierung, Grant-Stil: 0019,
--     Abschnitte 1-3 (uebernommen aus public.cable_types,
--     0007_ap9_master_data.sql:148-159, RLS-Policy dort effektiv
--     `cable_types_select using (app.current_user_id() is not null)` und
--     `cable_types_write for all using (public.is_staff())` nach dem Rewrite
--     aus 0012).
--   * contacts.function_id: 0019, Abschnitt 4 (`add column if not exists`,
--     FK ohne `on delete`-Klausel = ON DELETE NO ACTION).
--   * Tabellenrechte app_user: 0019, Abschnitt 5 (select/insert/update, KEIN
--     delete).
--   * is_staff() = admin oder disponent (0001_init.sql:63-65); die Policy
--     `<tabelle>_write` unterscheidet NICHT zwischen admin und disponent -
--     anders als der Fehlalarm-Waechter aus 0018, der ausdruecklich nur
--     disponent zulaesst. Diese Migration kennt keine engere Rolle als
--     is_staff().
--
-- Meldungskennung: X (Fallkennung X laut Auftrag), Fixture-Gegenprobe
-- X-FIXTURES, Abschluss X-ENDE. Der Buchstabe ist in der Kette frei (siehe
-- Aufzaehlung im Kopf von 25_ap15b_incident_metrics.sql; X ist bislang von
-- keiner Datei belegt).
-- UUID-Praefix: 26a00000-. Er kommt in keiner anderen Test- oder
-- Migrationsdatei vor (25c00000- gehoert 25_ap15b_incident_metrics.sql,
-- 25e00000- gehoert app/test/integration/ap14b-admin-users.int.mjs,
-- 24c00000- gehoert 24_ap15_dashboard_metrics.sql).
--
-- Kennungen dieser Datei:
--   ...0001 Administrator - is_staff(), darf schreiben
--   ...0002 Disponent     - is_staff(), darf schreiben
--   ...0003 Monteur       - darf lesen, nicht schreiben
--   ...00a3 Kunde (Pflichtvorbedingung von public.contacts)
--   ...00b1 Ansprechpartner mit gesetztem function_id (fuer X8)
-- =====================================================================

reset role;
select set_config('app.user_id', '', false);

-- ---------------------------------------------------------------------
-- Ausgangsstand der Funktionen in schema public, sitzungsweit und ausserhalb
-- des Transaktionsrahmens festgehalten - dient X-ENDE als Nachweis, dass
-- dieser Smoke kein Schemaobjekt erzeugt. Muster aus 25_ap15b_incident_metrics.sql.
-- ---------------------------------------------------------------------
select set_config(
  'kb26a.proc_count_start',
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
  ('26a00000-0000-0000-0000-000000000001', 'x26.admin@beispiel.invalid', '!MIGRATED-ACCOUNT-REQUIRES-RESET!', false, false),
  ('26a00000-0000-0000-0000-000000000002', 'x26.dispo@beispiel.invalid', '!MIGRATED-ACCOUNT-REQUIRES-RESET!', false, false),
  ('26a00000-0000-0000-0000-000000000003', 'x26.monteur@beispiel.invalid', '!MIGRATED-ACCOUNT-REQUIRES-RESET!', false, false)
on conflict (id) do nothing;

insert into public.profiles (id, full_name, role, is_active)
values
  ('26a00000-0000-0000-0000-000000000001', 'X26 Admin', 'admin', true),
  ('26a00000-0000-0000-0000-000000000002', 'X26 Disponent', 'disponent', true),
  ('26a00000-0000-0000-0000-000000000003', 'X26 Monteur', 'monteur', true)
on conflict (id) do nothing;

insert into public.customers (id, name)
values ('26a00000-0000-0000-0000-0000000000a3', 'X26 Kunde AUFTRAG_6')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- X-FIXTURES: Ausgangslage im Eigentuemerkontext belegen.
-- ---------------------------------------------------------------------
do $$
declare
  v_admin integer;
  v_dispo integer;
  v_monteur integer;
  v_kunde integer;
begin
  select count(*) into v_admin from public.profiles
   where id = '26a00000-0000-0000-0000-000000000001' and role = 'admin' and is_active;
  select count(*) into v_dispo from public.profiles
   where id = '26a00000-0000-0000-0000-000000000002' and role = 'disponent' and is_active;
  select count(*) into v_monteur from public.profiles
   where id = '26a00000-0000-0000-0000-000000000003' and role = 'monteur' and is_active;

  if v_admin <> 1 or v_dispo <> 1 or v_monteur <> 1 then
    raise exception
      'SMOKE X-FIXTURES FAIL Rollen nicht wie gewollt (admin=%, disponent=%, monteur=% - erwartet je 1)',
      v_admin, v_dispo, v_monteur;
  end if;

  select count(*) into v_kunde from public.customers
   where id = '26a00000-0000-0000-0000-0000000000a3';
  if v_kunde <> 1 then
    raise exception 'SMOKE X-FIXTURES FAIL Kunde fehlt';
  end if;

  raise notice
    'SMOKE X-FIXTURES OK drei Identitaeten (Administrator, Disponent, Monteur) und Kunde stehen bereit';
end
$$;

-- ---------------------------------------------------------------------
-- X1: Seeds vorhanden (Eigentuemerkontext, ungefiltert durch RLS).
-- ---------------------------------------------------------------------
do $$
declare
  v_trades integer;
  v_functions integer;
  v_objects integer;
begin
  select count(*) into v_trades from public.trades
   where label in ('50 Hz','LST','TK','OSE','LWL-LST','LWL-TK','Unbekannt');
  select count(*) into v_functions from public.contact_functions
   where label in ('BÜW','LBÜW','örtl. LST');
  select count(*) into v_objects from public.object_types
   where label in ('BÜ','LSW');

  if v_trades <> 7 then
    raise exception 'SMOKE X1 FAIL % von 7 Gewerke-Startwerten vorhanden', v_trades;
  end if;
  if v_functions <> 3 then
    raise exception 'SMOKE X1 FAIL % von 3 Funktionen-Startwerten vorhanden', v_functions;
  end if;
  if v_objects <> 2 then
    raise exception 'SMOKE X1 FAIL % von 2 Objektarten-Startwerten vorhanden', v_objects;
  end if;

  raise notice
    'SMOKE X1 OK alle Startwerte der drei Kataloge (7 Gewerke, 3 Funktionen, 2 Objektarten) bestehen';
end
$$;

-- =====================================================================
-- X2: IDEMPOTENZ-DOPPELLAUF, der Kern dieser Datei. Die echte Migration wird
-- ein zweites Mal angewendet; die NOTICE-Meldungen ("relation ... already
-- exists, skipping", "trigger ... already exists, skipping") sind erwartet.
-- =====================================================================
reset role;
select set_config('app.user_id', '', true);

do $$
declare
  v_trades_vorher integer;
  v_functions_vorher integer;
  v_objects_vorher integer;
begin
  select count(*) into v_trades_vorher from public.trades;
  select count(*) into v_functions_vorher from public.contact_functions;
  select count(*) into v_objects_vorher from public.object_types;

  perform set_config('kb26a.trades_vorher', v_trades_vorher::text, true);
  perform set_config('kb26a.functions_vorher', v_functions_vorher::text, true);
  perform set_config('kb26a.objects_vorher', v_objects_vorher::text, true);
end
$$;

\ir ../migrations/0019_hlk_katalog_stammdaten.sql

do $$
declare
  v_trades_vorher integer;
  v_functions_vorher integer;
  v_objects_vorher integer;
  v_trades_nachher integer;
  v_functions_nachher integer;
  v_objects_nachher integer;
begin
  v_trades_vorher := current_setting('kb26a.trades_vorher', true)::integer;
  v_functions_vorher := current_setting('kb26a.functions_vorher', true)::integer;
  v_objects_vorher := current_setting('kb26a.objects_vorher', true)::integer;

  select count(*) into v_trades_nachher from public.trades;
  select count(*) into v_functions_nachher from public.contact_functions;
  select count(*) into v_objects_nachher from public.object_types;

  if v_trades_nachher <> v_trades_vorher
     or v_functions_nachher <> v_functions_vorher
     or v_objects_nachher <> v_objects_vorher then
    raise exception
      'SMOKE X2 FAIL Zeilenzahlen nach dem erneuten Lauf von 0019: trades %->% functions %->% objects %->% - der erneute Lauf duplizierte Zeilen',
      v_trades_vorher, v_trades_nachher, v_functions_vorher, v_functions_nachher,
      v_objects_vorher, v_objects_nachher;
  end if;

  raise notice
    'SMOKE X2 OK der erneute Lauf der echten Migration 0019 veraendert die Zeilenzahlen der drei Kataloge nicht (trades=%, contact_functions=%, object_types=%) - Idempotenz belegt',
    v_trades_nachher, v_functions_nachher, v_objects_nachher;
end
$$;

-- =====================================================================
-- Ab hier unter der Anwendungsrolle app_user mit aktiver RLS.
-- =====================================================================
set role app_user;

-- ---------------------------------------------------------------------
-- X3: Monteur darf lesen - alle drei Kataloge liefern Zeilen.
-- ---------------------------------------------------------------------
do $$
declare
  v_trades integer;
  v_functions integer;
  v_objects integer;
begin
  perform set_config('app.user_id', '26a00000-0000-0000-0000-000000000003', true);

  select count(*) into v_trades from public.trades;
  select count(*) into v_functions from public.contact_functions;
  select count(*) into v_objects from public.object_types;

  if v_trades = 0 or v_functions = 0 or v_objects = 0 then
    raise exception
      'SMOKE X3 FAIL der Monteur sieht trades=%, contact_functions=%, object_types=% - erwartet je mindestens eine Zeile',
      v_trades, v_functions, v_objects;
  end if;

  raise notice
    'SMOKE X3 OK der Monteur darf alle drei Kataloge lesen (trades=%, contact_functions=%, object_types=%)',
    v_trades, v_functions, v_objects;
end
$$;

-- ---------------------------------------------------------------------
-- X4: MONTEUR NEGATIV - kein Schreibrecht auf einem der drei Kataloge.
--
-- Die Abweisung kommt aus der Policy `<tabelle>_write` (is_staff()), nicht
-- aus dem Tabellenrecht: app_user besitzt insert auf allen drei Objekten
-- (0019, Abschnitt 5). Jeder Versuch muss mit 42501 enden.
-- ---------------------------------------------------------------------
do $$
declare
  v_statement text;
  v_wrong text[] := array[]::text[];
begin
  perform set_config('app.user_id', '26a00000-0000-0000-0000-000000000003', true);

  foreach v_statement in array array[
    'insert into public.trades (label) values (''X26 Monteurversuch Gewerk'')',
    'insert into public.contact_functions (label) values (''X26 Monteurversuch Funktion'')',
    'insert into public.object_types (label) values (''X26 Monteurversuch Objektart'')'
  ]
  loop
    begin
      execute v_statement;
      v_wrong := array_append(v_wrong, v_statement);
    exception
      when insufficient_privilege then null;
    end;
  end loop;

  if array_length(v_wrong, 1) is not null then
    raise exception 'SMOKE X4 FAIL Monteur darf schreiben: %', array_to_string(v_wrong, ' | ');
  end if;

  raise notice 'SMOKE X4 OK drei Schreibversuche des Monteurs enden mit 42501 (is_staff() greift)';
end
$$;

-- ---------------------------------------------------------------------
-- X5: DISPONENT darf auf allen drei Katalogen anlegen.
-- ---------------------------------------------------------------------
do $$
declare
  v_trade uuid;
  v_function uuid;
  v_object uuid;
begin
  perform set_config('app.user_id', '26a00000-0000-0000-0000-000000000002', true);

  insert into public.trades (label) values ('X26 Disponent Gewerk')
    returning id into v_trade;
  insert into public.contact_functions (label) values ('X26 Disponent Funktion')
    returning id into v_function;
  insert into public.object_types (label) values ('X26 Disponent Objektart')
    returning id into v_object;

  if v_trade is null or v_function is null or v_object is null then
    raise exception 'SMOKE X5 FAIL mindestens eine Anlage durch den Disponenten ist fehlgeschlagen';
  end if;

  raise notice 'SMOKE X5 OK der Disponent darf auf allen drei Katalogen anlegen';
end
$$;

-- ---------------------------------------------------------------------
-- X6: ADMINISTRATOR darf ebenfalls auf allen drei Katalogen anlegen -
-- is_staff() unterscheidet NICHT zwischen admin und disponent (anders als
-- der Fehlalarm-Waechter aus 0018, der ausdruecklich nur disponent zulaesst).
-- ---------------------------------------------------------------------
do $$
declare
  v_trade uuid;
  v_function uuid;
  v_object uuid;
begin
  perform set_config('app.user_id', '26a00000-0000-0000-0000-000000000001', true);

  insert into public.trades (label) values ('X26 Administrator Gewerk')
    returning id into v_trade;
  insert into public.contact_functions (label) values ('X26 Administrator Funktion')
    returning id into v_function;
  insert into public.object_types (label) values ('X26 Administrator Objektart')
    returning id into v_object;

  if v_trade is null or v_function is null or v_object is null then
    raise exception 'SMOKE X6 FAIL mindestens eine Anlage durch den Administrator ist fehlgeschlagen';
  end if;

  raise notice 'SMOKE X6 OK der Administrator darf auf allen drei Katalogen anlegen';
end
$$;

-- ---------------------------------------------------------------------
-- X7: APP_USER KEIN DELETE - auch Staff scheitert, weil das Tabellenrecht
-- fehlt, obwohl die Policy `<tabelle>_write for all` ein delete auf
-- Zeilenebene grundsaetzlich zuliesse. Geprueft unter dem Disponenten, damit
-- die Ablehnung eindeutig dem FEHLENDEN TABELLENRECHT zugeordnet ist und
-- nicht der Policy.
-- ---------------------------------------------------------------------
do $$
declare
  v_state text;
  v_id uuid;
begin
  perform set_config('app.user_id', '26a00000-0000-0000-0000-000000000002', true);

  insert into public.trades (label) values ('X26 Loeschversuch Gewerk')
    returning id into v_id;

  v_state := null;
  begin
    delete from public.trades where id = v_id;
  exception
    when insufficient_privilege then
      v_state := sqlstate;
    when others then
      v_state := sqlstate;
  end;

  if v_state is distinct from '42501' then
    raise exception
      'SMOKE X7 FAIL SQLSTATE % statt 42501 - app_user duerfte kein delete auf public.trades besitzen',
      coalesce(v_state, 'kein Fehler - die Zeile wurde geloescht');
  end if;

  raise notice
    'SMOKE X7 OK app_user besitzt kein delete-Tabellenrecht auf public.trades - der Versuch des Disponenten scheitert mit 42501, obwohl die Policy delete grundsaetzlich zulaesst';
end
$$;

-- =====================================================================
-- X8: FK-VERHALTEN von contacts.function_id - NICHT kaskadierend.
--
-- Laeuft im EIGENTUEMERKONTEXT: app_user besitzt ohnehin kein delete auf
-- public.contact_functions (Abschnitt 5 der Migration), ein Loeschversuch
-- unter app_user wuerde also am Tabellenrecht scheitern und nichts ueber das
-- FK-Verhalten selbst aussagen. Genau deshalb wechselt dieser Fall bewusst
-- den Kontext.
-- =====================================================================
reset role;
select set_config('app.user_id', '26a00000-0000-0000-0000-000000000002', true);

do $$
declare
  v_function uuid;
  v_contact uuid;
  v_state text;
  v_after uuid;
begin
  insert into public.contact_functions (label) values ('X26 FK-Funktion')
    returning id into v_function;
  insert into public.contacts (id, customer_id, name, function_id)
  values ('26a00000-0000-0000-0000-0000000000b1', '26a00000-0000-0000-0000-0000000000a3',
          'X26 Ansprechpartner', v_function)
  returning id into v_contact;

  -- Loeschversuch auf die referenzierte Funktion muss abgewiesen werden.
  v_state := null;
  begin
    delete from public.contact_functions where id = v_function;
  exception
    when foreign_key_violation then
      v_state := sqlstate;
    when others then
      v_state := sqlstate;
  end;

  if v_state is distinct from '23503' then
    raise exception
      'SMOKE X8 FAIL SQLSTATE % statt 23503 beim Loeschversuch der referenzierten Funktion - contacts.function_id waere kaskadierend oder ON DELETE SET NULL',
      coalesce(v_state, 'kein Fehler - die Funktion wurde geloescht');
  end if;

  -- Der Ansprechpartner traegt die Verknuepfung unveraendert weiter - kein
  -- automatisches Nullsetzen.
  select function_id into v_after from public.contacts where id = v_contact;
  if v_after is distinct from v_function then
    raise exception
      'SMOKE X8 FAIL contacts.function_id wurde auf % geaendert statt unveraendert % zu bleiben - das waere ON DELETE SET NULL',
      coalesce(v_after::text, 'NULL'), v_function;
  end if;

  -- Erst nach Entfernen der Referenz laesst sich die Funktion loeschen -
  -- Nachweis, dass 23503 tatsaechlich am Fremdschluessel lag und nicht an
  -- etwas anderem.
  delete from public.contacts where id = v_contact;
  delete from public.contact_functions where id = v_function;

  raise notice
    'SMOKE X8 OK contacts.function_id ist NICHT kaskadierend: das Loeschen einer referenzierten Funktion wird mit 23503 abgewiesen, der Verweis bleibt unveraendert, und erst nach Entfernen des Ansprechpartners laesst sich die Funktion loeschen';
end
$$;

-- =====================================================================
-- Ende der Wirkungsphase.
-- =====================================================================
reset role;
select set_config('app.user_id', '', false);

rollback;

-- ---------------------------------------------------------------------
-- X-ENDE: Gegenprobe nach dem Rollback, im Eigentuemerkontext.
-- ---------------------------------------------------------------------
do $$
declare
  v_rest integer;
  v_start integer;
  v_jetzt integer;
  v_trades integer;
  v_functions integer;
  v_objects integer;
begin
  select
    (select count(*) from public.profiles where id::text like '26a00000-%')
    + (select count(*) from public.auth_accounts where id::text like '26a00000-%')
    + (select count(*) from public.customers where id::text like '26a00000-%')
    + (select count(*) from public.contacts where id::text like '26a00000-%')
    + (select count(*) from public.trades where label like 'X26 %')
    + (select count(*) from public.contact_functions where label like 'X26 %')
    + (select count(*) from public.object_types where label like 'X26 %')
  into v_rest;

  if v_rest <> 0 then
    raise exception
      'SMOKE X-ENDE FAIL % Zeile(n) mit dem Praefix/Marker 26a00000-/"X26 " bleiben nach dem Rollback zurueck',
      v_rest;
  end if;

  select count(*) into v_trades from public.trades
   where label in ('50 Hz','LST','TK','OSE','LWL-LST','LWL-TK','Unbekannt');
  select count(*) into v_functions from public.contact_functions
   where label in ('BÜW','LBÜW','örtl. LST');
  select count(*) into v_objects from public.object_types
   where label in ('BÜ','LSW');
  if v_trades <> 7 or v_functions <> 3 or v_objects <> 2 then
    raise exception
      'SMOKE X-ENDE FAIL Startwerte nach dem Rollback: trades=% (erwartet 7), contact_functions=% (erwartet 3), object_types=% (erwartet 2) - der dauerhafte Seed-Zustand aus 0019 hat den Rollback nicht ueberdauert',
      v_trades, v_functions, v_objects;
  end if;

  v_start := nullif(current_setting('kb26a.proc_count_start', true), '')::integer;
  select count(*) into v_jetzt
  from pg_proc p
  join pg_namespace ns on ns.oid = p.pronamespace
  where ns.nspname = 'public';
  if v_start is null or v_jetzt <> v_start then
    raise exception
      'SMOKE X-ENDE FAIL Funktionszahl in schema public: jetzt %, beim Laufbeginn %',
      v_jetzt, coalesce(v_start::text, 'unbekannt');
  end if;

  raise notice
    'SMOKE X-ENDE OK AUFTRAG_6/Migration 0019 belegt (Idempotenz-Doppellauf, Seeds, Rollenmatrix, kein delete-Tabellenrecht fuer app_user, FK von contacts.function_id nicht kaskadierend); die Wirkungsphase wurde per rollback vollstaendig zurueckgenommen, der dauerhafte Seed-Zustand der drei Kataloge (7/3/2) bleibt bestehen, und es ist kein neues Schemaobjekt entstanden';
end
$$;

select set_config('kb26a.proc_count_start', '', false);
