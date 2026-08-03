\set ON_ERROR_STOP on

-- =====================================================================
-- AP15-1 - Statuskennzahlen des Dashboards unter der Anwendungsrolle
-- app_user mit AKTIVER RLS.
--
-- Erwartet die vollstaendige Kette einschliesslich 0012 bis 0017 sowie die
-- Smokes 19_ap14b_platform.sql, 19a_ap14b_grant_reset.sql, 20_ap14b_data.sql,
-- 21_ap14b_masterdata_inventory.sql, 22_ap14b_images.sql und
-- 23_ap14b_admin_users.sql. Diese Datei ist der neue letzte Eintrag der Kette.
--
-- GEGENSTAND: die fuenf Kennzahlen, die getIncidentStatusMetrics()
-- (app/src/lib/incident-metrics.ts) fuer das Dashboard erhebt - offen,
-- technisch_abgeschlossen, warten_auf_db, warten_auf_material und
-- monteure_im_einsatz. Alle fuenf entstehen in EINER Abfrage ueber
-- public.incident_list_view; diese Datei belegt die RLS-SEITE dieser Abfrage:
-- wer welche Zeilen und damit welche Zaehlwerte sieht.
--
-- Verbindliche Eigenschaften dieses Smokes:
--   * Er fuehrt KEIN `grant` und KEIN `revoke` aus, aendert keine Policy,
--     schaltet keinen Trigger ab und erzeugt KEIN Schemaobjekt - keine
--     Funktion, keine View, keine Tabelle, auch keine temporaere. Fall K9
--     prueft das nicht nur fuer die Kennzahlhelfer, sondern zaehlt die
--     Funktionen in schema public vor und nach diesem Lauf.
--   * Die Identitaet wird immer mit
--     set_config('app.user_id', ..., true) gesetzt - genau so, wie
--     withUserTransaction() es tut (app/src/lib/db/index.ts).
--   * Geprueft wird unter `set role app_user` mit aktiver RLS. Der
--     Eigentuemerkontext dient ausschliesslich den Fixtures und der Zaehlung
--     nach dem Rollback.
--   * NUR SYNTHETISCHE WERTE. Keine echte Person, kein echtes Passwort, kein
--     echter Hash, keine Standortdaten. Alle fuenf Konten tragen den
--     projektweit etablierten Marker '!MIGRATED-ACCOUNT-REQUIRES-RESET!'
--     (0012:205, in 19_ap14b_platform.sql und 20_ap14b_data.sql ausdruecklich
--     toleriert). Ein '$argon2id$'-artiger Wert wuerde die Bootstrap-Faelle der
--     Node-Integrationstests mitzaehlen und ist hier NICHT zulaessig.
--
-- WARUM DIE GANZE WIRKUNGSPHASE IN EINER TRANSAKTION MIT ROLLBACK LAEUFT:
--   Die fuenf Kennzahlen zaehlen ABSOLUT ueber die gesamte
--   public.incident_list_view und nicht relativ ueber eigene Kennungen. In
--   derselben Datenbank stehen zu diesem Zeitpunkt die Fixtures der Smokes
--   15-23; ein Zaehlwert ist deshalb nur als DIFFERENZ vor/nach aussagekraeftig
--   (Administrator und Disponent) beziehungsweise dort absolut, wo die
--   Ausgangslage nachweislich 0 ist (die drei neuen Monteure). Genauso wichtig
--   ist die Rueckseite: die acht hier angelegten Vorgaenge duerfen die
--   Datenbank NICHT ueberdauern, weil die Node-Integrationstests danach in
--   derselben Datenbank laufen und ihre eigenen Zaehlungen fuehren.
--
--   Ein Aufraeumen per DELETE ist dafuer UNMOEGLICH - und das ist ein
--   gelesener Befund, keine Bequemlichkeit: die Loeschsperre
--   trg_incident_tasks_no_delete (0011:113-123) ist eine unbedingte
--   BEFORE-DELETE-Regel, sie greift auch im Eigentuemerkontext und auch bei der
--   Kaskade aus public.incidents (0011:28). Ein `delete from public.incidents`
--   waere deshalb nur nach einer Aufweichung dieser Sperre moeglich, und die
--   ist ausgeschlossen. 20_ap14b_data.sql:28-43 hat denselben Sachverhalt
--   identisch entschieden und verzichtet auf das Aufraeumen; hier ist der
--   Verzicht keine Option, weil die Kennzahlen absolut zaehlen. Bleibt genau
--   ein Weg: EIN einziger expliziter Transaktionsrahmen um die gesamte
--   Wirkungsphase - Fixtures eingeschlossen - und ein `rollback;` am Ende.
--   Nach dem Rollback bleibt keine Zeile mit dem Praefix 24c00000- zurueck;
--   K-ENDE zaehlt das nach.
--
-- FUEHREND FUER DIE TERMINALSTATUSMENGE IST DIE ANWENDUNG, NICHT DIESE DATEI:
--   Die Menge {abgeschlossen, storniert, fehlalarm} steht hier zwangslaeufig
--   als Literal, weil eine SQL-Datei die TypeScript-Konstante nicht lesen kann.
--   Sie wird deshalb GENAU EINMAL je do-Block in eine Variable geschrieben.
--   Massgeblich bleibt ausschliesslich TERMINAL_STATUS in
--   app/src/lib/status.ts:176-180. Dass Anwendungsliste und Datenbankergebnis
--   uebereinstimmen, wird NICHT hier belegt, sondern im Integrationstest
--   app/test/integration/ap15-dashboard-metrics.int.mjs, der den echten
--   Anwendungscode gegen dieselbe Datenbank laufen laesst. Diese Datei belegt
--   die RLS-Seite.
--
-- Meldungskennung: K (K1-K10, Fixture-Gegenprobe K-FIXTURES, Abschluss
-- K-ENDE). Die uebrigen Buchstaben sind vergeben: 19 nutzt P, 20 nutzt D/R,
-- 21 nutzt M/N, 22 nutzt B/G, 23 nutzt U.
-- UUID-Praefix: 24c00000-. Er kommt in keiner anderen Test- oder
-- Migrationsdatei vor.
-- =====================================================================

reset role;
select set_config('app.user_id', '', false);

