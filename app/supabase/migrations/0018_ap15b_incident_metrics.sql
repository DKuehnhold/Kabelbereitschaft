-- =====================================================================
-- Kabelbereitschaft – AP15-b (Migration 0018): Fehlalarm-Semantik,
-- Filteroptionen und Vollmengen-Export.
--
-- Scope laut verbindlichem Folgeprompt (2026-08-11): AUSSCHLIESSLICH
-- Fehlalarm-Semantik, Datumsherkunft/Tagesgrenze (dort rein applikativ in
-- src/lib/date-local.ts geloest, keine DB-Aenderung noetig), Filteroptionen
-- und Vollmengen-Export-Pfad. Keine Aenderung an Auth-/Deployment-
-- Grundarchitektur. Additiv zu 0001-0017, keine bestehende Definition wird
-- entfernt.
--
-- Dateiname: der urspruenglich vorgesehene Name "0010_ap15b_..." kollidiert
-- mit der bereits vorhandenen 0010_ap12_incident_details.sql - naechste freie
-- Nummer ist 0018 (0001-0017 bereits belegt, Stand dieser Migration).
--
-- OFFENE FACHLICHE ENTSCHEIDUNG (nicht Gegenstand dieser Migration, siehe
-- PROJEKT_WISSEN.md): der Auftrag benennt woertlich "nur die Disponent-Rolle"
-- fuer das Setzen/Aendern der Fehlalarm-Kennzeichnung. Das ist bewusst enger
-- als die im uebrigen Code durchgaengige is_staff()-Konvention
-- (admin+disponent, z. B. incidents_update, bulk_update_incident_status_ap13)
-- und schliesst admin explizit aus. Diese Migration setzt die Weisung
-- WOERTLICH um (current_user_role() = 'disponent', kein is_staff()). Die
-- Regel gilt dabei nicht nur fuer das Aendern per UPDATE, sondern auch fuer
-- die ANLAGE (INSERT) mit gesetzter Kennzeichnung - andernfalls waere sie
-- ueber den Anlageweg umgehbar (Einzelheiten in Abschnitt 2). Falls
-- admin ebenfalls berechtigt sein soll, ist das eine gesonderte fachliche
-- Entscheidung und erfordert eine Anpassung dieser Migration.
-- =====================================================================

set check_function_bodies = off;

