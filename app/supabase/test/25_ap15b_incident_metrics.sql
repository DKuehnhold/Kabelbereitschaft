\set ON_ERROR_STOP on

-- =====================================================================
-- AP15-b - Fehlalarm-Kennzeichnung (Migration 0018) unter der
-- Anwendungsrolle app_user mit AKTIVER RLS.
--
-- Erwartet die vollstaendige Kette einschliesslich 0012 bis 0018 sowie die
-- Smokes 15-24, insbesondere 19_ap14b_platform.sql,
-- 19a_ap14b_grant_reset.sql, 20_ap14b_data.sql,
-- 21_ap14b_masterdata_inventory.sql, 22_ap14b_images.sql,
-- 23_ap14b_admin_users.sql und 24_ap15_dashboard_metrics.sql. Diese Datei ist
-- der neue letzte Eintrag der SQL-Kette. Sie laeuft NICHT unmittelbar hinter
-- 24_ap15_dashboard_metrics.sql: dazwischen steht die Migration 0018, die
-- unmittelbar vor ihrem Smoke eingeordnet ist (run_db_tests.sh:167-184,
-- dieselbe Konvention wie bei 0015/21, 0016/22 und 0017/23).
--
-- GEGENSTAND: der Vertrag der Migration 0018 fuer
-- public.incidents.is_false_alarm. Er hat drei Teile, und alle drei werden hier
-- gemessen statt behauptet:
--   1. ZIELZUSTAND UND WIEDERHOLBARKEIT der Spalte. 0018 fuehrt die Spalte auch
--      dann in den Zielzustand `not null default false`, wenn sie aus einem
--      VORLAUF nullable und ohne Default vorliegt (Abschnitt 1a-1e der
--      Migration). Das ist Befund F1: `add column if not exists` wird in diesem
--      Fall vollstaendig uebersprungen, NOT NULL und Default werden also gerade
--      NICHT nachgezogen. W2 stellt den Vorzustand ausdruecklich her und laesst
--      die ECHTE Migrationsdatei erneut laufen.
--   2. SPALTENSCHARFER WAECHTER. trg_incident_guard_false_alarm ist
--      `before insert or update` (0018, Abschnitt 2). Die INSERT-Abdeckung ist
--      Befund F2: ohne sie waere die Disponent-only-Regel ueber den Anlageweg
--      umgehbar, weil incidents_insert jedem is_staff() das INSERT erlaubt
--      (0001_init.sql:542-543) und ein Administrator die Kennzeichnung damit
--      direkt bei der Anlage setzen koennte. W3, W5 und W6 messen genau das.
--   3. DIE VIEW. public.incident_list_view traegt is_false_alarm als LETZTE
--      Spalte; die Positionen 1 bis 32 bleiben unveraendert, weil
--      `create or replace view` fuer bereits vorhandene Spalten dieselbe
--      Reihenfolge verlangt (0018, Abschnitt 3). W13 vergleicht die
--      vollstaendige Spaltenliste, nicht nur die Zahl.
--
-- Verbindliche Eigenschaften dieses Smokes:
--   * Er fuehrt KEIN `grant` und KEIN `revoke` aus, aendert keine Policy und
--     schaltet keinen Trigger ab. Die einzigen DDL-Anweisungen sind (a) die
--     beiden `alter column`-Anweisungen, mit denen W2 den Vorzustand der
--     Spalte herstellt, und (b) das, was die per `\ir` eingebundene Migration
--     0018 selbst tut. Beides wird durch das `rollback;` am Ende vollstaendig
--     zurueckgenommen; W-ENDE zaehlt das nach.
--   * Er erzeugt KEIN dauerhaftes Schemaobjekt - keine Funktion, keine View,
--     keine Tabelle, auch keine temporaere. W14 zaehlt die Funktionen in
--     schema public vor und nach dem Lauf, damit das gemessen und nicht
--     behauptet ist.
--   * Die Identitaet wird immer mit set_config('app.user_id', ..., true)
--     gesetzt - genau so, wie withUserTransaction() es tut
--     (app/src/lib/db/index.ts). Geprueft wird unter `set role app_user` mit
--     aktiver RLS. Der Eigentuemerkontext (`reset role;`) dient ausschliesslich
--     den Fixtures, den beiden `alter column`-Anweisungen aus W2, dem
--     Migrationslauf selbst und den Gegenproben.
--   * NUR SYNTHETISCHE WERTE. Keine echte Person, kein echtes Passwort, kein
--     echter Hash, keine Telefonnummer, keine Standortdaten. Alle drei Konten
--     tragen den projektweit etablierten Marker
--     '!MIGRATED-ACCOUNT-REQUIRES-RESET!' (0012:205, in 19_ap14b_platform.sql
--     und 20_ap14b_data.sql ausdruecklich toleriert). Ein '$argon2id$'-artiger
--     Wert ist hier NICHT zulaessig: der Runner startet die
--     Node-Integrationstests in DERSELBEN Datenbank nach dieser Datei, und
--     usableAdminCount() zaehlt jedes aktive Admin-Profil, dessen
--     password_hash auf '$argon2id$' passt - die Bootstrap-Faelle wuerden
--     scheitern. Dieselbe Begruendung wie in 24_ap15_dashboard_metrics.sql.
--     E-Mail-Adressen liegen auf @beispiel.invalid.
--
-- WARUM DIE GANZE WIRKUNGSPHASE - FIXTURES EINGESCHLOSSEN - IN EINER
-- TRANSAKTION MIT ROLLBACK LAEUFT:
--   Diese Datei legt Vorgaenge an. Ein Aufraeumen per DELETE ist dafuer
--   UNMOEGLICH: die Loeschsperre trg_incident_tasks_no_delete
--   (0011_ap13_tasks_bulk.sql:113-123) ist eine unbedingte BEFORE-DELETE-Regel,
--   sie greift auch im Eigentuemerkontext und auch bei der Kaskade aus
--   public.incidents (0011_ap13_tasks_bulk.sql:28). Ein
--   `delete from public.incidents` waere also nur nach einer Aufweichung dieser
--   Sperre moeglich, und die ist ausgeschlossen. 20_ap14b_data.sql:28-43 und
--   24_ap15_dashboard_metrics.sql haben denselben Sachverhalt identisch
--   entschieden. Hier kommt ein zweiter, staerkerer Grund hinzu: W2 versetzt die
--   Spalte is_false_alarm ABSICHTLICH in den fehlerhaften Vorzustand. Dieser
--   Zwischenzustand darf die Datei unter keinen Umstaenden ueberdauern, weil die
--   Node-Integrationstests danach in derselben Datenbank laufen. Bleibt genau
--   ein Weg: EIN einziger expliziter Transaktionsrahmen um die gesamte
--   Wirkungsphase und ein `rollback;` am Ende. DDL ist in PostgreSQL
--   transaktional, der Rollback nimmt daher auch die Spalten- und
--   Triggeraenderungen zurueck; W-ENDE prueft den Zustand danach ausdruecklich
--   nach.
--
-- WARUM W2 DIE MIGRATION PER `\ir` EINBINDET UND NICHT NACHBAUT:
--   Gegenstand des Falles ist die Datei
--   app/supabase/migrations/0018_ap15b_incident_metrics.sql selbst. Eine Kopie
--   ihrer Anweisungen in diesen Smoke wuerde genau das nicht pruefen, was F1
--   ausmacht - sie wuerde nur beweisen, dass die KOPIE richtig ist. `\ir` loest
--   den Pfad relativ zum Verzeichnis der EINSCHLIESSENDEN Datei auf (also
--   relativ zu app/supabase/test/) und funktioniert auch innerhalb einer
--   offenen Transaktion. Die NOTICE-Meldungen der Migration
--   ("column ... already exists, skipping", "trigger ... does not exist,
--   skipping") sind dabei erwartet und kein Fehler.
--
-- HERKUNFT DER GEPRUEFTEN REGELN - alles gelesen, nichts angenommen:
--   * Spalte, Backfill und Zielzustand: 0018, Abschnitt 1a-1e.
--   * Waechter, SQLSTATE '42501' und die Disponent-only-Regel: 0018,
--     Abschnitt 2 (public.tg_incident_guard_false_alarm,
--     `current_user_role() is distinct from 'disponent'`).
--   * public.current_user_role() ist SECURITY DEFINER STABLE und liest die
--     Rolle aus profiles. Angelegt wird sie in 0001_init.sql:52-57, dort noch
--     mit auth.uid() als Identitaetsquelle - fuer die LAUFENDE Datenbank gilt
--     das ausdruecklich NICHT mehr: 0012_ap14b_platform_auth.sql:320-327
--     schreibt jede Funktionsdefinition mit auth.uid() auf
--     app.current_user_id() um, und 0013_ap14b_drop_supabase_compat.sql:7-42
--     bricht ab, falls danach noch eine auth-Referenz verbliebe. Wirksame
--     Identitaetsquelle ist damit app.current_user_id(), also der per
--     set_config('app.user_id', ...) gesetzte Wert (0012:9-26; dieselbe
--     Feststellung in 0018, Abschnitt 2).
--   * incidents_insert with check `public.is_staff()`
--     (0001_init.sql:542-543); is_staff() = admin oder disponent
--     (0001_init.sql:63-65). Ein monteur kann ueberhaupt nicht anlegen - genau
--     das ist der Grund fuer die ehrliche Beschriftung von W12.
--   * incidents_update using/with check
--     `public.is_staff() or public.is_assigned_to_incident(id)`
--     (0001_init.sql:544-546); is_assigned_to_incident() verlangt ausdruecklich
--     `a.is_active` (0001_init.sql:67-76).
--   * public.tg_incident_guard ist ausdruecklich nur `before update`
--     (0001_init.sql:415-417) und laesst fuer einen Monteur eine Aenderung an
--     `description` durch (0001_init.sql:394-414) - deshalb ist W11 ueberhaupt
--     als Vergleichspaar formulierbar.
--   * app_user besitzt select, insert und update auf public.incidents
--     (0014_ap14b_data_grants.sql:55) - die Faelle scheitern also nicht am
--     Tabellenrecht, sondern genau an Policy bzw. Waechter.
--   * public.profiles.id verweist seit 0012 auf public.auth_accounts, jedes
--     Profil braucht daher ein Konto (0012_ap14b_platform_auth.sql:31-49).
--
-- Meldungskennung: W (W1-W14, Fixture-Gegenprobe W-FIXTURES, Abschluss
-- W-ENDE). Der Buchstabe ist in der Kette frei: 15/19 nutzen P, 16 nutzt L,
-- 17/20 nutzen D, 18 nutzt E, 21 nutzt M/N, 22 nutzt B/G, 23 nutzt U, 24 nutzt
-- K.
-- UUID-Praefix: 25c00000-. Er kommt in keiner anderen Test- oder
-- Migrationsdatei vor (24c00000- gehoert 24_ap15_dashboard_metrics.sql,
-- 25e00000- gehoert app/test/integration/ap14b-admin-users.int.mjs).
--
-- Kennungen dieser Datei:
--   ...0001 Administrator   - is_staff(), aber NICHT 'disponent'
--   ...0002 Disponent       - die einzige berechtigte Rolle
--   ...0003 Monteur         - aktiv zugewiesen an Vorgang ...00b6
--   ...00a1 Bauabschnitt, ...00a2 VzG-Strecke, ...00a3 Kunde
--   ...00b1 Vorgang von W2 (wird ausdruecklich mit is_false_alarm = NULL
--           angelegt und muss nach dem Migrationslauf false tragen)
--   ...00b2 Vorgang von W4 (Disponent, true) und W7 (true -> false)
--   ...00b3 Vorgang von W6 (Administrator, Spalte nicht genannt)
--   ...00b4 Vorgang von W6 (Administrator, ausdruecklich false)
--   ...00b5 Fixture-Basiszeile fuer W8, W9 und W10
--   ...00b6 Fixture-Basiszeile des zugewiesenen Monteurs fuer W11
--   ...00c1 Anlageversuch von W5, der NICHT entstehen darf
--   ...00c2 Anlageversuch von W12, der NICHT entstehen darf
-- =====================================================================

reset role;
select set_config('app.user_id', '', false);

-- ---------------------------------------------------------------------
-- Ausgangsstand der Funktionen in schema public, SITZUNGSWEIT und AUSSERHALB
-- des Transaktionsrahmens festgehalten (is_local = false und vor `begin;`,
-- damit der Wert das `rollback;` ueberlebt).
--
-- Er dient W14 und W-ENDE: dieser Smoke soll nachweislich keine Funktion
-- erzeugen, und der Migrationslauf in W2 soll ausschliesslich
-- `create or replace` auf eine bereits vorhandene Funktion ausfuehren. Ein
-- benutzerdefinierter Konfigurationsparameter ist KEIN Schemaobjekt: er lebt in
-- dieser psql-Sitzung, wird am Dateiende zurueckgesetzt und hinterlaesst
-- nichts. Muster uebernommen aus 24_ap15_dashboard_metrics.sql.
-- ---------------------------------------------------------------------
select set_config(
  'kb25c.proc_count_start',
  (
    select count(*)::text
    from pg_proc p
    join pg_namespace ns on ns.oid = p.pronamespace
    where ns.nspname = 'public'
  ),
  false);

-- =====================================================================
-- Beginn der Wirkungsphase. ALLES bis zum `rollback;` weiter unten gehoert
-- dazu, einschliesslich der Fixtures, der beiden `alter column`-Anweisungen aus
-- W2 und des Migrationslaufs.
-- =====================================================================
begin;

-- ---------------------------------------------------------------------
-- Fixtures im Eigentuemerkontext (RLS gilt fuer den Eigentuemer nicht; das ist
-- genau der Grund, weshalb alle Wirkungsfaelle weiter unten unter
-- `set role app_user` laufen).
--
-- Drei Identitaeten, eine je Rolle: der Waechter unterscheidet ausschliesslich
-- 'disponent' gegen alles andere, und "alles andere" muss mindestens den
-- Administrator (is_staff(), aber nicht berechtigt) und den zugewiesenen
-- Monteur (zeilenberechtigt, aber nicht spaltenberechtigt) umfassen.
-- ---------------------------------------------------------------------
insert into public.auth_accounts (id, email, password_hash, must_change_password, is_disabled)
values
  ('25c00000-0000-0000-0000-000000000001', 'w25.admin@beispiel.invalid', '!MIGRATED-ACCOUNT-REQUIRES-RESET!', false, false),
  ('25c00000-0000-0000-0000-000000000002', 'w25.dispo@beispiel.invalid', '!MIGRATED-ACCOUNT-REQUIRES-RESET!', false, false),
  ('25c00000-0000-0000-0000-000000000003', 'w25.monteur@beispiel.invalid', '!MIGRATED-ACCOUNT-REQUIRES-RESET!', false, false)
on conflict (id) do nothing;

insert into public.profiles (id, full_name, role, is_active)
values
  ('25c00000-0000-0000-0000-000000000001', 'W25 Admin', 'admin', true),
  ('25c00000-0000-0000-0000-000000000002', 'W25 Disponent', 'disponent', true),
  ('25c00000-0000-0000-0000-000000000003', 'W25 Monteur', 'monteur', true)
on conflict (id) do nothing;

-- Bauabschnitt: Pflichtvorbedingung jedes Vorgangs.
-- public.incidents.construction_stage_id ist `uuid not null references
-- public.construction_stages(id)` (0001_init.sql:185).
insert into public.construction_stages (id, code, name)
values ('25c00000-0000-0000-0000-0000000000a1', 'B25W', 'Bauabschnitt AP15-b Fehlalarm')
on conflict (id) do nothing;

-- VzG-Strecke: nicht Pflicht, aber gesetzt, damit die abgeleitete Aufgabe
-- historic_vzg nicht entsteht (0011_ap13_tasks_bulk.sql:195, 268) und die
-- Fixtures nichts erzeugen, was sie nicht brauchen. Muster und Begruendung aus
-- 20_ap14b_data.sql:103-105 und 24_ap15_dashboard_metrics.sql.
-- line_number muss genau vier Ziffern tragen
-- (0007_ap9_master_data.sql:63).
insert into public.vzg_lines (id, line_number, construction_stage_id)
values ('25c00000-0000-0000-0000-0000000000a2', '1825', '25c00000-0000-0000-0000-0000000000a1')
on conflict (id) do nothing;

-- Kunde: public.incidents.customer_id ist ein Fremdschluessel auf
-- public.customers (0008_ap10_incident_master_data.sql:22) und nullable. Er
-- wird hier trotzdem gesetzt, weil public.incident_list_view ueber
-- customer_id auf public.customers verbindet (0018:300) und W13 die
-- Spaltenliste dieser View prueft - eine leere Referenz wuerde den Fall nicht
-- entwerten, aber auch nichts belegen.
insert into public.customers (id, name)
values ('25c00000-0000-0000-0000-0000000000a3', 'W25 Kunde AP15-b')
on conflict (id) do nothing;

-- Zwei Basiszeilen im Eigentuemerkontext.
--   ...00b5 traegt W8, W9 und W10 (Administrator).
--   ...00b6 traegt W11 (zugewiesener Monteur).
-- Beide nennen is_false_alarm NICHT: der Default false greift, und der
-- INSERT-Zweig des Waechters laesst `is distinct from true` durch (0018:210-219)
-- - im Eigentuemerkontext liefert current_user_role() NULL, eine Anlage MIT
-- Kennzeichnung waere hier also mit 42501 abgewiesen (0018:186-188).
-- Spalten von public.incidents, die hier gesetzt werden: NOT NULL ist heute
-- ausschliesslich construction_stage_id (0001_init.sql:185). vzg_line_number
-- und km_from waren in 0001_init.sql:186-187 ebenfalls NOT NULL, sind es aber
-- seit 0008_ap10_incident_master_data.sql:25-26 nicht mehr (dort werden beide
-- NOT-NULL-Bedingungen ausdruecklich aufgehoben). Dieser Smoke setzt sie
-- trotzdem, damit der abgeleitete Aufgabenpfad und historic_vzg deterministisch
-- bleiben - nicht, weil das Schema es erzwingt.
insert into public.incidents
  (id, customer_id, construction_stage_id, vzg_line_number, vzg_line_id, km_from, status, description)
values
  ('25c00000-0000-0000-0000-0000000000b5',
   '25c00000-0000-0000-0000-0000000000a3',
   '25c00000-0000-0000-0000-0000000000a1', '1825',
   '25c00000-0000-0000-0000-0000000000a2', 25.500,
   'neu', 'AP15-b Fehlalarm - Basiszeile der Administratorfaelle'),
  ('25c00000-0000-0000-0000-0000000000b6',
   '25c00000-0000-0000-0000-0000000000a3',
   '25c00000-0000-0000-0000-0000000000a1', '1825',
   '25c00000-0000-0000-0000-0000000000a2', 25.600,
   'neu', 'AP15-b Fehlalarm - Basiszeile des zugewiesenen Monteurs')
on conflict (id) do nothing;

-- Aktive Zuweisung: erst sie macht den Monteur ueber incidents_update
-- ueberhaupt zeilenberechtigt (0001_init.sql:544-546). Ohne `is_active` wuerde
-- is_assigned_to_incident() die Zeile nicht oeffnen (0001_init.sql:67-76) und
-- W11 wuerde eine Ablehnung der Policy statt der Ablehnung des Waechters
-- messen.
-- Die Zuweisung traegt eine von der Datenbank vergebene id; ein
-- `on conflict (id)` koennte hier also nie greifen. Abgesichert wird deshalb
-- ueber den fachlichen Schluessel, den der partielle Unique-Index
-- uq_assignment_active vorgibt (0001_init.sql:222-223).
insert into public.incident_assignments (incident_id, monteur_id, is_active)
values
  ('25c00000-0000-0000-0000-0000000000b6',
   '25c00000-0000-0000-0000-000000000003', true)
on conflict (incident_id, monteur_id) where is_active do nothing;

-- ---------------------------------------------------------------------
-- W-FIXTURES: Ausgangslage im Eigentuemerkontext belegen, BEVOR ein Fall
-- laeuft. Vier Erwartungen:
--   * die drei Identitaeten stehen mit der jeweils gewollten Rolle und aktiv
--     bereit - eine verschobene Rolle wuerde die Grenze 'disponent' gegen
--     'alles andere' lautlos verruecken und W4 bis W12 entwerten;
--   * Kunde und Bauabschnitt bestehen;
--   * es bestehen GENAU die zwei Basiszeilen mit dem Praefix 25c00000-, beide
--     mit is_false_alarm = false. Ein Rest eines frueheren, hart abgebrochenen
--     Laufs waere hier sichtbar;
--   * die Zuweisung des Monteurs ist AKTIV.
-- ---------------------------------------------------------------------
do $$
declare
  v_admin integer;
  v_dispo integer;
  v_monteur integer;
  v_stammdaten integer;
  v_vorgaenge integer;
  v_false integer;
  v_zuweisung integer;
begin
  select count(*) into v_admin
  from public.profiles
  where id = '25c00000-0000-0000-0000-000000000001'
    and role = 'admin' and is_active;

  select count(*) into v_dispo
  from public.profiles
  where id = '25c00000-0000-0000-0000-000000000002'
    and role = 'disponent' and is_active;

  select count(*) into v_monteur
  from public.profiles
  where id = '25c00000-0000-0000-0000-000000000003'
    and role = 'monteur' and is_active;

  if v_admin <> 1 or v_dispo <> 1 or v_monteur <> 1 then
    raise exception
      'SMOKE W-FIXTURES FAIL Rollen nicht wie gewollt (admin=%, disponent=%, monteur=% - erwartet je 1)',
      v_admin, v_dispo, v_monteur;
  end if;

  select
    (select count(*) from public.customers
      where id = '25c00000-0000-0000-0000-0000000000a3')
    + (select count(*) from public.construction_stages
        where id = '25c00000-0000-0000-0000-0000000000a1')
  into v_stammdaten;

  if v_stammdaten <> 2 then
    raise exception
      'SMOKE W-FIXTURES FAIL Kunde und Bauabschnitt: % von 2 Stammdatenzeilen vorhanden',
      v_stammdaten;
  end if;

  select count(*), count(*) filter (where is_false_alarm is false)
  into v_vorgaenge, v_false
  from public.incidents
  where id::text like '25c00000-%';

  if v_vorgaenge <> 2 then
    raise exception
      'SMOKE W-FIXTURES FAIL % Vorgang/Vorgaenge mit dem Praefix 25c00000- statt genau zwei - ein Rest eines frueheren Laufs wuerde die Faelle verfaelschen',
      v_vorgaenge;
  end if;
  if v_false <> 2 then
    raise exception
      'SMOKE W-FIXTURES FAIL nur % der beiden Basiszeilen tragen is_false_alarm = false', v_false;
  end if;

  select count(*) into v_zuweisung
  from public.incident_assignments
  where incident_id = '25c00000-0000-0000-0000-0000000000b6'
    and monteur_id = '25c00000-0000-0000-0000-000000000003'
    and is_active;

  if v_zuweisung <> 1 then
    raise exception
      'SMOKE W-FIXTURES FAIL % aktive Zuweisung(en) des Monteurs auf ...00b6 statt genau einer', v_zuweisung;
  end if;

  raise notice
    'SMOKE W-FIXTURES OK drei Identitaeten (Administrator, Disponent, Monteur), Kunde, Bauabschnitt, VzG-Strecke, zwei Basiszeilen mit is_false_alarm = false und eine AKTIVE Zuweisung des Monteurs stehen bereit';
end
$$;

-- ---------------------------------------------------------------------
-- W1: Zielzustand der Spalte nach der regulaeren Kette.
--
-- Gelesen wird der Katalog, nicht das Verhalten: atttypid ist boolean,
-- attnotnull ist true, atthasdef ist true und der Defaultausdruck ist `false`.
-- Genau diese vier Eigenschaften stellt 0018 Abschnitt 1a-1e her; W2 nimmt sie
-- gleich darauf absichtlich weg.
-- ---------------------------------------------------------------------
do $$
declare
  v_typ text;
  v_notnull boolean;
  v_hasdef boolean;
  v_default text;
begin
  select
    a.atttypid::regtype::text,
    a.attnotnull,
    a.atthasdef,
    (
      select pg_get_expr(d.adbin, d.adrelid)
      from pg_attrdef d
      where d.adrelid = a.attrelid and d.adnum = a.attnum
    )
  into v_typ, v_notnull, v_hasdef, v_default
  from pg_attribute a
  where a.attrelid = 'public.incidents'::regclass
    and a.attname = 'is_false_alarm'
    and not a.attisdropped;

  if v_typ is null then
    raise exception
      'SMOKE W1 FAIL public.incidents.is_false_alarm existiert nicht - Migration 0018 ist nicht gelaufen';
  end if;
  if v_typ <> 'boolean' then
    raise exception 'SMOKE W1 FAIL Typ der Spalte ist % statt boolean', v_typ;
  end if;
  if v_notnull is distinct from true then
    raise exception 'SMOKE W1 FAIL attnotnull ist % statt true',
      coalesce(v_notnull::text, 'NULL');
  end if;
  if v_hasdef is distinct from true then
    raise exception 'SMOKE W1 FAIL atthasdef ist % statt true',
      coalesce(v_hasdef::text, 'NULL');
  end if;
  if v_default is distinct from 'false' then
    raise exception 'SMOKE W1 FAIL Defaultausdruck ist % statt false',
      coalesce(v_default, 'NULL');
  end if;

  raise notice
    'SMOKE W1 OK public.incidents.is_false_alarm ist boolean, NOT NULL und traegt den Defaultausdruck false - der Zielzustand aus 0018 Abschnitt 1a-1e';
end
$$;

-- =====================================================================
-- W2 - F1-REGRESSION, DER KERN DIESER DATEI.
--
-- Ablauf in fuenf Schritten, verteilt auf mehrere Anweisungen auf oberster
-- Ebene, weil `\ir` eine psql-Metaanweisung ist und nicht in einem do-Block
-- stehen kann:
--   1. Spalte absichtlich in den Vorzustand versetzen (nullable, kein Default).
--   2. Eine Zeile mit ausdruecklich is_false_alarm = NULL einfuegen.
--   3. Zwischenpruefung (do-Block, im Erfolgsfall STILL - der Fall meldet genau
--      eine OK-Zeile, und die steht in Schritt 5).
--   4. Die ECHTE Migrationsdatei erneut anwenden.
--   5. Nachweis (do-Block mit der OK-Meldung).
-- =====================================================================
reset role;
select set_config('app.user_id', '', true);

-- W2 Schritt 1: Vorzustand herstellen. Das ist die einzige DDL dieser Datei
-- ausserhalb der eingebundenen Migration. Sie ist zwingend, weil der Befund F1
-- genau diesen Ausgangszustand voraussetzt: liegt die Spalte aus einem VORLAUF
-- nullable und ohne Default vor, ueberspringt `add column if not exists` in
-- 0018 Abschnitt 1b die gesamte Anweisung. Ein Typwechsel wird hier bewusst
-- NICHT nachgestellt - public.incident_list_view haengt an der Spalte, und
-- PostgreSQL lehnt den Typwechsel einer von einer View benutzten Spalte ab
-- (0018:52-56).
alter table public.incidents
  alter column is_false_alarm drop not null;
alter table public.incidents
  alter column is_false_alarm drop default;

-- W2 Schritt 2: die NULL-Zeile. Sie entsteht ausdruecklich MIT dem Wert NULL
-- und nicht durch Weglassen der Spalte - nur so ist der Backfill in 0018
-- Abschnitt 1d ueberhaupt gefordert. Dass dieser INSERT durchlaeuft, ist Teil
-- des Nachweises: der INSERT-Zweig des Waechters laesst
-- `is distinct from true` durch (0018:217), und NULL ist von true verschieden.
insert into public.incidents
  (id, customer_id, construction_stage_id, vzg_line_number, vzg_line_id, km_from,
   status, description, is_false_alarm)
values
  ('25c00000-0000-0000-0000-0000000000b1',
   '25c00000-0000-0000-0000-0000000000a3',
   '25c00000-0000-0000-0000-0000000000a1', '1825',
   '25c00000-0000-0000-0000-0000000000a2', 25.100,
   'neu', 'AP15-b Fehlalarm - Zeile im Vorzustand mit is_false_alarm = NULL',
   null);

-- W2 Schritt 3: Zwischenpruefung. Im Erfolgsfall still; eine zweite OK-Zeile
-- fuer W2 wuerde die Meldungsform der Kette verletzen.
do $$
declare
  v_notnull boolean;
  v_hasdef boolean;
  v_null_gesamt integer;
  v_null_b1 integer;
begin
  select a.attnotnull, a.atthasdef
  into v_notnull, v_hasdef
  from pg_attribute a
  where a.attrelid = 'public.incidents'::regclass
    and a.attname = 'is_false_alarm'
    and not a.attisdropped;

  if v_notnull is distinct from false or v_hasdef is distinct from false then
    raise exception
      'SMOKE W2 FAIL der Vorzustand ist nicht hergestellt (attnotnull=%, atthasdef=% - erwartet je false)',
      coalesce(v_notnull::text, 'NULL'), coalesce(v_hasdef::text, 'NULL');
  end if;

  select count(*) into v_null_gesamt
  from public.incidents where is_false_alarm is null;

  select count(*) into v_null_b1
  from public.incidents
  where id = '25c00000-0000-0000-0000-0000000000b1' and is_false_alarm is null;

  if v_null_gesamt <> 1 or v_null_b1 <> 1 then
    raise exception
      'SMOKE W2 FAIL % Zeile(n) mit is_false_alarm is null (davon % die eigene Zeile ...00b1) - erwartet genau die eigene',
      v_null_gesamt, v_null_b1;
  end if;
end
$$;

-- W2 Schritt 4: die ECHTE Migration erneut anwenden - keine Kopie, keine
-- Nachbildung. Der Pfad ist relativ zum Verzeichnis dieser Datei
-- (app/supabase/test/). Die NOTICE-Meldungen der Migration ("column ... already
-- exists, skipping" fuer 1b und "trigger ... does not exist, skipping" fuer den
-- zweiten `drop trigger if exists`) sind erwartet.
\ir ../migrations/0018_ap15b_incident_metrics.sql

-- W2 Schritt 5: Nachweis. Vier Aussagen in einem Fall:
--   * attnotnull ist wieder true (0018 Abschnitt 1e),
--   * atthasdef ist wieder true mit dem Ausdruck false (Abschnitt 1c),
--   * es gibt keine Zeile mehr mit is_false_alarm is null (Abschnitt 1d),
--   * die Zeile aus Schritt 2 traegt AUSDRUECKLICH den Wert false und ist nicht
--     nur "nicht mehr NULL" - der Unterschied waere bei einem Backfill auf true
--     fachlich gravierend.
-- Damit ist zugleich belegt, dass 0018 wiederholbar ist und dass der Backfill
-- trotz des aus dem Vorlauf vorhandenen Waechters durchlaeuft (0018:105-119: der
-- Waechter wird in 1a voruebergehend entfernt, weil `false is not distinct from
-- NULL` falsch ist und der Fruehausstieg deshalb nicht greift).
do $$
declare
  v_notnull boolean;
  v_hasdef boolean;
  v_default text;
  v_null_gesamt integer;
  v_wert boolean;
begin
  select
    a.attnotnull,
    a.atthasdef,
    (
      select pg_get_expr(d.adbin, d.adrelid)
      from pg_attrdef d
      where d.adrelid = a.attrelid and d.adnum = a.attnum
    )
  into v_notnull, v_hasdef, v_default
  from pg_attribute a
  where a.attrelid = 'public.incidents'::regclass
    and a.attname = 'is_false_alarm'
    and not a.attisdropped;

  if v_notnull is distinct from true or v_hasdef is distinct from true
     or v_default is distinct from 'false' then
    raise exception
      'SMOKE W2 FAIL nach dem erneuten Lauf von 0018: attnotnull=%, atthasdef=%, default=% - erwartet true/true/false',
      coalesce(v_notnull::text, 'NULL'), coalesce(v_hasdef::text, 'NULL'),
      coalesce(v_default, 'NULL');
  end if;

  select count(*) into v_null_gesamt
  from public.incidents where is_false_alarm is null;
  if v_null_gesamt <> 0 then
    raise exception
      'SMOKE W2 FAIL nach dem Backfill bleiben % Zeile(n) mit is_false_alarm is null', v_null_gesamt;
  end if;

  select is_false_alarm into v_wert
  from public.incidents where id = '25c00000-0000-0000-0000-0000000000b1';
  if v_wert is distinct from false then
    raise exception
      'SMOKE W2 FAIL die Zeile ...00b1 traegt is_false_alarm=% statt ausdruecklich false',
      coalesce(v_wert::text, 'NULL');
  end if;

  raise notice
    'SMOKE W2 OK F1-Regression: nach absichtlichem Vorzustand (nullable, kein Default, eine NULL-Zeile) fuehrt der ERNEUTE Lauf der echten Migration 0018 die Spalte wieder auf NOT NULL DEFAULT false, fuellt die NULL-Zeile ausdruecklich mit false und laeuft trotz des vorhandenen Waechters durch';
end
$$;

-- ---------------------------------------------------------------------
-- W3: Triggerbereich - Befund F2 auf Katalogebene.
--
-- Zwei voneinander unabhaengige Belege fuer dieselbe Aussage:
--   * der Definitionstext aus pg_get_triggerdef enthaelt
--     'BEFORE INSERT OR UPDATE',
--   * die Bitmaske pg_trigger.tgtype deckt INSERT (Bit 4) UND UPDATE (Bit 16)
--     ab, ist BEFORE (Bit 2) und zeilenweise (Bit 1). DELETE (Bit 8) ist
--     ausdruecklich NICHT abgedeckt - das Loeschen einer Zeile ist keine
--     Aenderung der Kennzeichnung.
-- Der Definitionstext allein waere ein schwacher Nachweis (er ist eine
-- Textsuche), die Bitmaske allein waere schwer lesbar. Zusammen sind sie
-- eindeutig.
-- ---------------------------------------------------------------------
do $$
declare
  v_def text;
  v_tgtype smallint;
begin
  select pg_get_triggerdef(t.oid), t.tgtype
  into v_def, v_tgtype
  from pg_trigger t
  where t.tgrelid = 'public.incidents'::regclass
    and t.tgname = 'trg_incident_guard_false_alarm'
    and not t.tgisinternal;

  if v_def is null then
    raise exception
      'SMOKE W3 FAIL der Trigger trg_incident_guard_false_alarm fehlt auf public.incidents';
  end if;
  if position('BEFORE INSERT OR UPDATE' in v_def) = 0 then
    raise exception
      'SMOKE W3 FAIL die Triggerdefinition enthaelt kein BEFORE INSERT OR UPDATE: %', v_def;
  end if;
  if (v_tgtype & 4) = 0 then
    raise exception
      'SMOKE W3 FAIL der Trigger deckt INSERT NICHT ab (tgtype=%) - genau das war Befund F2', v_tgtype;
  end if;
  if (v_tgtype & 16) = 0 then
    raise exception 'SMOKE W3 FAIL der Trigger deckt UPDATE nicht ab (tgtype=%)', v_tgtype;
  end if;
  if (v_tgtype & 2) = 0 or (v_tgtype & 1) = 0 then
    raise exception
      'SMOKE W3 FAIL der Trigger ist nicht BEFORE ... FOR EACH ROW (tgtype=%)', v_tgtype;
  end if;
  if (v_tgtype & 8) <> 0 then
    raise exception
      'SMOKE W3 FAIL der Trigger deckt zusaetzlich DELETE ab (tgtype=%)', v_tgtype;
  end if;

  raise notice
    'SMOKE W3 OK trg_incident_guard_false_alarm ist BEFORE INSERT OR UPDATE FOR EACH ROW auf public.incidents - INSERT ist ausdruecklich abgedeckt (tgtype=%), DELETE nicht',
    v_tgtype;
end
$$;

-- =====================================================================
-- Ab hier unter der Anwendungsrolle app_user mit aktiver RLS. Die Identitaet
-- wird in jedem Fall neu gesetzt, damit kein Fall vom vorhergehenden abhaengt.
-- =====================================================================
set role app_user;

-- ---------------------------------------------------------------------
-- W4: INSERT durch den Disponenten mit is_false_alarm = true ist ERLAUBT, und
-- die Zeile persistiert mit true.
--
-- Die zweite Haelfte ist die wichtigere: eine ausbleibende Ausnahme allein
-- wuerde auch dann eintreten, wenn der Waechter den Wert stillschweigend
-- verwirft.
-- ---------------------------------------------------------------------
do $$
declare
  v_wert boolean;
begin
  perform set_config('app.user_id', '25c00000-0000-0000-0000-000000000002', true);

  insert into public.incidents
    (id, customer_id, construction_stage_id, vzg_line_number, vzg_line_id, km_from,
     status, description, is_false_alarm)
  values
    ('25c00000-0000-0000-0000-0000000000b2',
     '25c00000-0000-0000-0000-0000000000a3',
     '25c00000-0000-0000-0000-0000000000a1', '1825',
     '25c00000-0000-0000-0000-0000000000a2', 25.200,
     'neu', 'AP15-b Fehlalarm - Anlage durch den Disponenten mit true', true);

  select is_false_alarm into v_wert
  from public.incidents where id = '25c00000-0000-0000-0000-0000000000b2';

  if v_wert is distinct from true then
    raise exception
      'SMOKE W4 FAIL die durch den Disponenten angelegte Zeile traegt is_false_alarm=% statt true',
      coalesce(v_wert::text, 'NULL');
  end if;

  raise notice
    'SMOKE W4 OK der Disponent darf einen Vorgang mit is_false_alarm = true anlegen, und der Wert persistiert als true';
end
$$;

-- ---------------------------------------------------------------------
-- W5: INSERT durch den ADMINISTRATOR mit is_false_alarm = true wird mit
-- SQLSTATE 42501 abgewiesen. DAS IST DER KERNNACHWEIS ZU F2 - vor der
-- Korrektur persistierte dieser INSERT, weil der Waechter nur `before update`
-- war.
--
-- Zwei Abgrenzungen, damit der Fall nicht mehr behauptet, als er zeigt:
--   * Der Administrator ist is_staff() und darf laut incidents_insert anlegen
--     (0001_init.sql:542-543). Die Ablehnung kann also NICHT aus der Policy
--     stammen.
--   * Zusaetzlich wird der Meldungstext geprueft. Er ist der eigene deutsche
--     Text des Waechters (0018:228-230) und damit unabhaengig von lc_messages -
--     anders als die englische RLS-Meldung. Erst damit ist ausgeschlossen, dass
--     ein anderer 42501-Weg den Fall gruen faerbt.
-- Der Waechter meldet ausdruecklich 42501 und keinen eigenen Code, weil
-- app/src/lib/incidents.ts darauf auf PG_INSUFFICIENT_PRIVILEGE abbildet
-- (0018:201-202).
-- ---------------------------------------------------------------------
do $$
declare
  v_state text;
  v_msg text;
  v_zeilen integer;
begin
  perform set_config('app.user_id', '25c00000-0000-0000-0000-000000000001', true);

  v_state := null;
  v_msg := null;
  begin
    insert into public.incidents
      (id, customer_id, construction_stage_id, vzg_line_number, vzg_line_id, km_from,
       status, description, is_false_alarm)
    values
      ('25c00000-0000-0000-0000-0000000000c1',
       '25c00000-0000-0000-0000-0000000000a3',
       '25c00000-0000-0000-0000-0000000000a1', '1825',
       '25c00000-0000-0000-0000-0000000000a2', 25.910,
       'neu', 'AP15-b Fehlalarm - unzulaessige Anlage durch den Administrator', true);
  exception
    when insufficient_privilege then
      v_state := sqlstate;
      v_msg := sqlerrm;
    when others then
      v_state := sqlstate;
      v_msg := sqlerrm;
  end;

  if v_state is distinct from '42501' then
    raise exception
      'SMOKE W5 FAIL SQLSTATE % statt 42501',
      coalesce(v_state, 'kein Fehler - der Administrator hat einen Vorgang MIT Fehlalarm-Kennzeichnung angelegt (Befund F2)');
  end if;
  if position('Fehlalarm-Kennzeichnung' in coalesce(v_msg, '')) = 0 then
    raise exception
      'SMOKE W5 FAIL 42501 stammt nicht vom Fehlalarm-Waechter, sondern von: %',
      coalesce(v_msg, 'ohne Meldung');
  end if;

  -- Die Gegenprobe laeuft im EIGENTUEMERKONTEXT. Unter RLS koennte eine 0 auch
  -- dann erscheinen, wenn die Zeile bestaende, aber fuer die pruefende
  -- Identitaet unsichtbar waere. Fuer den Administrator (is_staff()) waere das
  -- hier nicht so - fuer den Monteur in W12 aber sehr wohl, und beide Faelle
  -- zaehlen deshalb auf demselben, ungefilterten Weg.
  reset role;
  select count(*) into v_zeilen
  from public.incidents where id = '25c00000-0000-0000-0000-0000000000c1';
  set role app_user;
  if v_zeilen <> 0 then
    raise exception
      'SMOKE W5 FAIL der abgewiesene Vorgang ...00c1 besteht trotzdem (% Zeile(n))', v_zeilen;
  end if;

  raise notice
    'SMOKE W5 OK Kernnachweis F2: die Anlage MIT is_false_alarm = true wird dem Administrator mit SQLSTATE 42501 und der Meldung des Fehlalarm-Waechters verweigert, und es entsteht keine Zeile - obwohl incidents_insert ihm die Anlage erlaubt';
end
$$;

-- ---------------------------------------------------------------------
-- W6: KEINE REGRESSION BEI DER ANLAGE.
--
-- Ohne diesen Fall koennte die INSERT-Abdeckung aus W3/W5 die Vorgangsanlage
-- unbemerkt brechen - und das waere der schwerste denkbare Schaden dieser
-- Migration. Geprueft werden beide Anlagewege des Administrators:
--   * ohne Nennung der Spalte (der Weg von public.create_incident_ap12, dessen
--     `insert into public.incidents` is_false_alarm nicht nennt, 0018:177-184),
--   * mit ausdruecklich false.
-- Beide muessen erlaubt sein, und beide muessen false speichern.
-- ---------------------------------------------------------------------
do $$
declare
  v_ohne boolean;
  v_mit boolean;
begin
  perform set_config('app.user_id', '25c00000-0000-0000-0000-000000000001', true);

  -- Weg 1: Spalte nicht genannt, der Default false greift.
  insert into public.incidents
    (id, customer_id, construction_stage_id, vzg_line_number, vzg_line_id, km_from,
     status, description)
  values
    ('25c00000-0000-0000-0000-0000000000b3',
     '25c00000-0000-0000-0000-0000000000a3',
     '25c00000-0000-0000-0000-0000000000a1', '1825',
     '25c00000-0000-0000-0000-0000000000a2', 25.300,
     'neu', 'AP15-b Fehlalarm - Anlage durch den Administrator ohne die Spalte');

  -- Weg 2: Spalte ausdruecklich false.
  insert into public.incidents
    (id, customer_id, construction_stage_id, vzg_line_number, vzg_line_id, km_from,
     status, description, is_false_alarm)
  values
    ('25c00000-0000-0000-0000-0000000000b4',
     '25c00000-0000-0000-0000-0000000000a3',
     '25c00000-0000-0000-0000-0000000000a1', '1825',
     '25c00000-0000-0000-0000-0000000000a2', 25.400,
     'neu', 'AP15-b Fehlalarm - Anlage durch den Administrator mit ausdruecklich false', false);

  select is_false_alarm into v_ohne
  from public.incidents where id = '25c00000-0000-0000-0000-0000000000b3';
  select is_false_alarm into v_mit
  from public.incidents where id = '25c00000-0000-0000-0000-0000000000b4';

  if v_ohne is distinct from false or v_mit is distinct from false then
    raise exception
      'SMOKE W6 FAIL gespeicherte Werte: ohne Spalte=%, mit ausdruecklich false=% - erwartet je false',
      coalesce(v_ohne::text, 'NULL'), coalesce(v_mit::text, 'NULL');
  end if;

  raise notice
    'SMOKE W6 OK die Vorgangsanlage bricht NICHT: der Administrator darf ohne Nennung der Spalte und mit ausdruecklich false anlegen, gespeichert wird beide Male false';
end
$$;

-- ---------------------------------------------------------------------
-- W7: UPDATE durch den Disponenten, true -> false. Die Regel ist keine
-- Einbahnstrasse: der Disponent darf die Kennzeichnung auch zuruecknehmen.
-- Geprueft wird auf der in W4 angelegten Zeile ...00b2, die dort nachweislich
-- true traegt.
-- ---------------------------------------------------------------------
do $$
declare
  v_vorher boolean;
  v_nachher boolean;
begin
  perform set_config('app.user_id', '25c00000-0000-0000-0000-000000000002', true);

  select is_false_alarm into v_vorher
  from public.incidents where id = '25c00000-0000-0000-0000-0000000000b2';
  if v_vorher is distinct from true then
    raise exception
      'SMOKE W7 FAIL Ausgangswert der Zeile ...00b2 ist % statt true - der Fall haette keine Grundlage',
      coalesce(v_vorher::text, 'NULL');
  end if;

  update public.incidents
     set is_false_alarm = false
   where id = '25c00000-0000-0000-0000-0000000000b2';

  select is_false_alarm into v_nachher
  from public.incidents where id = '25c00000-0000-0000-0000-0000000000b2';
  if v_nachher is distinct from false then
    raise exception
      'SMOKE W7 FAIL nach dem UPDATE traegt die Zeile is_false_alarm=% statt false',
      coalesce(v_nachher::text, 'NULL');
  end if;

  raise notice
    'SMOKE W7 OK der Disponent darf die Kennzeichnung per UPDATE von true auf false zuruecknehmen';
end
$$;

-- ---------------------------------------------------------------------
-- W8: UPDATE durch den Administrator, Aenderung der Kennzeichnung, wird mit
-- 42501 abgewiesen - und die Zeile bleibt unveraendert. Die Zeile ...00b5 ist
-- eine Fixture-Basiszeile mit false; der Versuch setzt true.
--
-- Auch hier kann die Ablehnung nicht aus der Policy stammen: incidents_update
-- erlaubt is_staff() das UPDATE der Zeile (0001_init.sql:544-546). Der
-- Meldungstext wird deshalb wie in W5 mitgeprueft.
-- ---------------------------------------------------------------------
do $$
declare
  v_state text;
  v_msg text;
  v_nachher boolean;
begin
  perform set_config('app.user_id', '25c00000-0000-0000-0000-000000000001', true);

  v_state := null;
  v_msg := null;
  begin
    update public.incidents
       set is_false_alarm = true
     where id = '25c00000-0000-0000-0000-0000000000b5';
  exception
    when insufficient_privilege then
      v_state := sqlstate;
      v_msg := sqlerrm;
    when others then
      v_state := sqlstate;
      v_msg := sqlerrm;
  end;

  if v_state is distinct from '42501' then
    raise exception
      'SMOKE W8 FAIL SQLSTATE % statt 42501',
      coalesce(v_state, 'kein Fehler - der Administrator hat die Fehlalarm-Kennzeichnung geaendert');
  end if;
  if position('Fehlalarm-Kennzeichnung' in coalesce(v_msg, '')) = 0 then
    raise exception
      'SMOKE W8 FAIL 42501 stammt nicht vom Fehlalarm-Waechter, sondern von: %',
      coalesce(v_msg, 'ohne Meldung');
  end if;

  select is_false_alarm into v_nachher
  from public.incidents where id = '25c00000-0000-0000-0000-0000000000b5';
  if v_nachher is distinct from false then
    raise exception
      'SMOKE W8 FAIL die Zeile ...00b5 traegt nach dem abgewiesenen UPDATE is_false_alarm=% statt unveraendert false',
      coalesce(v_nachher::text, 'NULL');
  end if;

  raise notice
    'SMOKE W8 OK die Aenderung der Kennzeichnung wird dem Administrator mit SQLSTATE 42501 verweigert, obwohl incidents_update ihm die Zeile oeffnet - der gespeicherte Wert bleibt false';
end
$$;

-- ---------------------------------------------------------------------
-- W9: UPDATE OHNE Beruehrung der Spalte ist erlaubt - der Fruehausstieg des
-- Waechters greift (0018:222-224, `is not distinct from`). Der Administrator
-- aendert `description` auf derselben Zeile ...00b5.
--
-- Dieser Fall ist die Gegenprobe zu W8: ohne ihn koennte der Waechter jedes
-- UPDATE eines Administrators sperren, und W8 waere trotzdem gruen.
-- ---------------------------------------------------------------------
do $$
declare
  v_text text;
  v_flag boolean;
begin
  perform set_config('app.user_id', '25c00000-0000-0000-0000-000000000001', true);

  update public.incidents
     set description = 'AP15-b Fehlalarm - Beschreibung durch den Administrator geaendert'
   where id = '25c00000-0000-0000-0000-0000000000b5';

  select description, is_false_alarm into v_text, v_flag
  from public.incidents where id = '25c00000-0000-0000-0000-0000000000b5';

  if v_text is distinct from 'AP15-b Fehlalarm - Beschreibung durch den Administrator geaendert' then
    raise exception
      'SMOKE W9 FAIL die Beschreibung wurde nicht uebernommen (%)', coalesce(v_text, 'NULL');
  end if;
  if v_flag is distinct from false then
    raise exception
      'SMOKE W9 FAIL is_false_alarm ist nach dem erlaubten UPDATE % statt unveraendert false',
      coalesce(v_flag::text, 'NULL');
  end if;

  raise notice
    'SMOKE W9 OK ein UPDATE des Administrators, das is_false_alarm nicht beruehrt, laeuft durch - der Waechter wirkt spaltenscharf und sperrt nicht jedes UPDATE';
end
$$;

-- ---------------------------------------------------------------------
-- W10: UPDATE mit GLEICHEM Wert ist erlaubt. Der Administrator setzt
-- is_false_alarm ausdruecklich auf den bereits gespeicherten Wert false.
--
-- Belegt wird damit der Fruehausstieg `new.is_false_alarm is not distinct from
-- old.is_false_alarm` (0018:222) fuer den Fall, dass die Spalte SEHR WOHL in
-- der SET-Liste steht. Das ist der praktische Regelfall jeder
-- Formularspeicherung, die alle Felder mitsendet: ohne diesen Zweig wuerde
-- jedes Speichern eines Administrators an einer unveraenderten Kennzeichnung
-- scheitern.
-- ---------------------------------------------------------------------
do $$
declare
  v_vorher boolean;
  v_nachher boolean;
begin
  perform set_config('app.user_id', '25c00000-0000-0000-0000-000000000001', true);

  select is_false_alarm into v_vorher
  from public.incidents where id = '25c00000-0000-0000-0000-0000000000b5';
  if v_vorher is distinct from false then
    raise exception
      'SMOKE W10 FAIL Ausgangswert der Zeile ...00b5 ist % statt false',
      coalesce(v_vorher::text, 'NULL');
  end if;

  update public.incidents
     set is_false_alarm = false
   where id = '25c00000-0000-0000-0000-0000000000b5';

  select is_false_alarm into v_nachher
  from public.incidents where id = '25c00000-0000-0000-0000-0000000000b5';
  if v_nachher is distinct from false then
    raise exception
      'SMOKE W10 FAIL is_false_alarm ist % statt false', coalesce(v_nachher::text, 'NULL');
  end if;

  raise notice
    'SMOKE W10 OK ein UPDATE des Administrators, das is_false_alarm auf den BEREITS gespeicherten Wert setzt, laeuft durch - Formularspeicherungen mit vollstaendiger SET-Liste brechen nicht';
end
$$;

-- ---------------------------------------------------------------------
-- W11: DER ZUGEWIESENE MONTEUR - spaltenscharf, nicht zeilenscharf.
--
-- Der Monteur ...0003 ist aktiv an ...00b6 zugewiesen und darf die Zeile laut
-- incidents_update aendern (0001_init.sql:544-546 ueber
-- is_assigned_to_incident(), 0001_init.sql:67-76). Zwei Aenderungen an
-- DERSELBEN Zeile durch DIESELBE Identitaet:
--   * `description` geht durch. public.tg_incident_guard laesst das fuer einen
--     Monteur ausdruecklich zu - es ist weder ein gesperrter Status noch ein
--     Abschlussfeld noch ein Stammfeld (0001_init.sql:394-414).
--   * `is_false_alarm` wird mit 42501 abgewiesen.
-- Genau dieses Paar belegt, dass der Waechter auf die SPALTE wirkt und nicht
-- auf die Zeile. Waere er zeilenscharf, muesste die Beschreibungsaenderung
-- ebenfalls scheitern.
-- ---------------------------------------------------------------------
do $$
declare
  v_state text;
  v_msg text;
  v_text text;
  v_flag boolean;
begin
  perform set_config('app.user_id', '25c00000-0000-0000-0000-000000000003', true);

  -- Teil 1: die erlaubte Aenderung.
  update public.incidents
     set description = 'AP15-b Fehlalarm - Beschreibung durch den zugewiesenen Monteur geaendert'
   where id = '25c00000-0000-0000-0000-0000000000b6';

  select description into v_text
  from public.incidents where id = '25c00000-0000-0000-0000-0000000000b6';
  if v_text is distinct from 'AP15-b Fehlalarm - Beschreibung durch den zugewiesenen Monteur geaendert' then
    raise exception
      'SMOKE W11 FAIL der zugewiesene Monteur konnte die Beschreibung nicht aendern (%) - der Fall haette keine Grundlage',
      coalesce(v_text, 'NULL');
  end if;

  -- Teil 2: die verweigerte Aenderung derselben Zeile.
  v_state := null;
  v_msg := null;
  begin
    update public.incidents
       set is_false_alarm = true
     where id = '25c00000-0000-0000-0000-0000000000b6';
  exception
    when insufficient_privilege then
      v_state := sqlstate;
      v_msg := sqlerrm;
    when others then
      v_state := sqlstate;
      v_msg := sqlerrm;
  end;

  if v_state is distinct from '42501' then
    raise exception
      'SMOKE W11 FAIL SQLSTATE % statt 42501',
      coalesce(v_state, 'kein Fehler - der zugewiesene Monteur hat die Fehlalarm-Kennzeichnung geaendert');
  end if;
  if position('Fehlalarm-Kennzeichnung' in coalesce(v_msg, '')) = 0 then
    raise exception
      'SMOKE W11 FAIL 42501 stammt nicht vom Fehlalarm-Waechter, sondern von: %',
      coalesce(v_msg, 'ohne Meldung');
  end if;

  select is_false_alarm into v_flag
  from public.incidents where id = '25c00000-0000-0000-0000-0000000000b6';
  if v_flag is distinct from false then
    raise exception
      'SMOKE W11 FAIL is_false_alarm ist nach dem abgewiesenen UPDATE % statt unveraendert false',
      coalesce(v_flag::text, 'NULL');
  end if;

  raise notice
    'SMOKE W11 OK der zugewiesene Monteur darf die Beschreibung derselben Zeile aendern, die Fehlalarm-Kennzeichnung dagegen nicht (42501 vom Waechter) - der Schutz wirkt spaltenscharf und nicht zeilenscharf';
end
$$;

-- ---------------------------------------------------------------------
-- W12: MONTEUR UND ANLAGE - ausdruecklich ehrlich beschriftet.
--
-- Ein `insert into public.incidents` als Monteur wird abgewiesen. DIESE
-- ABWEISUNG STAMMT AUS DER POLICY incidents_insert, die das INSERT
-- ausschliesslich public.is_staff() erlaubt (0001_init.sql:542-543), und NICHT
-- vom Fehlalarm-Waechter. Der Fall belegt also die Erreichbarkeit des
-- Anlagewegs fuer einen Monteur - naemlich keine - und nichts ueber den
-- Waechter.
--
-- Damit diese Beschriftung nachweisbar richtig ist, nennt der INSERT
-- is_false_alarm ABSICHTLICH NICHT: der Default false greift, der INSERT-Zweig
-- des Waechters steigt bei `is distinct from true` sofort aus (0018:217-219)
-- und kann als Quelle des Fehlers ausgeschlossen werden. Beide Wege melden
-- dieselbe Codeklasse 42501; die Unterscheidung ueber den Meldungstext waere
-- bei der RLS-Meldung von lc_messages abhaengig, deshalb wird sie hier NICHT
-- als tragender Beleg benutzt, sondern nur als Gegenprobe, dass der Text die
-- Meldung des Waechters gerade NICHT enthaelt.
-- ---------------------------------------------------------------------
do $$
declare
  v_state text;
  v_msg text;
  v_zeilen integer;
begin
  perform set_config('app.user_id', '25c00000-0000-0000-0000-000000000003', true);

  v_state := null;
  v_msg := null;
  begin
    insert into public.incidents
      (id, customer_id, construction_stage_id, vzg_line_number, vzg_line_id, km_from,
       status, description)
    values
      ('25c00000-0000-0000-0000-0000000000c2',
       '25c00000-0000-0000-0000-0000000000a3',
       '25c00000-0000-0000-0000-0000000000a1', '1825',
       '25c00000-0000-0000-0000-0000000000a2', 25.920,
       'neu', 'AP15-b Fehlalarm - unzulaessige Anlage durch den Monteur');
  exception
    when insufficient_privilege then
      v_state := sqlstate;
      v_msg := sqlerrm;
    when others then
      v_state := sqlstate;
      v_msg := sqlerrm;
  end;

  if v_state is distinct from '42501' then
    raise exception
      'SMOKE W12 FAIL SQLSTATE % statt 42501',
      coalesce(v_state, 'kein Fehler - ein Monteur hat einen Vorgang angelegt');
  end if;
  if position('Fehlalarm-Kennzeichnung' in coalesce(v_msg, '')) <> 0 then
    raise exception
      'SMOKE W12 FAIL die Abweisung stammt vom Fehlalarm-Waechter, obwohl der INSERT die Spalte nicht nennt: %',
      v_msg;
  end if;

  -- Zwingend im EIGENTUEMERKONTEXT gezaehlt: der Monteur sieht ueber
  -- incidents_select ausschliesslich Zeilen, denen er aktiv zugewiesen ist
  -- (0001_init.sql:540-541). Eine Zaehlung unter seiner Identitaet waere 0, ob
  -- die Zeile besteht oder nicht - sie waere also kein Nachweis.
  reset role;
  select count(*) into v_zeilen
  from public.incidents where id = '25c00000-0000-0000-0000-0000000000c2';
  set role app_user;
  if v_zeilen <> 0 then
    raise exception
      'SMOKE W12 FAIL der abgewiesene Vorgang ...00c2 besteht trotzdem (% Zeile(n))', v_zeilen;
  end if;

  raise notice
    'SMOKE W12 OK ein Monteur kann ueberhaupt keinen Vorgang anlegen (42501) - diese Abweisung stammt AUSDRUECKLICH aus der Policy incidents_insert (nur is_staff(), 0001_init.sql:542-543) und NICHT vom Fehlalarm-Waechter, dessen INSERT-Zweig hier gar nicht greift';
end
$$;

-- ---------------------------------------------------------------------
-- W13: die View public.incident_list_view.
--
-- Geprueft wird die VOLLSTAENDIGE Spaltenliste in Katalogreihenfolge, nicht nur
-- die Zahl 33. Grund: `create or replace view` verlangt fuer alle bereits
-- vorhandenen Spalten dieselbe Reihenfolge, neue Spalten duerfen nur am ENDE
-- stehen (0018:245-247). Eine reine Zaehlung wuerde eine verschobene Spalte
-- nicht bemerken, und genau eine solche Verschiebung wuerde jeden Leser der
-- View - auch app/src/lib/incident-list.ts - lautlos auf die falsche Spalte
-- greifen lassen.
--
-- Zusaetzlich: reloptions enthaelt security_invoker=true. Das ist keine
-- Formsache, sondern die Grundlage der Zeilensichtbarkeit - ohne diese Option
-- liefe die View mit den Rechten ihres Eigentuemers und wuerde die RLS der
-- Basistabelle umgehen.
-- ---------------------------------------------------------------------
do $$
declare
  v_erwartet text[] := array[
    'id', 'incident_no', 'status', 'priority', 'customer_id', 'customer_name',
    'construction_stage_id', 'stage_code', 'stage_name', 'vzg_line_id',
    'vzg_line_number', 'vzg_line_ref', 'on_call_number_id', 'on_call_number',
    'on_call_label', 'operating_point', 'km_from', 'km_to', 'created_at',
    'created_by', 'updated_at', 'created_date_local', 'image_count',
    'cable_arts', 'monteur_names', 'monteur_ids', 'no_monteur', 'no_images',
    'no_cable', 'historic_vzg', 'search_text', 'has_open_task',
    'is_false_alarm'
  ];
  v_ist text[];
  v_opts text[];
  -- Die Laufvariable der Vergleichsschleife wird von `for i in 1..33` selbst
  -- angelegt und deshalb hier ausdruecklich NICHT deklariert (Muster aus
  -- 24_ap15_dashboard_metrics.sql).
begin
  select array_agg(a.attname::text order by a.attnum)
  into v_ist
  from pg_attribute a
  where a.attrelid = 'public.incident_list_view'::regclass
    and a.attnum > 0
    and not a.attisdropped;

  if coalesce(array_length(v_ist, 1), 0) <> 33 then
    raise exception
      'SMOKE W13 FAIL public.incident_list_view hat % Spalten statt 33',
      coalesce(array_length(v_ist, 1), 0);
  end if;

  -- Positionen 1 bis 32 unveraendert, Position 33 neu.
  for i in 1..33 loop
    if v_ist[i] is distinct from v_erwartet[i] then
      raise exception
        'SMOKE W13 FAIL Spalte an Position % ist % statt % - die Spaltenreihenfolge der View hat sich verschoben',
        i, coalesce(v_ist[i], 'NULL'), v_erwartet[i];
    end if;
  end loop;

  -- Die drei tragenden Positionen noch einmal ausdruecklich benannt.
  if v_ist[31] <> 'search_text' or v_ist[32] <> 'has_open_task'
     or v_ist[33] <> 'is_false_alarm' then
    raise exception
      'SMOKE W13 FAIL Positionen 31/32/33 sind %/%/% statt search_text/has_open_task/is_false_alarm',
      v_ist[31], v_ist[32], v_ist[33];
  end if;

  select c.reloptions into v_opts
  from pg_class c
  where c.oid = 'public.incident_list_view'::regclass;

  if not ('security_invoker=true' = any (coalesce(v_opts, array[]::text[]))) then
    raise exception
      'SMOKE W13 FAIL reloptions der View enthaelt kein security_invoker=true (%) - die View wuerde die RLS der Basistabelle umgehen',
      array_to_string(coalesce(v_opts, array[]::text[]), ', ');
  end if;

  raise notice
    'SMOKE W13 OK public.incident_list_view traegt genau 33 Spalten, die Positionen 1 bis 32 sind unveraendert (31 search_text, 32 has_open_task), is_false_alarm steht als LETZTE Spalte, und die View ist security_invoker=true';
end
$$;

-- ---------------------------------------------------------------------
-- W14: keine Nebenwirkung auf Schemaobjekte.
--
-- Die Zahl der Funktionen in schema public ist dieselbe wie beim Beginn dieser
-- Datei. Das deckt zwei Aussagen ab: dieser Smoke erzeugt keine Funktion, und
-- der erneute Lauf von 0018 in W2 hat ausschliesslich `create or replace` auf
-- eine BEREITS vorhandene Funktion ausgefuehrt - waere
-- public.tg_incident_guard_false_alarm dort neu entstanden, waere die Zahl um
-- eins hoeher und der Zielzustand aus W1 waere nie erreicht gewesen.
--
-- Der Ausgangswert steht sitzungsweit und AUSSERHALB des Transaktionsrahmens
-- (set_config(..., false) vor `begin;`), damit er das `rollback;` ueberlebt und
-- in W-ENDE noch einmal verwendet werden kann.
-- ---------------------------------------------------------------------
do $$
declare
  v_start integer;
  v_jetzt integer;
begin
  v_start := nullif(current_setting('kb25c.proc_count_start', true), '')::integer;
  if v_start is null then
    raise exception
      'SMOKE W14 FAIL der Ausgangsstand kb25c.proc_count_start fehlt - ohne ihn ist "diese Datei erzeugt keine Funktion" nicht messbar';
  end if;

  select count(*) into v_jetzt
  from pg_proc p
  join pg_namespace ns on ns.oid = p.pronamespace
  where ns.nspname = 'public';

  if v_jetzt <> v_start then
    raise exception
      'SMOKE W14 FAIL die Zahl der Funktionen in schema public hat sich um % veraendert (vorher %, jetzt %)',
      v_jetzt - v_start, v_start, v_jetzt;
  end if;

  raise notice
    'SMOKE W14 OK die Zahl der Funktionen in schema public (%) ist unveraendert - dieser Smoke erzeugt kein Schemaobjekt, und der erneute Lauf von 0018 hat nur ersetzt, nicht angelegt',
    v_jetzt;
end
$$;

-- =====================================================================
-- Ende der Wirkungsphase. Der Rollback nimmt ALLES zurueck: die sechs
-- tatsaechlich entstandenen Vorgaenge (...00b1 bis ...00b6; ...00c1 und ...00c2
-- sind nie entstanden), ihre Zuweisung, die daraus abgeleiteten Aufgaben, die
-- Statuschronik, die Auditsaetze, Kunde, Bauabschnitt und VzG-Strecke, die drei
-- Profile und Konten - UND die DDL, also den in W2 hergestellten Vorzustand der
-- Spalte sowie die vom Migrationslauf neu erzeugte Triggerinstanz. Ein
-- Aufraeumen per DELETE waere wegen trg_incident_tasks_no_delete
-- (0011_ap13_tasks_bulk.sql:113-123) nicht moeglich; die Begruendung steht im
-- Kopf dieser Datei.
-- =====================================================================
reset role;
select set_config('app.user_id', '', false);

rollback;

-- ---------------------------------------------------------------------
-- W-ENDE: Gegenprobe NACH dem Rollback, im Eigentuemerkontext (RLS darf das
-- Ergebnis nicht filtern - sonst waere eine 0 auch dann zu sehen, wenn Zeilen
-- zurueckblieben).
--
-- Vier Aussagen:
--   * keine Zeile mit dem Praefix 25c00000- in public.incidents,
--     public.profiles, public.auth_accounts, public.customers,
--     public.construction_stages, public.vzg_lines und
--     public.incident_assignments. Die Zuweisung traegt eine von der Datenbank
--     vergebene id und wird deshalb ueber incident_id bzw. monteur_id gezaehlt.
--     Die uebrigen abgeleiteten Zeilen (Aufgaben, Statuschronik, Audit) haengen
--     ueber Fremdschluessel an den hier gezaehlten Zeilen; mit deren
--     Verschwinden sind auch sie fort.
--   * die Zahl der Funktionen in schema public ist unveraendert.
--   * die Spalte is_false_alarm ist wieder NOT NULL DEFAULT false - der in W2
--     absichtlich hergestellte Vorzustand hat die Datei NICHT ueberdauert. Das
--     ist die wichtigste Aussage dieses Abschnitts, weil die
--     Node-Integrationstests danach in derselben Datenbank laufen.
--   * der Waechter besteht und ist wieder BEFORE INSERT OR UPDATE.
-- ---------------------------------------------------------------------
do $$
declare
  v_rest integer;
  v_zuweisungen integer;
  v_start integer;
  v_jetzt integer;
  v_notnull boolean;
  v_hasdef boolean;
  v_default text;
  v_def text;
  v_tgtype smallint;
begin
  select
    (select count(*) from public.incidents where id::text like '25c00000-%')
    + (select count(*) from public.profiles where id::text like '25c00000-%')
    + (select count(*) from public.auth_accounts where id::text like '25c00000-%')
    + (select count(*) from public.customers where id::text like '25c00000-%')
    + (select count(*) from public.construction_stages where id::text like '25c00000-%')
    + (select count(*) from public.vzg_lines where id::text like '25c00000-%')
  into v_rest;

  select count(*) into v_zuweisungen
  from public.incident_assignments
  where incident_id::text like '25c00000-%'
     or monteur_id::text like '25c00000-%';

  if v_rest <> 0 or v_zuweisungen <> 0 then
    raise exception
      'SMOKE W-ENDE FAIL % Stamm-/Vorgangszeile(n) und % Zuweisung(en) mit dem Praefix 25c00000- bleiben nach dem Rollback zurueck',
      v_rest, v_zuweisungen;
  end if;

  v_start := nullif(current_setting('kb25c.proc_count_start', true), '')::integer;
  select count(*) into v_jetzt
  from pg_proc p
  join pg_namespace ns on ns.oid = p.pronamespace
  where ns.nspname = 'public';
  if v_start is null or v_jetzt <> v_start then
    raise exception
      'SMOKE W-ENDE FAIL Funktionszahl in schema public: jetzt %, beim Laufbeginn %',
      v_jetzt, coalesce(v_start::text, 'unbekannt');
  end if;

  select
    a.attnotnull,
    a.atthasdef,
    (
      select pg_get_expr(d.adbin, d.adrelid)
      from pg_attrdef d
      where d.adrelid = a.attrelid and d.adnum = a.attnum
    )
  into v_notnull, v_hasdef, v_default
  from pg_attribute a
  where a.attrelid = 'public.incidents'::regclass
    and a.attname = 'is_false_alarm'
    and not a.attisdropped;

  if v_notnull is distinct from true or v_hasdef is distinct from true
     or v_default is distinct from 'false' then
    raise exception
      'SMOKE W-ENDE FAIL der Spaltenzustand ist nach dem Rollback attnotnull=%, atthasdef=%, default=% statt true/true/false - der Vorzustand aus W2 hat die Datei ueberdauert',
      coalesce(v_notnull::text, 'NULL'), coalesce(v_hasdef::text, 'NULL'),
      coalesce(v_default, 'NULL');
  end if;

  select pg_get_triggerdef(t.oid), t.tgtype
  into v_def, v_tgtype
  from pg_trigger t
  where t.tgrelid = 'public.incidents'::regclass
    and t.tgname = 'trg_incident_guard_false_alarm'
    and not t.tgisinternal;

  if v_def is null then
    raise exception
      'SMOKE W-ENDE FAIL der Trigger trg_incident_guard_false_alarm fehlt nach dem Rollback';
  end if;
  if position('BEFORE INSERT OR UPDATE' in v_def) = 0
     or (v_tgtype & 4) = 0 or (v_tgtype & 16) = 0 then
    raise exception
      'SMOKE W-ENDE FAIL der Trigger ist nach dem Rollback nicht BEFORE INSERT OR UPDATE (tgtype=%): %',
      v_tgtype, v_def;
  end if;

  raise notice
    'SMOKE W-ENDE OK AP15-b Fehlalarm W1-W14 belegt (Zielzustand der Spalte, F1-Regression durch erneuten Lauf der echten Migration 0018, INSERT-Abdeckung des Waechters als Kernnachweis zu F2, keine Regression der Vorgangsanlage, spaltenscharfe Wirkung auch beim zugewiesenen Monteur, View mit 33 Spalten und security_invoker, kein neues Schemaobjekt); die Wirkungsphase wurde per rollback vollstaendig zurueckgenommen, es bleibt keine Zeile mit dem Praefix 25c00000-, die Spalte ist wieder NOT NULL DEFAULT false und der Waechter ist BEFORE INSERT OR UPDATE';
end
$$;

-- Der Ausgangsstand fuer W14 und W-ENDE ist verbraucht und wird zurueckgesetzt,
-- damit die Sitzung nichts von dieser Datei behaelt.
select set_config('kb25c.proc_count_start', '', false);