-- ---------------------------------------------------------------------
-- Ausgangsstand der Funktionen in schema public, SITZUNGSWEIT und AUSSERHALB
-- des Transaktionsrahmens festgehalten (is_local = false und vor `begin;`,
-- damit der Wert das `rollback;` ueberlebt).
--
-- Er dient allein dem Fall K9: dieser Smoke soll nachweislich keine Funktion
-- erzeugen. Eine Behauptung im Kommentar waere kein Nachweis; ein Vergleich der
-- Zaehlung vor und nach dem Lauf ist einer. Ein benutzerdefinierter
-- Konfigurationsparameter ist KEIN Schemaobjekt: er lebt in dieser
-- psql-Sitzung, wird am Dateiende zurueckgesetzt und hinterlaesst nichts.
-- ---------------------------------------------------------------------
select set_config(
  'kb24c.proc_count_start',
  (
    select count(*)::text
    from pg_proc p
    join pg_namespace ns on ns.oid = p.pronamespace
    where ns.nspname = 'public'
  ),
  false);

-- =====================================================================
-- Beginn der Wirkungsphase. ALLES bis zum `rollback;` weiter unten gehoert
-- dazu, einschliesslich der Fixtures.
-- =====================================================================
begin;

-- ---------------------------------------------------------------------
-- Fixtures im Eigentuemerkontext (RLS gilt fuer den Eigentuemer nicht; das ist
-- genau der Grund, weshalb alle Messungen weiter unten unter
-- `set role app_user` laufen).
--
-- Fuenf Identitaeten:
--   ...0001 Administrator A - Staffsicht ueber is_staff()
--   ...0002 Disponent D     - dieselbe Staffsicht, zweiter Weg
--   ...0003 Monteur M1      - aktiv zugewiesen an V-A, V-B, V-F, V-G, V-H
--   ...0004 Monteur M2      - aktiv zugewiesen an V-B und V-C, INAKTIV an V-E
--   ...0005 Monteur M3      - ohne jede Zuweisung (Fremdsicht, Zaehlleck)
--
-- Jedes Profil braucht ein Auth-Konto, weil 0012 den Fremdschluessel
-- public.profiles.id auf public.auth_accounts umgehaengt hat.
-- ---------------------------------------------------------------------
insert into public.auth_accounts (id, email, password_hash, must_change_password, is_disabled)
values
  ('24c00000-0000-0000-0000-000000000001', 'k24.admin@beispiel.invalid', '!MIGRATED-ACCOUNT-REQUIRES-RESET!', false, false),
  ('24c00000-0000-0000-0000-000000000002', 'k24.dispo@beispiel.invalid', '!MIGRATED-ACCOUNT-REQUIRES-RESET!', false, false),
  ('24c00000-0000-0000-0000-000000000003', 'k24.monteur.eins@beispiel.invalid', '!MIGRATED-ACCOUNT-REQUIRES-RESET!', false, false),
  ('24c00000-0000-0000-0000-000000000004', 'k24.monteur.zwei@beispiel.invalid', '!MIGRATED-ACCOUNT-REQUIRES-RESET!', false, false),
  ('24c00000-0000-0000-0000-000000000005', 'k24.monteur.drei@beispiel.invalid', '!MIGRATED-ACCOUNT-REQUIRES-RESET!', false, false)
on conflict (id) do nothing;

insert into public.profiles (id, full_name, role, is_active)
values
  ('24c00000-0000-0000-0000-000000000001', 'K24 Admin', 'admin', true),
  ('24c00000-0000-0000-0000-000000000002', 'K24 Disponent', 'disponent', true),
  ('24c00000-0000-0000-0000-000000000003', 'K24 Monteur Eins', 'monteur', true),
  ('24c00000-0000-0000-0000-000000000004', 'K24 Monteur Zwei', 'monteur', true),
  ('24c00000-0000-0000-0000-000000000005', 'K24 Monteur Drei', 'monteur', true)
on conflict (id) do nothing;

-- Bauabschnitt und VzG-Strecke der acht Vorgaenge. vzg_line_id wird bei jedem
-- Vorgang gesetzt, damit die abgeleitete Aufgabe historic_vzg nicht entsteht
-- (0011:181-206) und die Fixtures nichts erzeugen, was sie nicht brauchen.
-- Muster und Begruendung aus 20_ap14b_data.sql:103-105.
insert into public.construction_stages (id, code, name)
values ('24c00000-0000-0000-0000-0000000000a1', 'B24C', 'Bauabschnitt AP15-Kennzahlen')
on conflict (id) do nothing;

insert into public.vzg_lines (id, line_number, construction_stage_id)
values ('24c00000-0000-0000-0000-0000000000a2', '1824', '24c00000-0000-0000-0000-0000000000a1')
on conflict (id) do nothing;

-- Gegenprobe der Fixtures im Eigentuemerkontext, BEVOR irgendein Fall laeuft.
-- Zwei Erwartungen:
--   * die fuenf Identitaeten stehen mit der jeweils gewollten Rolle und aktiv
--     bereit - eine verschobene Rolle wuerde die Staff-/Monteurgrenze
--     lautlos verruecken und K2-K6 entwerten;
--   * es existiert noch KEIN Vorgang mit dem Praefix 24c00000-. Ohne diese
--     Probe koennte ein Rest eines frueheren, hart abgebrochenen Laufs die
--     Differenzen verfaelschen.
do $$
declare
  v_staff integer;
  v_monteure integer;
  v_vorgaenge integer;
begin
  select count(*) into v_staff
  from public.profiles
  where id in (
      '24c00000-0000-0000-0000-000000000001',
      '24c00000-0000-0000-0000-000000000002'
    )
    and role in ('admin', 'disponent')
    and is_active;

  select count(*) into v_monteure
  from public.profiles
  where id in (
      '24c00000-0000-0000-0000-000000000003',
      '24c00000-0000-0000-0000-000000000004',
      '24c00000-0000-0000-0000-000000000005'
    )
    and role = 'monteur'
    and is_active;

  select count(*) into v_vorgaenge
  from public.incidents
  where id::text like '24c00000-%';

  if v_staff <> 2 then
    raise exception
      'SMOKE K-FIXTURES FAIL % Staff-Identitaet(en) unter ...0001/...0002 statt zwei', v_staff;
  end if;
  if v_monteure <> 3 then
    raise exception
      'SMOKE K-FIXTURES FAIL % aktive Monteursidentitaet(en) unter ...0003/...0004/...0005 statt drei',
      v_monteure;
  end if;
  if v_vorgaenge <> 0 then
    raise exception
      'SMOKE K-FIXTURES FAIL % Vorgang/Vorgaenge mit dem Praefix 24c00000- bestehen bereits - die Differenzen waeren nicht aussagekraeftig',
      v_vorgaenge;
  end if;

  raise notice
    'SMOKE K-FIXTURES OK fuenf Identitaeten (Administrator, Disponent, drei Monteure), Bauabschnitt und VzG-Strecke angelegt, noch kein Vorgang mit dem Praefix 24c00000-';