-- ---------------------------------------------------------------------
-- 1) Spalte: Fehlalarm-Kennzeichnung
-- ---------------------------------------------------------------------
-- Additiv, NOT NULL mit Default false: bestehende Zeilen gelten unveraendert
-- als kein Fehlalarm. Die frueher an dieser Stelle stehende Aussage "keine
-- Backfill-Migration noetig" ist unzutreffend und wird hiermit berichtigt:
-- `add column if not exists` wird vollstaendig uebersprungen, sobald die
-- Spalte aus einem VORLAUF bereits existiert - liegt sie dort nullable und
-- ohne Default vor, werden NOT NULL und Default gerade NICHT nachgezogen.
-- Die Schritte 1c-1e sind deshalb Pflicht, damit diese Migration auch als
-- Reparaturlauf idempotent zum Zielzustand fuehrt.
--
-- Warum 1b NICHT durch eine nullable Spalte mit spaeterem `set not null`
-- ersetzt wird: eine nullable Spalte ohne Default setzt auf einem gefuellten
-- Bestand ALLE Zeilen auf NULL und macht den Backfill in 1d zu einem
-- Voll-UPDATE - mit einem Auditsatz je Zeile (trg_audit_incidents,
-- 0001_init.sql:455-457) und updated_by := NULL je Zeile
-- (trg_touch_incidents, 0001_init.sql:449-450). Die hier gewaehlte
-- kombinierte Fassung haelt dieses Voll-UPDATE aus dem Normalfall heraus.
--
-- Warum nicht `alter column is_false_alarm type boolean using coalesce(...)`:
-- ab dem zweiten Lauf haengt public.incident_list_view an der Spalte
-- (Abschnitt 3 derselben Datei); PostgreSQL lehnt den Typwechsel einer von
-- einer View benutzten Spalte ab. Dieser Weg waere also gerade nicht
-- idempotent.
--
-- NEBENWIRKUNG des Reparaturpfades, ausdruecklich benannt: im Reparaturfall
-- erzeugt 1d je betroffener Zeile einen Auditsatz, setzt updated_at neu und
-- updated_by auf NULL. updated_at ist die Konfliktbasis der optimistischen
-- Sperre (0011_ap13_tasks_bulk.sql:458-461). Auf einem frischen Schema
-- trifft 1d 0 Zeilen und hat keine Wirkung.
--
-- ZEITFENSTER, ausdruecklich benannt: zwischen Schritt 1a
-- (`drop trigger if exists`) und der Neuanlage des Triggers am Ende von
-- Abschnitt 2 ist die Disponent-only-Regel fuer parallelen Anwendungsverkehr
-- nicht durchgesetzt. Dieses Fenster ist GROESSER als das der Vorfassung, und
-- das wird hier ausdruecklich gesagt: die Vorfassung hatte nur das kurze
-- Fenster zwischen den beiden unmittelbar benachbarten Anweisungen
-- `drop trigger if exists` und `create trigger` in Abschnitt 2. Das neue
-- Fenster reicht von Schritt 1a bis zur Triggeranlage und umspannt dazwischen
-- `comment on column`, den Backfill, zwei `alter table`, die Neuanlage der
-- Waechterfunktion und die vollstaendige Neudefinition der View. Gleiche Art
-- des Risikos, deutlich groessere Flaeche und Dauer. Die Migrationsdateien
-- laufen nicht in einer Sammeltransaktion (psql -f je Datei, ohne
-- --single-transaction).
--
-- ABBRUCHFALL, bisher nicht benannt: bricht eine Anweisung zwischen 1a und der
-- Triggeranlage ab - etwa 1e (`set not null`) mit SQLSTATE 23502, weil parallel
-- eine NULL-Zeile entstand, oder ein Lock-Timeout -, dann fehlt
-- trg_incident_guard_false_alarm DAUERHAFT, und nichts stellt ihn von selbst
-- wieder her. Das ist ein Fail-open eines Schutzmechanismus und wird hier
-- ausdruecklich so benannt.
--
-- Was tatsaechlich dagegen greift: die Laeufer wenden jede Migrationsdatei mit
-- ON_ERROR_STOP=1 an (run_db_tests.sh:262, run_ap14b_local.ps1:782), ein
-- Abbruch ist deshalb sichtbar und laesst den Laeufer mit einem Exitcode
-- ungleich 0 enden; und weil diese Migration idempotent ist, stellt ein
-- erneuter vollstaendiger Lauf von 0018 den Waechter wieder her.
--
-- WARUM DIESE DATEI BEWUSST KEINEN EIGENEN `begin;`/`commit;`-RAHMEN ERHAELT:
-- der SQL-Smoke app/supabase/test/25_ap15b_incident_metrics.sql bindet diese
-- Migrationsdatei zum Nachweis der Wiederholbarkeit per `\ir` INNERHALB seiner
-- eigenen offenen Transaktion ein. Ein `commit;` in der eingebundenen Datei
-- wuerde die AEUSSERE Transaktion des Smokes abschliessen; dessen Fixtures
-- wuerden dann bestehen bleiben, und die Ruecknahme per `rollback;` samt dem
-- Abschlussfall W-ENDE waere wirkungslos. Zusaetzlich traegt keine der
-- Migrationen 0001-0017 einen expliziten Transaktionsrahmen.
--
-- Das verbleibende Restrisiko ist damit BEWUSST IN KAUF GENOMMEN und NICHT
-- beseitigt: die Anwendung dieser Migration gehoert in ein Wartungsfenster
-- ohne parallelen Anwendungsverkehr. Diese Einordnung ist ein OFFENER PUNKT
-- fuer Codex und die interne IT und wird hier nicht entschieden.

-- 1a) Waechter voruebergehend entfernen. PFLICHT, nicht Kosmetik: der Backfill
--     in 1d ist ein UPDATE und loest tg_incident_guard_false_alarm aus, sobald
--     dieser aus einem VORLAUF bereits existiert.
--     Das ist gemessen, nicht vermutet (Wegwerfcontainer, PostgreSQL 18.4):
--     bei vorhandenem Waechter bricht
--     `update public.incidents set is_false_alarm = false where is_false_alarm
--     is null` mit SQLSTATE 42501 und der Meldung des Waechters ab, die
--     NULL-Zeile bleibt stehen; nach `drop trigger if exists` laeuft derselbe
--     Backfill mit Exit 0 und 0 verbleibenden NULL-Zeilen. Ursache:
--     old.is_false_alarm ist NULL, new.is_false_alarm ist false,
--     `false is not distinct from NULL` ist falsch, der Fruehausstieg des
--     Waechters greift also nicht - und public.current_user_role() liefert im
--     Eigentuemerkontext ohne gesetzte Anwendungsidentitaet NULL (ebenfalls
--     gemessen), ist damit `is distinct from 'disponent'`.
drop trigger if exists trg_incident_guard_false_alarm on public.incidents;