end
$$;

-- =====================================================================
-- Ab hier unter der Anwendungsrolle app_user.
--
-- Grundlage der Zeilensichtbarkeit - alles gelesen, nichts angenommen:
--   * public.incident_list_view ist eine security_invoker-View (0011:619-620);
--     ihre Zeilensichtbarkeit stammt aus der Policy der Basistabelle.
--   * incidents_select using `is_staff() or is_assigned_to_incident(id)`
--     (0001:540-541).
--   * public.is_assigned_to_incident() verlangt ausdruecklich `a.is_active`
--     (0001:67-76) - eine inaktive Zuweisung oeffnet KEINE Zeile.
--   * assignments_select using `is_staff() or monteur_id = auth.uid()`
--     (0001:551-552). Das ist die Schranke, die die Spalte monteur_ids der
--     View fuer einen Monteur auf die EIGENE Zuweisungszeile eindampft: die
--     laterale Teilabfrage der View liest public.incident_assignments unter der
--     Identitaet des Aufrufers (0011:683-689).
--   * profiles_select using `id = auth.uid() or is_staff()` (0001:508-509);
--     dieselbe laterale Teilabfrage verbindet die Zuweisung mit dem Profil.
--   * app_user besitzt `select` auf public.incident_list_view (0014:46) - und
--     ausschliesslich das (Fall K10).
-- =====================================================================
set role app_user;

-- ---------------------------------------------------------------------
-- K1-K8 in EINEM do-Block.
--
-- Das ist keine Zusammenlegung aus Bequemlichkeit, sondern die einzige Form,
-- die ohne zusaetzliches Schemaobjekt auskommt: die Basiswerte muessen VOR der
-- Anlage der acht Vorgaenge erhoben und NACH ihr wieder gebraucht werden. Ohne
-- gemeinsamen Block muesste sie irgendetwas persistieren - eine Tabelle, eine
-- temporaere Tabelle oder eine Funktion -, und genau das ist ausgeschlossen.
-- Deshalb tragen sie hier ganz gewoehnliche PL/pgSQL-Variablen.
--
-- Reihenfolge im Block:
--   1. Basiswerte je Identitaet messen (K1)
--   2. Eigentuemerkontext: die acht Vorgaenge und die Zuweisungen anlegen
--   3. Endwerte je Identitaet messen
--   4. K2-K8 gegen die Sollwerte pruefen
--
-- Indizes der Arrays: 1 = Administrator, 2 = Disponent, 3 = M1, 4 = M2,
-- 5 = M3. Sie sind ueber den ganzen Block hinweg dieselben.
-- ---------------------------------------------------------------------
do $$
declare
  -- Die Terminalstatusmenge steht GENAU EINMAL in diesem Block. Fuehrend fuer
  -- die Anwendung bleibt TERMINAL_STATUS in app/src/lib/status.ts:176-180; die
  -- Gleichheit beider Listen belegt der Integrationstest
  -- app/test/integration/ap15-dashboard-metrics.int.mjs, nicht diese Datei.
  v_terminal public.incident_status[] :=
    array['abgeschlossen', 'storniert', 'fehlalarm']::public.incident_status[];

  v_ids uuid[] := array[
    '24c00000-0000-0000-0000-000000000001',   -- A  Administrator
    '24c00000-0000-0000-0000-000000000002',   -- D  Disponent
    '24c00000-0000-0000-0000-000000000003',   -- M1
    '24c00000-0000-0000-0000-000000000004',   -- M2
    '24c00000-0000-0000-0000-000000000005'    -- M3
  ]::uuid[];
  v_namen text[] := array['Administrator', 'Disponent', 'M1', 'M2', 'M3'];

  v_stage uuid := '24c00000-0000-0000-0000-0000000000a1';
  v_vzg uuid := '24c00000-0000-0000-0000-0000000000a2';

  -- Basiswerte (vor der Anlage der acht Vorgaenge).
  v_basis_offen integer[] := array[0, 0, 0, 0, 0];
  v_basis_technisch integer[] := array[0, 0, 0, 0, 0];
  v_basis_db integer[] := array[0, 0, 0, 0, 0];
  v_basis_material integer[] := array[0, 0, 0, 0, 0];
  v_basis_monteure integer[] := array[0, 0, 0, 0, 0];
  v_basis_zeilen integer[] := array[0, 0, 0, 0, 0];

  -- Endwerte (nach der Anlage).
  v_ende_offen integer[] := array[0, 0, 0, 0, 0];
  v_ende_technisch integer[] := array[0, 0, 0, 0, 0];
  v_ende_db integer[] := array[0, 0, 0, 0, 0];
  v_ende_material integer[] := array[0, 0, 0, 0, 0];
  v_ende_monteure integer[] := array[0, 0, 0, 0, 0];
  v_ende_zeilen integer[] := array[0, 0, 0, 0, 0];
  v_ende_praefix integer[] := array[0, 0, 0, 0, 0];

  -- Die Laufvariable der beiden Zaehlschleifen wird von `for i in 1..5`
  -- selbst angelegt und deshalb hier ausdruecklich NICHT deklariert.
  v_offen integer;
  v_technisch integer;
  v_db integer;
  v_material integer;
  v_monteure integer;
  v_zeilen integer;
  v_praefix integer;
begin
  -- ------------------------------------------------------------------
  -- 1) K1 - Basiswerte. Die Abfrage ist bis auf die Bindung der Parameter
  --    deckungsgleich mit getIncidentStatusMetrics()
  --    (app/src/lib/incident-metrics.ts): eine feste Struktur, vier gebundene
  --    Werte, keine interpolierte Benutzereingabe. Zusaetzlich erhoben werden
  --    die Gesamtzahl der sichtbaren Zeilen (fuer K8) und die Zahl der
  --    sichtbaren Zeilen mit dem eigenen Praefix (fuer K6 und K8).
  -- ------------------------------------------------------------------
  for i in 1..5 loop
    perform set_config('app.user_id', v_ids[i]::text, true);

    select
      count(*) filter (where v.status <> all (v_terminal))::int,
      count(*) filter (where v.status = 'technisch_abgeschlossen')::int,
      count(*) filter (where v.status = 'warten_auf_db')::int,
      count(*) filter (where v.status = 'warten_auf_material')::int,
      (
        select count(distinct m.monteur_id)::int
          from public.incident_list_view o
          cross join lateral unnest(o.monteur_ids) as m(monteur_id)
         where o.status <> all (v_terminal)
      ),
      count(*)::int,
      count(*) filter (where v.id::text like '24c00000-%')::int
    into v_offen, v_technisch, v_db, v_material, v_monteure, v_zeilen, v_praefix
    from public.incident_list_view v;

    v_basis_offen[i] := v_offen;
    v_basis_technisch[i] := v_technisch;
    v_basis_db[i] := v_db;
    v_basis_material[i] := v_material;
    v_basis_monteure[i] := v_monteure;
    v_basis_zeilen[i] := v_zeilen;

    -- Fuer M1, M2 und M3 ist die Basis nachweislich leer; genau darauf beruht
    -- die ABSOLUTE Erwartung in K4, K5 und K6. Waere hier ein Wert ungleich 0,
    -- waeren diese drei Faelle nicht mehr aussagekraeftig - dann bricht der
    -- Lauf hier ab und verbiegt nicht die Sollzahl.
    if i >= 3 and (v_offen <> 0 or v_technisch <> 0 or v_db <> 0
                   or v_material <> 0 or v_monteure <> 0 or v_zeilen <> 0) then
      raise exception
        'SMOKE K1 FAIL Ausgangslage von % ist nicht leer (offen=% technisch=% db=% material=% monteure=% zeilen=%)',
        v_namen[i], v_offen, v_technisch, v_db, v_material, v_monteure, v_zeilen;
    end if;
    if v_praefix <> 0 then
      raise exception
        'SMOKE K1 FAIL % sieht bereits % Zeile(n) mit dem Praefix 24c00000-',
        v_namen[i], v_praefix;
    end if;
  end loop;

  raise notice
    'SMOKE K1 OK Basiswerte erhoben (Administrator offen=%, Disponent offen=%); die drei neuen Monteure sehen nachweislich keine einzige Zeile',
    v_basis_offen[1], v_basis_offen[2];

  -- ------------------------------------------------------------------
  -- 2) Die acht Vorgaenge und die Zuweisungen im Eigentuemerkontext.
  --
  --    `status` wird direkt im insert gesetzt. Das ist zulaessig und kein
  --    Umweg um einen Waechter: tg_incident_guard ist ausdruecklich nur
  --    `before update` (0001:415-417), fuer INSERT existiert kein Statusfilter.
  --    Die Identitaet wird vorher geleert, damit created_by nicht auf die
  --    zuletzt gemessene Identitaet zeigt.
  --
  --    Pflichtspalten von public.incidents: construction_stage_id,
  --    vzg_line_number und km_from (0001:185-188).
  --
  --    Die Verteilung traegt die Sollwerte:
  --      V-A neu                     - aktive Zuweisung M1
  --      V-B technisch_abgeschlossen - aktive Zuweisungen M1 UND M2
  --      V-C warten_auf_db           - aktive Zuweisung M2
  --      V-D warten_auf_material     - OHNE Zuweisung
  --      V-E in_bearbeitung          - NUR eine INAKTIVE Zuweisung M2
  --      V-F abgeschlossen           - aktive Zuweisung M1  (Terminalstatus)
  --      V-G storniert               - aktive Zuweisung M1  (Terminalstatus)
  --      V-H fehlalarm               - aktive Zuweisung M1  (Terminalstatus)
  --    M3 erhaelt KEINE Zuweisung.
  -- ------------------------------------------------------------------
  reset role;
  perform set_config('app.user_id', '', true);

  insert into public.incidents
    (id, construction_stage_id, vzg_line_number, vzg_line_id, km_from, status, description)
  values
    ('24c00000-0000-0000-0000-0000000000b1', v_stage, '1824', v_vzg, 24.100,
     'neu', 'AP15 Kennzahlen - V-A offen ohne Bearbeitung'),
    ('24c00000-0000-0000-0000-0000000000b2', v_stage, '1824', v_vzg, 24.200,
     'technisch_abgeschlossen', 'AP15 Kennzahlen - V-B technisch abgeschlossen'),
    ('24c00000-0000-0000-0000-0000000000b3', v_stage, '1824', v_vzg, 24.300,
     'warten_auf_db', 'AP15 Kennzahlen - V-C wartet auf DB'),
    ('24c00000-0000-0000-0000-0000000000b4', v_stage, '1824', v_vzg, 24.400,
     'warten_auf_material', 'AP15 Kennzahlen - V-D wartet auf Material'),
    ('24c00000-0000-0000-0000-0000000000b5', v_stage, '1824', v_vzg, 24.500,
     'in_bearbeitung', 'AP15 Kennzahlen - V-E nur inaktive Zuweisung'),
    ('24c00000-0000-0000-0000-0000000000b6', v_stage, '1824', v_vzg, 24.600,
     'abgeschlossen', 'AP15 Kennzahlen - V-F Terminalstatus abgeschlossen'),
    ('24c00000-0000-0000-0000-0000000000b7', v_stage, '1824', v_vzg, 24.700,
     'storniert', 'AP15 Kennzahlen - V-G Terminalstatus storniert'),
    ('24c00000-0000-0000-0000-0000000000b8', v_stage, '1824', v_vzg, 24.800,
     'fehlalarm', 'AP15 Kennzahlen - V-H Terminalstatus fehlalarm');

  insert into public.incident_assignments (incident_id, monteur_id, is_active)
  values
    ('24c00000-0000-0000-0000-0000000000b1', v_ids[3], true),
    ('24c00000-0000-0000-0000-0000000000b2', v_ids[3], true),
    ('24c00000-0000-0000-0000-0000000000b2', v_ids[4], true),
    ('24c00000-0000-0000-0000-0000000000b3', v_ids[4], true),
    -- V-E: is_active ausdruecklich false. Das ist die tragende Eigenschaft von
    -- K5 und soll nicht aus einer Spaltenvorgabe erschlossen werden muessen.
    ('24c00000-0000-0000-0000-0000000000b5', v_ids[4], false),
    ('24c00000-0000-0000-0000-0000000000b6', v_ids[3], true),
    ('24c00000-0000-0000-0000-0000000000b7', v_ids[3], true),
    ('24c00000-0000-0000-0000-0000000000b8', v_ids[3], true);

  set role app_user;

  -- ------------------------------------------------------------------
  -- 3) Endwerte, gleiche Abfrage, gleiche Reihenfolge der Identitaeten.
  -- ------------------------------------------------------------------
  for i in 1..5 loop
    perform set_config('app.user_id', v_ids[i]::text, true);

    select
      count(*) filter (where v.status <> all (v_terminal))::int,
      count(*) filter (where v.status = 'technisch_abgeschlossen')::int,
      count(*) filter (where v.status = 'warten_auf_db')::int,
      count(*) filter (where v.status = 'warten_auf_material')::int,
      (
        select count(distinct m.monteur_id)::int
          from public.incident_list_view o
          cross join lateral unnest(o.monteur_ids) as m(monteur_id)
         where o.status <> all (v_terminal)
      ),
      count(*)::int,
      count(*) filter (where v.id::text like '24c00000-%')::int
    into v_offen, v_technisch, v_db, v_material, v_monteure, v_zeilen, v_praefix
    from public.incident_list_view v;

    v_ende_offen[i] := v_offen;
    v_ende_technisch[i] := v_technisch;
    v_ende_db[i] := v_db;
    v_ende_material[i] := v_material;
    v_ende_monteure[i] := v_monteure;
    v_ende_zeilen[i] := v_zeilen;
    v_ende_praefix[i] := v_praefix;
  end loop;

  -- ------------------------------------------------------------------
  -- 4) K2 - Administrator. Gemessen wird die DIFFERENZ, weil die Kennzahlen
  --    absolut ueber die ganze View zaehlen und die Fixtures der Smokes 15-23
  --    in derselben Datenbank stehen.
  --
  --    offen +5: V-A, V-B, V-C, V-D und V-E. V-F, V-G und V-H fallen als
  --    Terminalstatus heraus (das belegt K8 gesondert).
  --    monteure_im_einsatz +2: M1 (ueber V-A und V-B) und M2 (ueber V-B und
  --    V-C). Hier ist die Differenz ausnahmsweise ein SCHARFER Nachweis und
  --    nicht bloss eine Untergrenze: M1 und M2 sind in diesem Lauf neu
  --    angelegt, sie koennen in der Basismenge nicht vorgekommen sein. Ein
  --    Monteur aus einem fremden Fixture wuerde in BEIDEN Zaehlungen stehen
  --    und die Differenz nicht veraendern.
  --    V-D (ohne Zuweisung) und V-E (nur inaktive Zuweisung) tragen
  --    ausdruecklich NICHTS zu monteure_im_einsatz bei: die laterale
  --    Teilabfrage der View verlangt selbst `a.is_active` (0011:688).
  -- ------------------------------------------------------------------
  if v_ende_offen[1] - v_basis_offen[1] <> 5
     or v_ende_technisch[1] - v_basis_technisch[1] <> 1
     or v_ende_db[1] - v_basis_db[1] <> 1
     or v_ende_material[1] - v_basis_material[1] <> 1
     or v_ende_monteure[1] - v_basis_monteure[1] <> 2 then
    raise exception
      'SMOKE K2 FAIL Administrator: offen %/erwartet 5, technisch %/1, warten_auf_db %/1, warten_auf_material %/1, monteure_im_einsatz %/2 (jeweils Differenz)',
      v_ende_offen[1] - v_basis_offen[1],
      v_ende_technisch[1] - v_basis_technisch[1],
      v_ende_db[1] - v_basis_db[1],
      v_ende_material[1] - v_basis_material[1],
      v_ende_monteure[1] - v_basis_monteure[1];
  end if;

  raise notice
    'SMOKE K2 OK Administrator zaehlt offen +5, technisch_abgeschlossen +1, warten_auf_db +1, warten_auf_material +1 und monteure_im_einsatz +2 (M1 und M2; V-D ohne und V-E nur mit inaktiver Zuweisung zaehlen nicht mit)';

  -- ------------------------------------------------------------------
  -- K3 - Disponent. Dieselben Differenzen wie K2, weil beide Rollen ueber
  -- is_staff() denselben Zeilenzugang haben (0001:540-541). Der Fall ist keine
  -- Wiederholung: er belegt, dass die Kennzahlen NICHT an der Adminrolle
  -- haengen, sondern an is_staff().
  -- ------------------------------------------------------------------
  if v_ende_offen[2] - v_basis_offen[2] <> 5
     or v_ende_technisch[2] - v_basis_technisch[2] <> 1
     or v_ende_db[2] - v_basis_db[2] <> 1
     or v_ende_material[2] - v_basis_material[2] <> 1
     or v_ende_monteure[2] - v_basis_monteure[2] <> 2 then
    raise exception
      'SMOKE K3 FAIL Disponent: offen %/erwartet 5, technisch %/1, warten_auf_db %/1, warten_auf_material %/1, monteure_im_einsatz %/2 (jeweils Differenz)',
      v_ende_offen[2] - v_basis_offen[2],
      v_ende_technisch[2] - v_basis_technisch[2],
      v_ende_db[2] - v_basis_db[2],
      v_ende_material[2] - v_basis_material[2],
      v_ende_monteure[2] - v_basis_monteure[2];
  end if;

  raise notice
    'SMOKE K3 OK Disponent zaehlt dieselben Differenzen wie der Administrator - die Kennzahlen haengen an is_staff(), nicht an der Adminrolle';

  -- ------------------------------------------------------------------
  -- K4 - Monteur M1, ABSOLUT (die Basis ist in K1 als leer belegt).
  --
  -- M1 sieht ueber is_assigned_to_incident() genau V-A, V-B, V-F, V-G und
  -- V-H - seine fuenf aktiven Zuweisungen. Davon sind nur V-A und V-B offen,
  -- also offen = 2; V-F, V-G und V-H sind Terminalstatus.
  -- warten_auf_db = 0 und warten_auf_material = 0: V-C und V-D gehoeren M1
  -- nicht und sind fuer ihn nicht sichtbar - er sieht also NICHT die
  -- Gesamtzahl, sondern seine eigene.
  -- monteure_im_einsatz = 1: ueber assignments_select (0001:551-552) sieht M1
  -- ausschliesslich die EIGENE Zuweisungszeile. Auf V-B sind M1 und M2 aktiv
  -- zugewiesen; M1 zaehlt dort trotzdem nur sich selbst. Genau das ist die
  -- Stelle, an der ein Zaehlleck ueber die Spalte monteur_ids entstehen wuerde.
  -- ------------------------------------------------------------------
  if v_ende_offen[3] <> 2 or v_ende_technisch[3] <> 1 or v_ende_db[3] <> 0
     or v_ende_material[3] <> 0 or v_ende_monteure[3] <> 1 then
    raise exception
      'SMOKE K4 FAIL M1: offen %/erwartet 2, technisch %/1, warten_auf_db %/0, warten_auf_material %/0, monteure_im_einsatz %/1 (absolut)',
      v_ende_offen[3], v_ende_technisch[3], v_ende_db[3],
      v_ende_material[3], v_ende_monteure[3];
  end if;
  -- Die Zeilenmenge selbst, getrennt von den Kennzahlen: genau die fuenf
  -- Vorgaenge mit aktiver Zuweisung, kein sechster. Ohne diese Probe koennte
  -- eine passende Kennzahl auch aus einer zu grossen Zeilenmenge entstehen.
  if v_ende_zeilen[3] <> 5 or v_ende_praefix[3] <> 5 then
    raise exception
      'SMOKE K4 FAIL M1 sieht % Zeile(n) in der Liste, davon % mit dem Praefix 24c00000- - erwartet je fuenf',
      v_ende_zeilen[3], v_ende_praefix[3];
  end if;

  raise notice
    'SMOKE K4 OK M1 zaehlt absolut offen=2, technisch_abgeschlossen=1, warten_auf_db=0, warten_auf_material=0, monteure_im_einsatz=1 - er sieht nur seine fuenf Zuweisungen und auf V-B nur die eigene Zuweisungszeile';

  -- ------------------------------------------------------------------
  -- K5 - Monteur M2, ABSOLUT.
  --
  -- M2 sieht genau V-B (aktiv) und V-C (aktiv), beide offen: offen = 2,
  -- technisch_abgeschlossen = 1, warten_auf_db = 1.
  -- V-E ist fuer M2 NICHT sichtbar, obwohl eine Zuweisungszeile existiert:
  -- public.is_assigned_to_incident() verlangt ausdruecklich `a.is_active`
  -- (0001:67-76), und die Zuweisung auf V-E ist inaktiv. Waere diese Bedingung
  -- je entfernt, waere offen hier 3 und der Fall bricht.
  -- monteure_im_einsatz = 1 aus demselben Grund wie in K4.
  -- ------------------------------------------------------------------
  if v_ende_offen[4] <> 2 or v_ende_technisch[4] <> 1 or v_ende_db[4] <> 1
     or v_ende_material[4] <> 0 or v_ende_monteure[4] <> 1 then
    raise exception
      'SMOKE K5 FAIL M2: offen %/erwartet 2, technisch %/1, warten_auf_db %/1, warten_auf_material %/0, monteure_im_einsatz %/1 (absolut)',
      v_ende_offen[4], v_ende_technisch[4], v_ende_db[4],
      v_ende_material[4], v_ende_monteure[4];
  end if;
  -- Und die Zeilenmenge: genau V-B und V-C. Eine dritte Zeile waere V-E, also
  -- der Beweis, dass die inaktive Zuweisung doch oeffnet.
  if v_ende_zeilen[4] <> 2 or v_ende_praefix[4] <> 2 then
    raise exception
      'SMOKE K5 FAIL M2 sieht % Zeile(n) in der Liste, davon % mit dem Praefix 24c00000- - erwartet je zwei; eine dritte waere der Vorgang mit der INAKTIVEN Zuweisung',
      v_ende_zeilen[4], v_ende_praefix[4];
  end if;

  raise notice
    'SMOKE K5 OK M2 zaehlt absolut offen=2, technisch_abgeschlossen=1, warten_auf_db=1, warten_auf_material=0, monteure_im_einsatz=1 - der Vorgang mit der INAKTIVEN Zuweisung bleibt unsichtbar (is_assigned_to_incident verlangt a.is_active)';

  -- ------------------------------------------------------------------
  -- K6 - Monteur M3 ohne jede Zuweisung: KEIN ZAEHLLECK.
  --
  -- Alle fuenf Kennzahlen sind 0, und zusaetzlich sieht M3 keine einzige Zeile
  -- der View mit dem Praefix 24c00000-. Die zweite Haelfte ist die wichtigere:
  -- eine Kennzahl von 0 koennte auch bei sichtbaren Zeilen entstehen, wenn
  -- deren Status zufaellig nicht passt. Erst die Zeilenzaehlung belegt, dass M3
  -- die acht Vorgaenge ueberhaupt nicht erreicht.
  -- ------------------------------------------------------------------
  if v_ende_offen[5] <> 0 or v_ende_technisch[5] <> 0 or v_ende_db[5] <> 0
     or v_ende_material[5] <> 0 or v_ende_monteure[5] <> 0 then
    raise exception
      'SMOKE K6 FAIL M3: offen %, technisch %, warten_auf_db %, warten_auf_material %, monteure_im_einsatz % - erwartet durchgehend 0',
      v_ende_offen[5], v_ende_technisch[5], v_ende_db[5],
      v_ende_material[5], v_ende_monteure[5];
  end if;
  if v_ende_praefix[5] <> 0 or v_ende_zeilen[5] <> 0 then
    raise exception
      'SMOKE K6 FAIL M3 sieht % Zeile(n) in der Liste, davon % mit dem Praefix 24c00000- - erwartet je 0',
      v_ende_zeilen[5], v_ende_praefix[5];
  end if;

  raise notice
    'SMOKE K6 OK der fremde Monteur M3 zaehlt alle fuenf Kennzahlen als 0 und sieht keine einzige Zeile mit dem Praefix 24c00000- - kein Zaehlleck';

  -- ------------------------------------------------------------------
  -- K7 - Zaehlleck-Gegenprobe ueber die Sichten hinweg.
  --
  -- Die Monteurssicht darf keine fremden Zaehlwerte gewinnen: offen von M1 ist
  -- STRIKT KLEINER als offen des Administrators, und offen von M3 ist 0. Der
  -- Fall ist bewusst als Vergleich der Sichten formuliert und nicht als
  -- weitere Zahl: er faellt auch dann auf, wenn sich alle Sollzahlen aus K2-K6
  -- einmal gemeinsam verschoeben.
  -- ------------------------------------------------------------------
  if not (v_ende_offen[3] < v_ende_offen[1]) then
    raise exception
      'SMOKE K7 FAIL offen von M1 (%) ist nicht kleiner als offen des Administrators (%) - die Monteurssicht gewinnt fremde Zaehlwerte',
      v_ende_offen[3], v_ende_offen[1];
  end if;
  if v_ende_offen[5] <> 0 then
    raise exception
      'SMOKE K7 FAIL offen von M3 ist % statt 0', v_ende_offen[5];
  end if;

  raise notice
    'SMOKE K7 OK offen von M1 (%) ist strikt kleiner als offen des Administrators (%) und offen von M3 ist 0 - eine Monteurssicht gewinnt weder fremde Zeilen noch fremde Zaehlwerte',
    v_ende_offen[3], v_ende_offen[1];

  -- ------------------------------------------------------------------
  -- K8 - Terminalstatus.
  --
  -- V-F ('abgeschlossen'), V-G ('storniert') und V-H ('fehlalarm') sind in
  -- `offen` NICHT enthalten. Belegt wird das ueber zwei Zahlen derselben
  -- Sicht: der Administrator sieht acht zusaetzliche Zeilen, seine Kennzahl
  -- `offen` waechst aber nur um fuenf. Zusaetzlich wird geprueft, dass er die
  -- acht Zeilen wirklich ueber den Praefix findet - ohne das koennte die
  -- Zunahme von 8 auch aus einer fremden Quelle stammen.
  -- ------------------------------------------------------------------
  if v_ende_zeilen[1] - v_basis_zeilen[1] <> 8 then
    raise exception
      'SMOKE K8 FAIL der Administrator sieht % zusaetzliche Zeile(n) statt acht - die Aussage zum Terminalstatus haette keine Grundlage',
      v_ende_zeilen[1] - v_basis_zeilen[1];
  end if;
  if v_ende_praefix[1] <> 8 then
    raise exception
      'SMOKE K8 FAIL der Administrator sieht % Zeile(n) mit dem Praefix 24c00000- statt acht', v_ende_praefix[1];
  end if;
  if v_ende_offen[1] - v_basis_offen[1] <> 5 then
    raise exception
      'SMOKE K8 FAIL offen waechst um % statt um fuenf, obwohl acht Zeilen hinzugekommen sind - ein Terminalstatus wird mitgezaehlt',
      v_ende_offen[1] - v_basis_offen[1];
  end if;

  raise notice
    'SMOKE K8 OK acht zusaetzliche sichtbare Zeilen, aber nur +5 bei offen - abgeschlossen, storniert und fehlalarm zaehlen nicht als offen';