-- 1b) Frischer Fall: Spalte in EINEM Schritt korrekt anlegen.
alter table public.incidents
  add column if not exists is_false_alarm boolean not null default false;

-- 1c) Reparaturfall: existierte die Spalte schon, wurde 1b uebersprungen.
alter table public.incidents
  alter column is_false_alarm set default false;

-- 1d) Reparaturfall: bestehende NULL-Werte auffuellen.
update public.incidents
   set is_false_alarm = false
 where is_false_alarm is null;

-- 1e) Reparaturfall: NOT NULL nachziehen.
alter table public.incidents
  alter column is_false_alarm set not null;

comment on column public.incidents.is_false_alarm is
  'AP15-b: Fehlalarm-Kennzeichnung. Setzen und Aendern ist ausschliesslich '
  'der Rolle Disponent erlaubt (siehe tg_incident_guard_false_alarm) - RLS '
  'selbst ist nicht spaltengranular, daher ein dedizierter BEFORE INSERT OR '
  'UPDATE-Waechter (gleiches Muster wie trg_protect_profile_active_admin, '
  '0017).';

-- ---------------------------------------------------------------------
-- 2) Waechter: nur Disponent darf is_false_alarm setzen oder aendern
-- ---------------------------------------------------------------------
-- incidents_update (0001_init.sql) erlaubt das UPDATE der Zeile bereits
-- is_staff() ODER dem zugewiesenen Monteur - RLS ist zeilenbezogen, keine
-- Policy kann eine einzelne Spalte selektiv sperren. Der Waechter ergaenzt
-- daher spaltenscharf, exakt wie beim Rollenwechsel auf public.profiles
-- (tg_protect_profile_active_admin, 0017) und dem Sperrspalten-Waechter
-- (tg_protect_auth_account_lockout, 0017): Vergleich old/new, SQLSTATE
-- '42501' bei fehlender Berechtigung - dieselbe Codeklasse wie eine
-- RLS-Ablehnung, damit bestehende Fehlerbehandlung (mapBulkError u. ae.,
-- Muster /42501|permission denied/i) ohne Sonderfall greift.
--
-- current_user_role() (0001_init.sql:52-57) ist SECURITY DEFINER STABLE und
-- liest die Rolle aus profiles - unabhaengig von der RLS-Sicht des
-- aufrufenden Benutzers auf profiles selbst. Die Identitaetsquelle ist NICHT
-- mehr auth.uid(): 0012_ap14b_platform_auth.sql:320-327 schreibt jede
-- Funktionsdefinition mit auth.uid() auf app.current_user_id() um, und
-- 0013_ap14b_drop_supabase_compat.sql:7-42 bricht ab, falls danach noch eine
-- auth-Referenz verbliebe. In der laufenden Datenbank lautet der Koerper
-- daher `select role from public.profiles where id = app.current_user_id();`
-- (per pg_get_functiondef gegen PostgreSQL 18.4 gelesen). Ohne gesetzte
-- Anwendungsidentitaet liefert sie NULL - genau darauf beruht Schritt 1a.
--
-- Der Waechter deckt INSERT ausdruecklich mit ab. Nur BEFORE UPDATE genuegt
-- nicht: wer Vorgaenge anlegen darf, koennte die Kennzeichnung sonst direkt
-- bei der Anlage setzen und die Regel umgehen. incidents_insert erlaubt INSERT
-- ausschliesslich public.is_staff() (0001_init.sql:542-543), also admin und
-- disponent (0001_init.sql:63-65); ein monteur kann gar nicht anlegen. Die
-- durch die INSERT-Abdeckung zusaetzlich geschuetzte Rolle ist damit admin
-- sowie der Eigentuemer-/Bootstrapkontext.
--
-- Anlagewege im Anwendungscode sind public.create_incident_ap12
-- (0010_ap12_incident_details.sql:83) und der weiterhin vorhandene Vorlaeufer
-- public.create_incident_ap10 (0008_ap10_incident_master_data.sql:74). KEINER
-- der beiden nennt is_false_alarm in seinem `insert into public.incidents`
-- (0010_ap12_incident_details.sql:163-175 bzw.
-- 0008_ap10_incident_master_data.sql:119-129), der Default false greift, und
-- der INSERT-Zweig laesst ihn durch - die Vorgangsanlage bricht also auf
-- keinem der beiden Wege.
--
-- NEUE, ausdruecklich benannte Folge: ein INSERT im Eigentuemer-/
-- Bootstrapkontext mit is_false_alarm = true wird kuenftig mit 42501
-- abgewiesen, weil current_user_role() dort NULL liefert. Geprueft wurden die
-- Fixturepfade: app/supabase/seed.sql setzt is_false_alarm nicht. Der
-- SQL-Smoke app/supabase/test/25_ap15b_incident_metrics.sql setzt die Spalte
-- dagegen sehr wohl - und zwar ABSICHTLICH, weil er genau diesen Waechter
-- prueft: `true` setzt er ausschliesslich unter der Identitaet eines
-- Disponenten (erlaubt) und im Negativfall unter der eines Administrators, wo
-- die Abweisung mit 42501 der erwartete Nachweis ist; den Wert `null` setzt er
-- im Eigentuemerkontext, und dieser Fall laeuft durch, weil der INSERT-Zweig
-- `is distinct from true` prueft. Es gibt damit heute keinen Fixturepfad, der
-- durch die INSERT-Abdeckung UNBEABSICHTIGT bricht.
-- Eine Eigentuemerausnahme nach dem Muster aus 0017 wird BEWUSST NICHT
-- eingefuehrt; das waere eine Erweiterung ueber diesen Scope hinaus.
--
-- SQLSTATE bleibt '42501', weil app/src/lib/incidents.ts (Fehlalarmpfad und
-- Zuweisungspfad) darauf auf PG_INSUFFICIENT_PRIVILEGE abbildet.
create or replace function public.tg_incident_guard_false_alarm()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  -- Verzweigung ueber tg_op statt eines case-Ausdrucks der Form
  -- `case when tg_op = 'INSERT' then false else old.is_false_alarm end`:
  -- ein solcher case wird als EINE SQL-Ausdrucksauswertung mit old als
  -- Parameter ausgefuehrt und schlaegt bei INSERT fehl.
  if tg_op = 'INSERT' then
    -- Anlage OHNE Kennzeichnung bzw. mit false ist fuer JEDE Rolle erlaubt:
    -- die Vorgangsanlage darf nicht brechen. `is distinct from true` deckt
    -- false UND einen ausdruecklich uebergebenen NULL-Wert ab; NULL weist
    -- danach ohnehin die NOT-NULL-Bedingung mit 23502 ab. Auf `old` wird in
    -- diesem Zweig NICHT zugegriffen - bei INSERT ist der Record nicht
    -- zugewiesen und jeder Feldzugriff darauf schlaegt fehl.
    if new.is_false_alarm is distinct from true then
      return new;
    end if;
  else
    -- Keine Aenderung an dieser Spalte in diesem UPDATE: nichts zu pruefen.
    if new.is_false_alarm is not distinct from old.is_false_alarm then
      return new;
    end if;
  end if;

  if public.current_user_role() is distinct from 'disponent' then
    raise exception
      'Die Fehlalarm-Kennzeichnung darf ausschliesslich von der Rolle Disponent gesetzt oder geaendert werden.'
      using errcode = '42501';
  end if;

  return new;