end
$$;

-- ---------------------------------------------------------------------
-- K9: KEINE freien SECURITY-DEFINER-Helfer fuer die Kennzahlen - und dieser
-- Smoke erzeugt selbst keine Funktion.
--
-- Warum das hierher gehoert: ein Definer-Helfer waere der bequemste und
-- gefaehrlichste Weg zu Kennzahlen. Er laeuft mit den Rechten seines
-- Eigentuemers, umgeht damit die RLS der Basistabelle und wuerde jeder
-- Identitaet die GESAMTZAHL liefern - genau das Zaehlleck, das K4 bis K7
-- ausschliessen. Der Weg der Anwendung ist bewusst ein anderer:
-- getIncidentStatusMetrics() zaehlt ueber die security_invoker-View
-- public.incident_list_view, also unter der Identitaet des Aufrufers.
--
-- Geprueft wird zweierlei:
--   * in schema public existiert keine Funktion mit prosecdef, deren Name auf
--     Kennzahlen oder Metriken deutet;
--   * die Zahl der Funktionen in schema public ist dieselbe wie beim Beginn
--     dieser Datei. Damit ist "diese Datei erzeugt keine Funktion" gemessen und
--     nicht behauptet.
--
-- ZUR SUCHMASKE FUER "count" - ein gelesener Befund, keine Abschwaechung:
--   Ein wortwoertliches `like '%count%'` waere hier FALSCH, und zwar nicht
--   knapp: die Zeichenfolge "count" steckt in "account". Ein solches Muster
--   trifft deshalb public.tg_audit_auth_account_disabled (0017:277-278) und
--   public.tg_audit_auth_account_lockout (0017:405-406). Beide sind
--   ausdruecklich SECURITY DEFINER, beide MUESSEN es sein (Begruendung in
--   23_ap14b_admin_users.sql, Fall U7: ohne prosecdef scheiterte jeder
--   Auditsatz an der fehlenden Insert-Policy von public.audit_events), und
--   beide haben mit Kennzahlen nichts zu tun. Der Fall waere also rot - aus
--   einem Grund, der weder etwas ueber das Dashboard noch etwas ueber ein
--   Zaehlleck aussagt. Ein Nachweis, der aus falschem Grund rot ist, ist so
--   wenig brauchbar wie einer, der aus falschem Grund gruen ist.
--   Deshalb wird "count" als NAMENSBESTANDTEIL gesucht: '(^|_)count' verlangt
--   den Wortanfang oder einen Unterstrich davor. "incident_count",
--   "count_open_incidents" und "status_counts" werden erfasst, "account" nicht.
--   Die drei uebrigen Muster bleiben unveraendert wortwoertlich.
-- ---------------------------------------------------------------------
set role app_user;

do $$
declare
  v_treffer text[] := array[]::text[];
  item record;
  v_start integer;
  v_jetzt integer;
begin
  for item in
    select p.proname::text as name
    from pg_proc p
    join pg_namespace ns on ns.oid = p.pronamespace
    where ns.nspname = 'public'
      and p.prosecdef
      and (
        p.proname like '%metric%'
        or p.proname like '%kennzahl%'
        or p.proname like '%dashboard%'
        -- "count" nur als Namensbestandteil, nicht als Teil von "account".
        or p.proname ~ '(^|_)count'
      )
    order by p.proname
  loop
    v_treffer := array_append(v_treffer, item.name);
  end loop;

  if array_length(v_treffer, 1) is not null then
    raise exception
      'SMOKE K9 FAIL SECURITY-DEFINER-Funktion(en) mit Kennzahlbezug in schema public: % - ein solcher Helfer wuerde die RLS der Basistabelle umgehen',
      array_to_string(v_treffer, ', ');
  end if;

  v_start := nullif(current_setting('kb24c.proc_count_start', true), '')::integer;
  if v_start is null then
    raise exception
      'SMOKE K9 FAIL der Ausgangsstand kb24c.proc_count_start fehlt - ohne ihn ist "diese Datei erzeugt keine Funktion" nicht messbar';
  end if;

  select count(*) into v_jetzt
  from pg_proc p
  join pg_namespace ns on ns.oid = p.pronamespace
  where ns.nspname = 'public';

  if v_jetzt <> v_start then
    raise exception
      'SMOKE K9 FAIL die Zahl der Funktionen in schema public hat sich um % veraendert (vorher %, jetzt %)',
      v_jetzt - v_start, v_start, v_jetzt;
  end if;

  raise notice
    'SMOKE K9 OK kein SECURITY-DEFINER-Helfer mit Kennzahlbezug in schema public, und die Zahl der Funktionen (%) ist unveraendert - dieser Smoke erzeugt keine Funktion',
    v_jetzt;