end $$;

drop trigger if exists trg_incident_guard_false_alarm on public.incidents;
create trigger trg_incident_guard_false_alarm
  before insert or update on public.incidents
  for each row execute function public.tg_incident_guard_false_alarm();

-- ---------------------------------------------------------------------
-- 3) View: incident_list_view um is_false_alarm ergaenzen
-- ---------------------------------------------------------------------
-- Vollstaendige Neudefinition (wie bei jeder Aenderung dieser View seit 0009):
-- `create or replace view` verlangt dieselbe Spaltenreihenfolge fuer alle
-- bereits vorhandenen Spalten; neue Spalten duerfen nur am ENDE angehaengt
-- werden. is_false_alarm wird daher ganz am Ende ergaenzt.
-- Quelle dieser Definition: 0011_ap13_tasks_bulk.sql (letzte Neudefinition,
-- fuegte has_open_task hinzu; 0014 aenderte nur GRANT, keine Neudefinition).
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
  i.is_false_alarm
from public.incidents i
left join public.customers c            on c.id = i.customer_id
left join public.construction_stages cs on cs.id = i.construction_stage_id
left join public.vzg_lines vl           on vl.id = i.vzg_line_id
left join public.on_call_numbers ocn    on ocn.id = i.on_call_number_id
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
-- erneutes GRANT hier noetig.

-- =====================================================================
-- Ende Migration 0018
-- =====================================================================