end
$$;

-- ---------------------------------------------------------------------
-- K10: die Kennzahlen laufen ohne jedes zusaetzliche Recht.
--
-- Der Lesezugang auf public.incident_list_view (0014:46) genuegt vollstaendig.
-- Die Negativhaelfte ist der eigentliche Nachweis: haette app_user auf der View
-- insert, update oder delete, waere der Lesepfad des Dashboards nicht mehr von
-- einem Schreibpfad zu unterscheiden, und eine Kennzahlabfrage koennte
-- nebenbei Daten veraendern. `truncate` ist ausdruecklich NICHT in der Liste:
-- has_table_privilege beantwortet die Frage fuer eine View, aber ein
-- aussagekraeftiges Recht ist es dort nicht.
-- ---------------------------------------------------------------------
do $$
declare
  v_recht text;
  v_unerwartet text[] := array[]::text[];
begin
  if not has_table_privilege('app_user', 'public.incident_list_view', 'select') then
    raise exception
      'SMOKE K10 FAIL app_user besitzt kein select auf public.incident_list_view - die Kennzahlabfrage koennte nicht laufen';
  end if;

  foreach v_recht in array array['insert', 'update', 'delete']
  loop
    if has_table_privilege('app_user', 'public.incident_list_view', v_recht) then
      v_unerwartet := array_append(v_unerwartet, v_recht);
    end if;
  end loop;

  if array_length(v_unerwartet, 1) is not null then
    raise exception
      'SMOKE K10 FAIL app_user besitzt auf public.incident_list_view zusaetzlich: %',
      array_to_string(v_unerwartet, ', ');
  end if;

  raise notice
    'SMOKE K10 OK app_user besitzt auf public.incident_list_view genau select und weder insert noch update noch delete - die Kennzahlen brauchen kein zusaetzliches Recht';
end
$$;

-- =====================================================================
-- Ende der Wirkungsphase. Der Rollback nimmt ALLES zurueck: die acht
-- Vorgaenge, ihre Zuweisungen, die daraus abgeleiteten Aufgaben, die
-- Statuschronik, die Auditsaetze, den Bauabschnitt, die VzG-Strecke sowie die
-- fuenf Profile und Konten. Ein Aufraeumen per DELETE waere wegen
-- trg_incident_tasks_no_delete (0011:113-123) nicht moeglich; die Begruendung
-- steht im Kopf dieser Datei.
-- =====================================================================
reset role;
select set_config('app.user_id', '', false);

rollback;

-- Der Ausgangsstand fuer K9 ist verbraucht und wird zurueckgesetzt, damit die
-- Sitzung nichts von dieser Datei behaelt.
select set_config('kb24c.proc_count_start', '', false);

-- ---------------------------------------------------------------------
-- K-ENDE: Gegenprobe NACH dem Rollback, im Eigentuemerkontext (RLS darf das
-- Ergebnis nicht filtern - sonst waere eine 0 auch dann zu sehen, wenn Zeilen
-- zurueckblieben).
--
-- Gezaehlt wird ueber den Praefix 24c00000- in genau den Tabellen, in die diese
-- Datei mit eigenen Kennungen geschrieben hat. Die abgeleiteten Zeilen
-- (Zuweisungen, Aufgaben, Statuschronik, Audit) tragen von der Datenbank
-- vergebene Kennungen und haengen ueber Fremdschluessel an den hier gezaehlten
-- Zeilen; mit deren Verschwinden sind auch sie fort.
-- ---------------------------------------------------------------------
do $$
declare
  v_rest integer;
begin
  select
    (select count(*) from public.incidents where id::text like '24c00000-%')
    + (select count(*) from public.profiles where id::text like '24c00000-%')
    + (select count(*) from public.auth_accounts where id::text like '24c00000-%')
    + (select count(*) from public.construction_stages where id::text like '24c00000-%')
    + (select count(*) from public.vzg_lines where id::text like '24c00000-%')
  into v_rest;

  if v_rest <> 0 then
    raise exception
      'SMOKE K-ENDE FAIL % Zeile(n) mit dem Praefix 24c00000- bleiben nach dem Rollback zurueck', v_rest;
  end if;

  raise notice
    'SMOKE K-ENDE OK AP15-Statuskennzahlen K1-K10 unter app_user mit aktiver RLS belegt (Staffsicht als Differenz, Monteurssicht absolut, inaktive Zuweisung unsichtbar, kein Zaehlleck, Terminalstatus ausgenommen, kein Definer-Helfer, nur select auf der Liste); die Wirkungsphase wurde per rollback vollstaendig zurueckgenommen, es bleibt keine Zeile mit dem Praefix 24c00000-';
end
$$;
