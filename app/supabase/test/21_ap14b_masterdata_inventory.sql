\set ON_ERROR_STOP on

-- =====================================================================
-- AP14/B - Stammdaten und Inventar unter der Anwendungsrolle app_user mit
-- AKTIVER RLS.
--
-- Erwartet die vollstaendige Kette einschliesslich 0012, 0013, 0014 und 0015
-- sowie die Smokes 19_ap14b_platform.sql, 19a_ap14b_grant_reset.sql und
-- 20_ap14b_data.sql. Diese Datei ist der neue letzte Eintrag der Kette.
--
-- Verbindliche Eigenschaften dieses Smokes:
--   * Er fuehrt selbst KEIN `grant` und KEIN `revoke` aus, aendert keine Policy
--     und schaltet keinen Trigger ab. Er misst ausschliesslich den Rechtestand
--     aus 0014 und 0015 und das Verhalten der bestehenden Policies.
--   * WARUM 0015 in der Kette erst NACH 20_ap14b_data.sql angewendet wird:
--     20_ap14b_data.sql prueft in D18 ausdruecklich NEGATIV, dass app_user
--     KEIN select auf public.inventory_movements und KEIN insert auf
--     public.customers besitzt (20_ap14b_data.sql:927-929). Diese
--     Negativproben belegen den 0014-Stand - sie zeigen, dass die pauschalen
--     Alt-Grants der Smokes 15-18 durch 19a_ap14b_grant_reset.sql wirklich
--     zurueckgenommen sind - und bleiben unveraendert gueltig. Wuerde 0015
--     vorher laufen, wuerde D18 scheitern. Deshalb steht 0015 in beiden
--     Startskripten hinter 20_ap14b_data.sql und vor dieser Datei.
--   * Die Identitaet wird immer transaktionsgebunden mit
--     set_config('app.user_id', ..., true) gesetzt - genau so, wie
--     withUserTransaction() es tut (app/src/lib/db/index.ts). Jeder `do`-Block
--     ist eine eigene Transaktion, die Identitaet endet mit ihm.
--   * Geprueft wird unter `set role app_user` mit aktiver RLS. Der
--     Eigentuemerkontext dient ausschliesslich den Fixtures und den
--     Gegenproben, die app_user gerade NICHT lesen darf (Audit in N14).
--   * Nur synthetische Werte: keine echten Personen, keine echten
--     Telefonnummern, keine Lager-, GPS-/EXIF- oder Zugangsdaten, kein
--     Passwort und kein Hashmaterial.
--   * Gezaehlt wird ausschliesslich RELATIV ueber eigene Kennungen. Kein Fall
--     zaehlt absolut ueber eine ganze Tabelle, damit die Fixtures der Smokes
--     15-20 unberuehrt bleiben.
--
-- Kein Aufraeumen am Dateiende - gleiche Begruendung wie in 20_ap14b_data.sql:
-- beide Startskripte entfernen die temporaere Testdatenbank danach immer. Alle
-- Kennungen tragen den Praefix 21b00000-, der in keiner anderen Testdatei
-- vorkommt (20_ap14b_data.sql benutzt 20b00000-); Namen tragen den Praefix
-- "M21" (Stammdaten) bzw. "N21" (Inventar), E-Mail-Adressen enden auf
-- @beispiel.invalid. Deshalb laeuft die Datei in einer frischen Kette
-- wiederholbar, ohne fremde Fixtures zu beruehren.
-- =====================================================================

reset role;
select set_config('app.user_id', '', false);

-- ---------------------------------------------------------------------
-- Fixtures im Eigentuemerkontext (RLS gilt fuer den Eigentuemer nicht; das ist
-- genau der Grund, weshalb ALLE Pruefungen weiter unten unter
-- `set role app_user` laufen).
--
-- Vier Identitaeten: Admin, Disposition, zugewiesener Monteur, fremder
-- Monteur. Jedes Profil braucht ein Auth-Konto, weil 0012 den Fremdschluessel
-- public.profiles.id auf public.auth_accounts umgehaengt hat.
-- ---------------------------------------------------------------------
-- Das Admin-Konto ...0001 traegt bewusst den Platzhalter
-- '!MIGRATED-ACCOUNT-REQUIRES-RESET!' statt eines Argon2id-artigen Werts.
-- Grund (uebernommen aus 20_ap14b_data.sql:57-71): der Runner startet die
-- Node-Integrationstests in DERSELBEN Datenbank NACH dieser Datei.
-- usableAdminCount() in app/test/integration/ap14b-platform.int.mjs und das
-- Bootstrap-Gate in app/scripts/bootstrap-admin.mjs zaehlen jedes aktive
-- Admin-Profil, dessen password_hash auf '$argon2id$' passt. Ein solcher Wert
-- liesse die Bootstrap-Faelle scheitern, weil sie eine Datenbank ohne
-- anmeldefaehigen Administrator voraussetzen. Der Platzhalter ist projektweit
-- etabliert (0012 fuehrt ihn selbst ein, 19_ap14b_platform.sql toleriert ihn).
-- Dieser Smoke braucht den Hash nicht: die Identitaet wird ueber
-- set_config('app.user_id', ...) gesetzt; von auth_accounts wird nur der
-- Fremdschluessel auf die id gebraucht.
-- Diesen Wert NICHT auf einen '$argon2id$'-Wert zurueckdrehen.
insert into public.auth_accounts (id, email, password_hash, must_change_password)
values
  ('21b00000-0000-0000-0000-000000000001', 'm21.admin@beispiel.invalid', '!MIGRATED-ACCOUNT-REQUIRES-RESET!', false),
  ('21b00000-0000-0000-0000-000000000002', 'm21.dispo@beispiel.invalid', '$argon2id$synthetisch', false),
  ('21b00000-0000-0000-0000-000000000003', 'm21.monteur@beispiel.invalid', '$argon2id$synthetisch', false),
  ('21b00000-0000-0000-0000-000000000004', 'm21.fremd@beispiel.invalid', '$argon2id$synthetisch', false)
on conflict (id) do nothing;

insert into public.profiles (id, full_name, role, is_active)
values
  ('21b00000-0000-0000-0000-000000000001', 'M21 Admin', 'admin', true),
  ('21b00000-0000-0000-0000-000000000002', 'M21 Disposition', 'disponent', true),
  ('21b00000-0000-0000-0000-000000000003', 'M21 Monteur zugewiesen', 'monteur', true),
  ('21b00000-0000-0000-0000-000000000004', 'M21 Monteur fremd', 'monteur', true)
on conflict (id) do nothing;

-- Stammdaten-Fixtures: Bauabschnitt, VzG-Strecke, Kunde, Kabelart und eine
-- Bereitschaftsnummer. Die Bereitschaftsnummer ...a5 wird von M3 als
-- default_on_call_number_id gebraucht; ihr Wert ist bewusst keine Ziffernfolge,
-- die als Rufnummer missverstanden werden koennte.
insert into public.construction_stages (id, code, name)
values ('21b00000-0000-0000-0000-0000000000a1', 'B21', 'M21 Bauabschnitt');

insert into public.vzg_lines (id, line_number, construction_stage_id)
values ('21b00000-0000-0000-0000-0000000000a2', '2121', '21b00000-0000-0000-0000-0000000000a1');

insert into public.customers (id, name)
values ('21b00000-0000-0000-0000-0000000000a3', 'M21 Kunde');

insert into public.cable_types (id, code, name, sort_order)
values ('21b00000-0000-0000-0000-0000000000a4', 'm21-kabel', 'M21 Kabelart', 21);

insert into public.on_call_numbers (id, number, label)
values ('21b00000-0000-0000-0000-0000000000a5', 'M21-0000-0000', 'M21 Bereitschaft Fixture');

-- Ein Vorgang mit Zuweisung des Monteurs ...0003. Er traegt die vorgangs-
-- bezogenen Buchungen aus N6 und ist die Gegenprobe fuer N7.
insert into public.incidents
  (id, construction_stage_id, vzg_line_number, vzg_line_id, km_from, status, description)
values
  ('21b00000-0000-0000-0000-0000000000b1', '21b00000-0000-0000-0000-0000000000a1',
   '2121', '21b00000-0000-0000-0000-0000000000a2', 21.100, 'monteur_zugewiesen',
   'AP14B Stammdaten/Inventar - zugewiesener Vorgang');

insert into public.incident_assignments (incident_id, monteur_id)
values ('21b00000-0000-0000-0000-0000000000b1', '21b00000-0000-0000-0000-000000000003');

-- Inventar-Fixtures: ein Material mit der Einheit 'Meter' (bewusst nicht der
-- Spaltendefault 'Stk', damit N11 die Einheitenherkunft ueberhaupt messen kann)
-- und zwei Lagerorte.
insert into public.materials (id, material_no, name, unit, min_stock)
values ('21b00000-0000-0000-0000-0000000000d1', 'M21-0001', 'N21 Material', 'Meter', 10);

insert into public.storage_locations (id, name, location_type)
values
  ('21b00000-0000-0000-0000-0000000000d2', 'N21 Zentrallager', 'zentrallager'),
  ('21b00000-0000-0000-0000-0000000000d3', 'N21 Fahrzeuglager', 'fahrzeuglager');

-- Anfangsbestand als Wareneingang im EIGENTUEMERKONTEXT, damit die Faelle
-- darunter eine definierte Ausgangslage haben: Zentrallager 100, Fahrzeuglager
-- 40, Gesamtbestand 140. Ohne gesetzte Identitaet bleibt created_by NULL - der
-- fremde Monteur aus N4 ist damit sicher nicht Urheber.
insert into public.inventory_movements
  (id, material_id, quantity, unit, movement_type, target_location_id, note)
values
  ('21b00000-0000-0000-0000-0000000000d4', '21b00000-0000-0000-0000-0000000000d1',
   100, 'Meter', 'wareneingang', '21b00000-0000-0000-0000-0000000000d2',
   'N21 Anfangsbestand Zentrallager'),
  ('21b00000-0000-0000-0000-0000000000d5', '21b00000-0000-0000-0000-0000000000d1',
   40, 'Meter', 'wareneingang', '21b00000-0000-0000-0000-0000000000d3',
   'N21 Anfangsbestand Fahrzeuglager');

-- =====================================================================
-- Ab hier ausschliesslich unter der Anwendungsrolle app_user.
-- =====================================================================
set role app_user;

-- ---------------------------------------------------------------------
-- A) Stammdaten (M1-M11)
--
-- Grundlage der Zeilensichtbarkeit und der Schreibrechte:
--   * on_call_numbers: oncall_select `app.current_user_id() is not null`
--     (0001), oncall_write `is_staff()` (0010:54-56).
--   * construction_stages: stages_select `app.current_user_id() is not null`
--     (0001), stages_write `is_staff()` (0007, Abschnitt 7).
--   * die AP9-Tabellen: `<tabelle>_select` `app.current_user_id() is not null`
--     und `<tabelle>_write` `is_staff()` (0007, Abschnitt 7); fuer contacts,
--     contact_phone_numbers und construction_stage_contacts hat 0010:45-50 das
--     select auf `is_staff()` verengt.
-- ---------------------------------------------------------------------

-- M1: Admin pflegt eine Bereitschaftsnummer - anlegen, aendern, ueber
-- is_active deaktivieren und wieder aktivieren. Entspricht
-- saveOnCallNumber()/setOnCallNumberActive() (masterdata-actions.ts).
do $$
declare
  v_admin uuid := '21b00000-0000-0000-0000-000000000001';
  v_number uuid := '21b00000-0000-0000-0000-0000000000c1';
  v_label text;
  v_active boolean;
begin
  perform set_config('app.user_id', v_admin::text, true);

  insert into public.on_call_numbers (id, number, label, is_active)
  values (v_number, 'M21-0000-0001', 'M21 Bereitschaft eins', true);

  update public.on_call_numbers set label = 'M21 Bereitschaft eins (geaendert)'
   where id = v_number;
  select label into v_label from public.on_call_numbers where id = v_number;
  if v_label is distinct from 'M21 Bereitschaft eins (geaendert)' then
    raise exception 'SMOKE M1 FAIL Aenderung ergibt label=%', coalesce(v_label, 'NULL');
  end if;

  update public.on_call_numbers set is_active = false where id = v_number;
  select is_active into v_active from public.on_call_numbers where id = v_number;
  if v_active is distinct from false then
    raise exception 'SMOKE M1 FAIL Deaktivierung ergibt is_active=%', v_active;
  end if;

  update public.on_call_numbers set is_active = true where id = v_number;
  select is_active into v_active from public.on_call_numbers where id = v_number;
  if v_active is distinct from true then
    raise exception 'SMOKE M1 FAIL Reaktivierung ergibt is_active=%', v_active;
  end if;

  raise notice
    'SMOKE M1 OK Admin legt eine Bereitschaftsnummer an, aendert sie, deaktiviert und aktiviert sie wieder';
end
$$;

-- M2: Die Disposition legt einen Kunden an und aendert ihn. Der Fall belegt,
-- dass fuer die AP9-Stammdaten `is_staff()` gilt und nicht nur `is_admin()`.
do $$
declare
  v_dispo uuid := '21b00000-0000-0000-0000-000000000002';
  v_customer uuid := '21b00000-0000-0000-0000-0000000000c2';
  v_name text;
begin
  perform set_config('app.user_id', v_dispo::text, true);

  insert into public.customers (id, name, erp_id, is_active)
  values (v_customer, 'M21 Kunde Disposition', 'M21-ERP-0002', true);

  update public.customers set name = 'M21 Kunde Disposition (geaendert)'
   where id = v_customer;
  select name into v_name from public.customers where id = v_customer;
  if v_name is distinct from 'M21 Kunde Disposition (geaendert)' then
    raise exception 'SMOKE M2 FAIL Aenderung ergibt name=%', coalesce(v_name, 'NULL');
  end if;

  raise notice 'SMOKE M2 OK Disposition legt einen Kunden an und aendert ihn (is_staff genuegt)';
end
$$;

-- M3: Bauabschnitt anlegen und aendern - einschliesslich der additiven Spalten
-- wus_bst und default_on_call_number_id (0007, Abschnitt 2).
do $$
declare
  v_admin uuid := '21b00000-0000-0000-0000-000000000001';
  v_stage uuid := '21b00000-0000-0000-0000-0000000000c3';
  v_oncall_fixture uuid := '21b00000-0000-0000-0000-0000000000a5';
  v_oncall_m1 uuid := '21b00000-0000-0000-0000-0000000000c1';
  v_name text;
  v_bst text;
  v_default uuid;
begin
  perform set_config('app.user_id', v_admin::text, true);

  insert into public.construction_stages
    (id, code, name, description, wus_bst, default_on_call_number_id, is_active)
  values (v_stage, 'B21-2', 'M21 Bauabschnitt zwei', 'synthetischer Text',
          'M21-BST-1', v_oncall_fixture, true);

  update public.construction_stages
     set name = 'M21 Bauabschnitt zwei (geaendert)',
         wus_bst = 'M21-BST-2',
         default_on_call_number_id = v_oncall_m1
   where id = v_stage;

  select name, wus_bst, default_on_call_number_id
    into v_name, v_bst, v_default
  from public.construction_stages where id = v_stage;

  if v_name is distinct from 'M21 Bauabschnitt zwei (geaendert)'
     or v_bst is distinct from 'M21-BST-2'
     or v_default is distinct from v_oncall_m1 then
    raise exception 'SMOKE M3 FAIL name=% wus_bst=% default_on_call_number_id=%',
      coalesce(v_name, 'NULL'), coalesce(v_bst, 'NULL'), coalesce(v_default::text, 'NULL');
  end if;

  raise notice
    'SMOKE M3 OK Bauabschnitt angelegt und geaendert einschliesslich wus_bst und Bereitschaftsvorgabe';
end
$$;

-- M4: VzG-Strecke anlegen. Negativprobe: dieselbe Streckennummer im selben
-- Bauabschnitt verletzt vzg_lines_stage_number_uq (0007, Abschnitt 3.2) mit
-- SQLSTATE 23505.
do $$
declare
  v_dispo uuid := '21b00000-0000-0000-0000-000000000002';
  v_stage uuid := '21b00000-0000-0000-0000-0000000000c3';
  v_line uuid := '21b00000-0000-0000-0000-0000000000c4';
  v_duplicate uuid := '21b00000-0000-0000-0000-0000000000c5';
  v_rows integer;
begin
  perform set_config('app.user_id', v_dispo::text, true);

  insert into public.vzg_lines (id, line_number, description, construction_stage_id, is_active)
  values (v_line, '2131', 'M21 Strecke', v_stage, true);

  begin
    insert into public.vzg_lines (id, line_number, construction_stage_id)
    values (v_duplicate, '2131', v_stage);
    raise exception 'SMOKE M4 FAIL doppelte Streckennummer im Bauabschnitt wurde angenommen';
  exception
    -- unique_violation ist genau SQLSTATE 23505.
    when unique_violation then null;
  end;

  select count(*) into v_rows
  from public.vzg_lines where construction_stage_id = v_stage and line_number = '2131';
  if v_rows <> 1 then
    raise exception 'SMOKE M4 FAIL % Streckenzeile(n) statt genau einer', v_rows;
  end if;

  raise notice 'SMOKE M4 OK VzG-Strecke angelegt, Doppeleintrag scheitert mit 23505';
end
$$;

-- M5: Kontakt in EINER Transaktion mit zwei Telefonnummern und zwei
-- Bauabschnittszuordnungen. Entspricht saveContact()
-- (masterdata-actions.ts:416-479): ein `insert ... returning id`, danach die
-- vollstaendige Ersetzung beider abhaengigen Mengen.
--
-- Die Kennung wird hier bewusst ausdruecklich mitgegeben UND zurueckgelesen:
-- der Praefix 21b00000- bleibt so erhalten, und der returning-Pfad, der das
-- select auf public.contacts voraussetzt, wird trotzdem ausgeuebt.
do $$
declare
  v_dispo uuid := '21b00000-0000-0000-0000-000000000002';
  v_customer uuid := '21b00000-0000-0000-0000-0000000000a3';
  v_contact uuid := '21b00000-0000-0000-0000-0000000000c6';
  v_stage_a uuid := '21b00000-0000-0000-0000-0000000000a1';
  v_stage_b uuid := '21b00000-0000-0000-0000-0000000000c3';
  v_returned uuid;
  v_phones integer;
  v_stages integer;
begin
  perform set_config('app.user_id', v_dispo::text, true);

  insert into public.contacts (id, customer_id, name, "function", email, is_active)
  values (v_contact, v_customer, 'M21 Kontakt', 'M21 Funktion',
          'm21.kontakt@beispiel.invalid', true)
  returning id into v_returned;
  if v_returned is distinct from v_contact then
    raise exception 'SMOKE M5 FAIL returning liefert % statt %', v_returned, v_contact;
  end if;

  -- Vollstaendige Ersetzung: erst leeren, dann setzen. Die Telefonnummern sind
  -- offensichtlich synthetische Ziffernfolgen und keine erreichbaren Nummern.
  delete from public.contact_phone_numbers where contact_id = v_contact;
  insert into public.contact_phone_numbers (id, contact_id, phone, phone_type, sort_order)
  values
    ('21b00000-0000-0000-0000-0000000000c7', v_contact, '000-21-000001', 'mobil', 0),
    ('21b00000-0000-0000-0000-0000000000c8', v_contact, '000-21-000002', 'festnetz', 1);

  delete from public.construction_stage_contacts where contact_id = v_contact;
  insert into public.construction_stage_contacts (id, contact_id, construction_stage_id)
  values
    ('21b00000-0000-0000-0000-0000000000c9', v_contact, v_stage_a),
    ('21b00000-0000-0000-0000-0000000000ca', v_contact, v_stage_b);

  select count(*) into v_phones
  from public.contact_phone_numbers where contact_id = v_contact;
  select count(*) into v_stages
  from public.construction_stage_contacts where contact_id = v_contact;
  if v_phones <> 2 or v_stages <> 2 then
    raise exception 'SMOKE M5 FAIL nummern=% zuordnungen=%, erwartet je 2', v_phones, v_stages;
  end if;

  raise notice
    'SMOKE M5 OK Kontakt mit zwei Nummern und zwei Bauabschnittszuordnungen in einer Transaktion';
end
$$;

-- M6: ATOMARITAET - ein Fehler im zweiten Schritt hinterlaesst keinen
-- Teilstand.
--
-- Nachgestellt wird genau der Ablauf aus saveContact(): erst werden die
-- Telefonnummern des Kontakts geloescht, dann sollen die neuen eingefuegt
-- werden. Der zweite Schritt scheitert hier absichtlich an einer nicht
-- existierenden contact_id (Fremdschluesselverletzung, SQLSTATE 23503). Der
-- innere `begin ... exception ... end`-Block ist in PL/pgSQL ein Savepoint;
-- seine Ruecknahme entspricht dem Rollback, den withUserTransaction() im
-- Fehlerfall ausfuehrt. Danach muessen die zwei Nummern aus M5 UNVERAENDERT
-- vorhanden sein.
--
-- `when others` ist hier Absicht (der Auftrag verlangt es), wird aber nicht
-- blind verwendet: der aufgefangene SQLSTATE wird festgehalten und geprueft.
-- Ein anderer Fehler als 23503 laesst den Fall scheitern.
do $$
declare
  v_dispo uuid := '21b00000-0000-0000-0000-000000000002';
  v_contact uuid := '21b00000-0000-0000-0000-0000000000c6';
  v_unknown uuid := '21b00000-0000-0000-0000-0000000000cf';
  v_state text := null;
  v_reached boolean := false;
  v_phones integer;
  v_matching integer;
begin
  perform set_config('app.user_id', v_dispo::text, true);

  begin
    delete from public.contact_phone_numbers where contact_id = v_contact;
    insert into public.contact_phone_numbers (contact_id, phone, phone_type, sort_order)
    values (v_unknown, '000-21-000003', 'mobil', 0);
    v_reached := true;
  exception
    when others then
      v_state := sqlstate;
  end;

  if v_reached then
    raise exception 'SMOKE M6 FAIL der erzwungene Fehler ist nicht eingetreten';
  end if;
  -- foreign_key_violation ist genau SQLSTATE 23503.
  if v_state is distinct from '23503' then
    raise exception 'SMOKE M6 FAIL erwarteter SQLSTATE 23503, erhalten %',
      coalesce(v_state, 'NULL');
  end if;

  select count(*),
         count(*) filter (where phone in ('000-21-000001', '000-21-000002'))
    into v_phones, v_matching
  from public.contact_phone_numbers where contact_id = v_contact;
  if v_phones <> 2 or v_matching <> 2 then
    raise exception
      'SMOKE M6 FAIL Teilstand nach dem Fehler: % Nummer(n), davon % erwartete',
      v_phones, v_matching;
  end if;

  raise notice
    'SMOKE M6 OK Fehler im zweiten Schritt nimmt das Loeschen zurueck, beide Nummern bestehen unveraendert';
end
$$;

-- M7: Techniker und Teams.
--
-- Techniker: anlegen, aendern, deaktivieren (kein delete - die Rechtematrix
-- vergibt keines, siehe N15). Team: anlegen und in EINER Transaktion zwei
-- Mitglieder setzen, danach die Mitgliedschaft vollstaendig auf ein Mitglied
-- ersetzen (delete + insert), genau wie saveTeam()
-- (masterdata-actions.ts:661-684).
do $$
declare
  v_dispo uuid := '21b00000-0000-0000-0000-000000000002';
  v_tech_cycle uuid := '21b00000-0000-0000-0000-0000000000e1';
  v_tech_a uuid := '21b00000-0000-0000-0000-0000000000e2';
  v_tech_b uuid := '21b00000-0000-0000-0000-0000000000e3';
  v_team uuid := '21b00000-0000-0000-0000-0000000000e4';
  v_last_name text;
  v_active boolean;
  v_members integer;
  v_remaining integer;
begin
  perform set_config('app.user_id', v_dispo::text, true);

  insert into public.technicians (id, first_name, last_name, is_active)
  values
    (v_tech_cycle, 'M21', 'Techniker Lebenszyklus', true),
    (v_tech_a, 'M21', 'Techniker A', true),
    (v_tech_b, 'M21', 'Techniker B', true);

  update public.technicians set last_name = 'Techniker Lebenszyklus (geaendert)'
   where id = v_tech_cycle;
  update public.technicians set is_active = false where id = v_tech_cycle;
  select last_name, is_active into v_last_name, v_active
  from public.technicians where id = v_tech_cycle;
  if v_last_name is distinct from 'Techniker Lebenszyklus (geaendert)'
     or v_active is distinct from false then
    raise exception 'SMOKE M7 FAIL Techniker last_name=% is_active=%',
      coalesce(v_last_name, 'NULL'), v_active;
  end if;

  insert into public.teams (id, name, is_active)
  values (v_team, 'M21 Team', true);

  -- Erste Belegung: zwei Mitglieder, vollstaendig gesetzt.
  delete from public.team_members where team_id = v_team;
  insert into public.team_members (id, team_id, technician_id)
  values
    ('21b00000-0000-0000-0000-0000000000e5', v_team, v_tech_a),
    ('21b00000-0000-0000-0000-0000000000e6', v_team, v_tech_b);

  select count(*) into v_members from public.team_members where team_id = v_team;
  if v_members <> 2 then
    raise exception 'SMOKE M7 FAIL erste Belegung ergibt % Mitglied(er) statt 2', v_members;
  end if;

  -- Vollstaendige Ersetzung auf ein Mitglied.
  delete from public.team_members where team_id = v_team;
  insert into public.team_members (id, team_id, technician_id)
  values ('21b00000-0000-0000-0000-0000000000e7', v_team, v_tech_a);

  select count(*),
         count(*) filter (where technician_id = v_tech_a)
    into v_remaining, v_members
  from public.team_members where team_id = v_team;
  if v_remaining <> 1 or v_members <> 1 then
    raise exception 'SMOKE M7 FAIL Ersetzung ergibt % Mitglied(er), davon % erwartete',
      v_remaining, v_members;
  end if;

  raise notice
    'SMOKE M7 OK Techniker angelegt/geaendert/deaktiviert, Teammitgliedschaft vollstaendig ersetzt (2 -> 1)';
end
$$;

-- M8: Kabelart anlegen und die Anwendungseinstellungen als Upsert auf id = 1
-- schreiben. Entspricht saveSettings() (masterdata-actions.ts:761-768): genau
-- ein `insert ... on conflict (id) do update`, das insert UND update braucht.
do $$
declare
  v_dispo uuid := '21b00000-0000-0000-0000-000000000002';
  v_cable uuid := '21b00000-0000-0000-0000-0000000000e8';
  v_customer uuid := '21b00000-0000-0000-0000-0000000000a3';
  v_oncall uuid := '21b00000-0000-0000-0000-0000000000a5';
  v_code text;
  v_read_customer uuid;
  v_read_oncall uuid;
begin
  perform set_config('app.user_id', v_dispo::text, true);

  insert into public.cable_types (id, code, name, sort_order, is_active)
  values (v_cable, 'm21-kabel-2', 'M21 Kabelart zwei', 22, true);
  select code into v_code from public.cable_types where id = v_cable;
  if v_code is distinct from 'm21-kabel-2' then
    raise exception 'SMOKE M8 FAIL Kabelart code=%', coalesce(v_code, 'NULL');
  end if;

  insert into public.app_settings (id, default_customer_id, default_on_call_number_id)
  values (1, v_customer, v_oncall)
  on conflict (id) do update
     set default_customer_id = excluded.default_customer_id,
         default_on_call_number_id = excluded.default_on_call_number_id;

  select default_customer_id, default_on_call_number_id
    into v_read_customer, v_read_oncall
  from public.app_settings where id = 1;
  if v_read_customer is distinct from v_customer or v_read_oncall is distinct from v_oncall then
    raise exception 'SMOKE M8 FAIL Einstellungen kunde=% bereitschaft=%',
      coalesce(v_read_customer::text, 'NULL'), coalesce(v_read_oncall::text, 'NULL');
  end if;

  raise notice 'SMOKE M8 OK Kabelart angelegt, Einstellungen als Upsert geschrieben und zurueckgelesen';
end
$$;

-- M9: MONTEUR NEGATIV - kein Stammdatenschreibrecht.
--
-- Die Abweisung kommt NICHT aus dem Tabellenrecht: app_user ist dieselbe Rolle
-- fuer alle Identitaeten und besitzt insert auf allen neun Objekten (0015).
-- Massgeblich ist allein die Policy `<tabelle>_write` mit `is_staff()` bzw.
-- oncall_write/stages_write - jeder Versuch endet mit 42501.
--
-- Die Anweisungen stehen als feste Zeichenketten in einem Array; es gelangt
-- kein Eingabewert in den Anweisungstext. Der letzte Fall benutzt genau die
-- Anweisung aus saveSettings(), also den Upsert auf id = 1. Beide moeglichen
-- Wege enden dort mit 42501: die INSERT-WITH-CHECK-Pruefung greift vor dem
-- Index-Eintrag, und selbst wenn der Konflikt zuerst erkannt wuerde, weist
-- PostgreSQL ein DO UPDATE auf eine fuer diese Identitaet unsichtbare Zeile
-- ebenfalls mit 42501 ab. Die Singletonbedingung `id = 1` wird dabei nicht
-- verletzt.
do $$
declare
  v_monteur uuid := '21b00000-0000-0000-0000-000000000003';
  v_statement text;
  v_wrong text[] := array[]::text[];
begin
  perform set_config('app.user_id', v_monteur::text, true);

  foreach v_statement in array array[
    'insert into public.customers (name) values (''M21 Monteurversuch Kunde'')',
    'insert into public.construction_stages (code, name) '
      || 'values (''B21-M'', ''M21 Monteurversuch Bauabschnitt'')',
    'insert into public.vzg_lines (line_number, construction_stage_id) '
      || 'values (''2141'', ''21b00000-0000-0000-0000-0000000000a1'')',
    'insert into public.contacts (customer_id, name) '
      || 'values (''21b00000-0000-0000-0000-0000000000a3'', ''M21 Monteurversuch Kontakt'')',
    'insert into public.technicians (first_name, last_name) '
      || 'values (''M21'', ''Monteurversuch'')',
    'insert into public.teams (name) values (''M21 Monteurversuch Team'')',
    'insert into public.cable_types (code, name) '
      || 'values (''m21-monteurversuch'', ''M21 Monteurversuch Kabelart'')',
    'insert into public.on_call_numbers (number) values (''M21-0000-0009'')',
    'insert into public.app_settings (id, default_customer_id, default_on_call_number_id) '
      || 'values (1, null, null) on conflict (id) do update '
      || 'set default_customer_id = excluded.default_customer_id, '
      || 'default_on_call_number_id = excluded.default_on_call_number_id'
  ]
  loop
    begin
      execute v_statement;
      v_wrong := array_append(v_wrong, v_statement);
    exception
      -- insufficient_privilege ist genau SQLSTATE 42501.
      when insufficient_privilege then null;
    end;
  end loop;

  if array_length(v_wrong, 1) is not null then
    raise exception 'SMOKE M9 FAIL Monteur darf schreiben: %', array_to_string(v_wrong, ' | ');
  end if;

  raise notice 'SMOKE M9 OK neun Stammdaten-Schreibversuche des Monteurs enden mit 42501';
end
$$;

-- M10: MONTEUR LESEN - die Sichtbarkeit bleibt unveraendert.
--
-- Zwei unterschiedliche Ist-Zustaende, die auseinandergehalten werden muessen:
--   * contacts, contact_phone_numbers und construction_stage_contacts liefern
--     dem Monteur KEINE Zeile: 0010:45-50 hat die Select-Policy dieser drei
--     Tabellen auf `is_staff()` verengt. Die vorgangsbezogene Projektion laeuft
--     ausschliesslich ueber public.get_assigned_incident_contact(uuid).
--   * technicians, teams und team_members tragen unveraendert die AP9-Policy
--     `<tabelle>_select` mit "jede angemeldete Identitaet"
--     (0007, Abschnitt 7). Der Monteur SIEHT diese Zeilen also. Dieser
--     Ist-Zustand wird hier ausdruecklich festgehalten und NICHT geaendert: die
--     Policy ist nicht Gegenstand dieses Auftrags, und kein Anwendungspfad
--     fuehrt einen Monteur dorthin - die Stammdatenseiten sind staff-gesperrt
--     (requireStaff() in masterdata-actions.ts).
do $$
declare
  v_monteur uuid := '21b00000-0000-0000-0000-000000000003';
  v_contact uuid := '21b00000-0000-0000-0000-0000000000c6';
  v_team uuid := '21b00000-0000-0000-0000-0000000000e4';
  v_contacts integer;
  v_phones integer;
  v_csc integer;
  v_technicians integer;
  v_teams integer;
  v_members integer;
begin
  perform set_config('app.user_id', v_monteur::text, true);

  select count(*) into v_contacts from public.contacts where id = v_contact;
  select count(*) into v_phones
  from public.contact_phone_numbers where contact_id = v_contact;
  select count(*) into v_csc
  from public.construction_stage_contacts where contact_id = v_contact;
  if v_contacts <> 0 or v_phones <> 0 or v_csc <> 0 then
    raise exception
      'SMOKE M10 FAIL Monteur sieht kontakte=% nummern=% zuordnungen=%, erwartet je 0',
      v_contacts, v_phones, v_csc;
  end if;

  select count(*) into v_technicians
  from public.technicians
  where id in ('21b00000-0000-0000-0000-0000000000e1',
               '21b00000-0000-0000-0000-0000000000e2',
               '21b00000-0000-0000-0000-0000000000e3');
  select count(*) into v_teams from public.teams where id = v_team;
  select count(*) into v_members from public.team_members where team_id = v_team;
  if v_technicians <> 3 or v_teams <> 1 or v_members <> 1 then
    raise exception
      'SMOKE M10 FAIL unveraenderte AP9-Sicht erwartet 3/1/1, gemessen %/%/%',
      v_technicians, v_teams, v_members;
  end if;

  raise notice
    'SMOKE M10 OK Monteur sieht keine Ansprechpartnerdaten; Techniker/Teams/Mitglieder bleiben nach unveraenderter AP9-Policy sichtbar (3/1/1)';
end
$$;

-- M11: OHNE IDENTITAET bleibt alles zu (fail-closed).
--
-- Ohne app.user_id liefert app.current_user_id() NULL (0012:9-26). Damit ist
-- customers_select `app.current_user_id() is not null` unerfuellt, und
-- is_staff() ist `coalesce(..., false)` - also false, nicht NULL.
do $$
declare
  v_rows integer;
begin
  perform set_config('app.user_id', '', true);

  select count(*) into v_rows
  from public.customers where id = '21b00000-0000-0000-0000-0000000000a3';
  if v_rows <> 0 then
    raise exception 'SMOKE M11 FAIL ohne Identitaet sind % Kundenzeile(n) sichtbar', v_rows;
  end if;

  begin
    insert into public.customers (name) values ('M21 Kunde ohne Identitaet');
    raise exception 'SMOKE M11 FAIL ohne Identitaet wurde ein Kunde angelegt';
  exception
    when insufficient_privilege then null;
  end;

  raise notice 'SMOKE M11 OK ohne Identitaet keine Zeile und kein Schreibzugriff (fail-closed)';
end
$$;

-- ---------------------------------------------------------------------
-- B) Inventar (N1-N15)
--
-- Grundlage:
--   * materials_write und locations_write fordern `is_admin()` (0001) - hier
--     genuegt Staff also NICHT, anders als bei den Stammdaten oben.
--   * movements_select: `is_staff() or created_by = app.current_user_id() or
--     (incident_id is not null and is_assigned_to_incident(incident_id))`
--     (0001).
--   * movements_insert: Staff frei, Nichtstaff nur 'entnahme_vorgang' und
--     'rueckgabe' mit Vorgangsbezug und Zuweisung (0001); dazu additiv
--     movements_insert_monteur_verbrauch fuer 'verbrauch' mit Quelllager und
--     Zuweisung (0004).
--   * Bestandsschutz: der SECURITY-DEFINER-Trigger trg_inventory_nonneg
--     (0001) wertet stets alle Bewegungen aus, unabhaengig von RLS.
--
-- Ausgangslage aus den Fixtures: Zentrallager ...d2 = 100, Fahrzeuglager
-- ...d3 = 40, Gesamtbestand 140 (Einheit 'Meter').
-- ---------------------------------------------------------------------

-- N1: Admin pflegt Material und Lagerort. Material: anlegen, aendern,
-- deaktivieren, wieder aktivieren (kein delete - siehe N15). Beide Objekte
-- bleiben ohne Bewegung und veraendern den Bestand deshalb nicht.
do $$
declare
  v_admin uuid := '21b00000-0000-0000-0000-000000000001';
  v_material uuid := '21b00000-0000-0000-0000-0000000000f1';
  v_location uuid := '21b00000-0000-0000-0000-0000000000f2';
  v_name text;
  v_active boolean;
  v_type public.storage_location_type;
begin
  perform set_config('app.user_id', v_admin::text, true);

  insert into public.materials (id, material_no, name, unit, category, min_stock, is_active)
  values (v_material, 'M21-0002', 'N21 Material zwei', 'Stk', 'N21 Kategorie', 5, true);

  update public.materials set name = 'N21 Material zwei (geaendert)', min_stock = 7
   where id = v_material;
  select name into v_name from public.materials where id = v_material;
  if v_name is distinct from 'N21 Material zwei (geaendert)' then
    raise exception 'SMOKE N1 FAIL Material name=%', coalesce(v_name, 'NULL');
  end if;

  update public.materials set is_active = false where id = v_material;
  select is_active into v_active from public.materials where id = v_material;
  if v_active is distinct from false then
    raise exception 'SMOKE N1 FAIL Material Deaktivierung ergibt is_active=%', v_active;
  end if;
  update public.materials set is_active = true where id = v_material;
  select is_active into v_active from public.materials where id = v_material;
  if v_active is distinct from true then
    raise exception 'SMOKE N1 FAIL Material Reaktivierung ergibt is_active=%', v_active;
  end if;

  insert into public.storage_locations (id, name, location_type, note, is_active)
  values (v_location, 'N21 Baustellenlager', 'baustellenlager', 'synthetischer Text', true);

  update public.storage_locations
     set name = 'N21 Baustellenlager (geaendert)',
         location_type = 'materialcontainer'
   where id = v_location;
  select name, location_type into v_name, v_type
  from public.storage_locations where id = v_location;
  if v_name is distinct from 'N21 Baustellenlager (geaendert)'
     or v_type is distinct from 'materialcontainer' then
    raise exception 'SMOKE N1 FAIL Lagerort name=% typ=%', coalesce(v_name, 'NULL'), v_type;
  end if;

  raise notice
    'SMOKE N1 OK Admin pflegt Material (anlegen/aendern/deaktivieren/aktivieren) und Lagerort';
end
$$;

-- N2: NEGATIV Rolle - Material und Lagerort sind Admin-Sache.
--
-- Geprueft wird der INSERT und nicht der UPDATE: ein UPDATE scheitert bei
-- verletzter USING-Klausel nicht, es trifft nur keine Zeile. Der INSERT dagegen
-- verletzt die WITH-CHECK-Klausel von materials_write/locations_write
-- (`is_admin()`) und endet mit 42501 - bei der Disposition genauso wie beim
-- Monteur.
do $$
declare
  v_identity uuid;
  v_statement text;
  v_wrong text[] := array[]::text[];
begin
  foreach v_identity in array array[
    '21b00000-0000-0000-0000-000000000002'::uuid,
    '21b00000-0000-0000-0000-000000000003'::uuid
  ]
  loop
    perform set_config('app.user_id', v_identity::text, true);

    foreach v_statement in array array[
      'insert into public.materials (name) values (''N21 Versuch Material'')',
      'insert into public.storage_locations (name, location_type) '
        || 'values (''N21 Versuch Lagerort'', ''zentrallager'')'
    ]
    loop
      begin
        execute v_statement;
        v_wrong := array_append(v_wrong, v_identity::text || ': ' || v_statement);
      exception
        when insufficient_privilege then null;
      end;
    end loop;
  end loop;

  if array_length(v_wrong, 1) is not null then
    raise exception 'SMOKE N2 FAIL nicht-Admin darf schreiben: %',
      array_to_string(v_wrong, ' | ');
  end if;

  raise notice
    'SMOKE N2 OK Disposition und Monteur scheitern bei Material und Lagerort mit 42501';
end
$$;

-- N3: Bestandsliste ausschliesslich aus public.material_stock.
--
-- Gerechnet wird relativ ueber die eigene Materialkennung. Die View ist bewusst
-- keine security_invoker-View (0001) - sie liefert deshalb den vollen Bestand,
-- und ein Basistabellenrecht braucht dieser Lesepfad nicht.
do $$
declare
  v_dispo uuid := '21b00000-0000-0000-0000-000000000002';
  v_material uuid := '21b00000-0000-0000-0000-0000000000d1';
  v_central uuid := '21b00000-0000-0000-0000-0000000000d2';
  v_vehicle uuid := '21b00000-0000-0000-0000-0000000000d3';
  v_total numeric;
  v_c numeric;
  v_v numeric;
begin
  perform set_config('app.user_id', v_dispo::text, true);

  select coalesce(sum(quantity), 0) into v_total
  from public.material_stock where material_id = v_material;
  select coalesce(sum(quantity), 0) into v_c
  from public.material_stock where material_id = v_material and location_id = v_central;
  select coalesce(sum(quantity), 0) into v_v
  from public.material_stock where material_id = v_material and location_id = v_vehicle;

  if v_total <> 140 or v_c <> 100 or v_v <> 40 then
    raise exception
      'SMOKE N3 FAIL Bestand gesamt=% zentral=% fahrzeug=%, erwartet 140/100/40',
      v_total, v_c, v_v;
  end if;

  raise notice 'SMOKE N3 OK Bestandsliste liefert 140 (100 zentral, 40 Fahrzeug)';
end
$$;

-- N4: Bewegungsverlauf - Staff sieht die Chronik, der fremde Monteur nicht.
--
-- Der fremde Monteur ...0004 erfuellt keinen der drei Zweige von
-- movements_select: er ist kein Staff, die beiden Fixture-Bewegungen tragen
-- created_by NULL, und einen Vorgangsbezug haben sie nicht.
do $$
declare
  v_dispo uuid := '21b00000-0000-0000-0000-000000000002';
  v_fremd uuid := '21b00000-0000-0000-0000-000000000004';
  v_material uuid := '21b00000-0000-0000-0000-0000000000d1';
  v_staff integer;
  v_other integer;
begin
  perform set_config('app.user_id', v_dispo::text, true);
  select count(*) into v_staff
  from public.inventory_movements where material_id = v_material;

  perform set_config('app.user_id', v_fremd::text, true);
  select count(*) into v_other
  from public.inventory_movements where material_id = v_material;

  if v_staff <> 2 then
    raise exception 'SMOKE N4 FAIL Disposition sieht % Bewegung(en) statt 2', v_staff;
  end if;
  if v_other <> 0 then
    raise exception 'SMOKE N4 FAIL fremder Monteur sieht % Bewegung(en) statt 0', v_other;
  end if;

  raise notice 'SMOKE N4 OK Disposition sieht 2 Bewegungen, fremder Monteur keine';
end
$$;

-- N5: Alle fuenf Bewegungsarten der Staff-Rolle.
--
-- Entspricht createMovement() (inventory-actions.ts:291-357) samt ADMIN_MOVEMENTS.
-- Die Einheit wird wie dort aus public.materials gelesen und nicht aus der
-- Eingabe uebernommen. Die Mengen sind so gewaehlt, dass kein Lagerort
-- negativ wird:
--   +10 Zugang zentral      -> zentral 110
--   -15 Umbuchung zum Fzg   -> zentral  95, Fahrzeug 55
--    +5 Korrektur zentral   -> zentral 100
--    -3 Verlust zentral     -> zentral  97
--    -2 Beschaedigung       -> zentral  95
-- Erwartet danach: zentral 95, Fahrzeug 55, gesamt 150.
do $$
declare
  v_dispo uuid := '21b00000-0000-0000-0000-000000000002';
  v_material uuid := '21b00000-0000-0000-0000-0000000000d1';
  v_central uuid := '21b00000-0000-0000-0000-0000000000d2';
  v_vehicle uuid := '21b00000-0000-0000-0000-0000000000d3';
  v_unit text;
  v_total numeric;
  v_c numeric;
  v_v numeric;
begin
  perform set_config('app.user_id', v_dispo::text, true);

  select unit into v_unit from public.materials where id = v_material;
  if v_unit is null then
    raise exception 'SMOKE N5 FAIL Materialeinheit nicht lesbar';
  end if;

  insert into public.inventory_movements
    (id, material_id, quantity, unit, movement_type, source_location_id,
     target_location_id, note)
  values
    ('21b00000-0000-0000-0000-000000000101', v_material, 10, v_unit,
     'wareneingang', null, v_central, 'N21 N5 Wareneingang'),
    ('21b00000-0000-0000-0000-000000000102', v_material, 15, v_unit,
     'umbuchung', v_central, v_vehicle, 'N21 N5 Umbuchung'),
    ('21b00000-0000-0000-0000-000000000103', v_material, 5, v_unit,
     'korrektur', null, v_central, 'N21 N5 Korrektur'),
    ('21b00000-0000-0000-0000-000000000104', v_material, 3, v_unit,
     'verlust', v_central, null, 'N21 N5 Verlust'),
    ('21b00000-0000-0000-0000-000000000105', v_material, 2, v_unit,
     'beschaedigung', v_central, null, 'N21 N5 Beschaedigung');

  select coalesce(sum(quantity), 0) into v_total
  from public.material_stock where material_id = v_material;
  select coalesce(sum(quantity), 0) into v_c
  from public.material_stock where material_id = v_material and location_id = v_central;
  select coalesce(sum(quantity), 0) into v_v
  from public.material_stock where material_id = v_material and location_id = v_vehicle;

  if v_total <> 150 or v_c <> 95 or v_v <> 55 then
    raise exception
      'SMOKE N5 FAIL Bestand gesamt=% zentral=% fahrzeug=%, erwartet 150/95/55',
      v_total, v_c, v_v;
  end if;

  raise notice
    'SMOKE N5 OK fuenf Staff-Bewegungsarten gebucht, Bestand 150 (95 zentral, 55 Fahrzeug)';
end
$$;

-- N6: Die drei vorgangsbezogenen Bewegungsarten des ZUGEWIESENEN Monteurs.
--
-- 'entnahme_vorgang' und 'rueckgabe' stammen aus movements_insert (0001),
-- 'verbrauch' aus der additiven Policy movements_insert_monteur_verbrauch
-- (0004). Erwartet danach: zentral 79 (95 - 20 + 8 - 4), Fahrzeug 55,
-- gesamt 134.
do $$
declare
  v_monteur uuid := '21b00000-0000-0000-0000-000000000003';
  v_material uuid := '21b00000-0000-0000-0000-0000000000d1';
  v_central uuid := '21b00000-0000-0000-0000-0000000000d2';
  v_incident uuid := '21b00000-0000-0000-0000-0000000000b1';
  v_unit text;
  v_total numeric;
  v_c numeric;
begin
  perform set_config('app.user_id', v_monteur::text, true);

  select unit into v_unit from public.materials where id = v_material;

  insert into public.inventory_movements
    (id, material_id, quantity, unit, movement_type, source_location_id,
     target_location_id, incident_id, note)
  values
    ('21b00000-0000-0000-0000-000000000106', v_material, 20, v_unit,
     'entnahme_vorgang', v_central, null, v_incident, 'N21 N6 Entnahme'),
    ('21b00000-0000-0000-0000-000000000107', v_material, 8, v_unit,
     'rueckgabe', null, v_central, v_incident, 'N21 N6 Rueckgabe'),
    ('21b00000-0000-0000-0000-000000000108', v_material, 4, v_unit,
     'verbrauch', v_central, null, v_incident, 'N21 N6 Verbrauch');

  select coalesce(sum(quantity), 0) into v_total
  from public.material_stock where material_id = v_material;
  select coalesce(sum(quantity), 0) into v_c
  from public.material_stock where material_id = v_material and location_id = v_central;

  if v_total <> 134 or v_c <> 79 then
    raise exception 'SMOKE N6 FAIL Bestand gesamt=% zentral=%, erwartet 134/79', v_total, v_c;
  end if;

  raise notice
    'SMOKE N6 OK zugewiesener Monteur bucht Entnahme, Rueckgabe und Verbrauch, Bestand 134 (79 zentral)';
end
$$;

-- N7: NEGATIV fremder Monteur - eine Entnahme auf einen Vorgang ohne Zuweisung
-- scheitert mit 42501. Die Menge ist bewusst klein, damit der Bestandswaechter
-- (BEFORE-Trigger) nicht vorher greift und die Abweisung wirklich aus der
-- Policy kommt.
do $$
declare
  v_fremd uuid := '21b00000-0000-0000-0000-000000000004';
  v_material uuid := '21b00000-0000-0000-0000-0000000000d1';
  v_central uuid := '21b00000-0000-0000-0000-0000000000d2';
  v_incident uuid := '21b00000-0000-0000-0000-0000000000b1';
begin
  perform set_config('app.user_id', v_fremd::text, true);

  begin
    insert into public.inventory_movements
      (material_id, quantity, unit, movement_type, source_location_id, incident_id, note)
    values (v_material, 1, 'Meter', 'entnahme_vorgang', v_central, v_incident,
            'N21 N7 Entnahme ohne Zuweisung');
    raise exception 'SMOKE N7 FAIL fremder Monteur bucht eine Entnahme auf einen fremden Vorgang';
  exception
    when insufficient_privilege then null;
  end;

  raise notice 'SMOKE N7 OK Entnahme ohne Zuweisung scheitert mit 42501';
end
$$;

-- N8: NEGATIV unzulaessige Bewegungsart - 'wareneingang' ist Staff-Sache.
-- Der Monteur erfuellt keinen Zweig von movements_insert und auch nicht die
-- Verbrauchs-Policy aus 0004; erwartet wird 42501.
do $$
declare
  v_monteur uuid := '21b00000-0000-0000-0000-000000000003';
  v_material uuid := '21b00000-0000-0000-0000-0000000000d1';
  v_central uuid := '21b00000-0000-0000-0000-0000000000d2';
begin
  perform set_config('app.user_id', v_monteur::text, true);

  begin
    insert into public.inventory_movements
      (material_id, quantity, unit, movement_type, target_location_id, note)
    values (v_material, 1, 'Meter', 'wareneingang', v_central,
            'N21 N8 Wareneingang als Monteur');
    raise exception 'SMOKE N8 FAIL Monteur bucht einen Wareneingang';
  exception
    when insufficient_privilege then null;
  end;

  raise notice 'SMOKE N8 OK Wareneingang des Monteurs scheitert mit 42501 (movements_insert)';
end
$$;

-- N9: NEGATIV Menge - die Spaltenbedingung `check (quantity > 0)` (0001) laesst
-- weder 0 noch einen negativen Wert zu (SQLSTATE 23514). Gebucht wird als Staff
-- mit reinem Zielbezug, damit weder RLS noch der Bestandswaechter die Ursache
-- verdecken koennen.
do $$
declare
  v_dispo uuid := '21b00000-0000-0000-0000-000000000002';
  v_material uuid := '21b00000-0000-0000-0000-0000000000d1';
  v_central uuid := '21b00000-0000-0000-0000-0000000000d2';
  v_quantity numeric;
  v_wrong text[] := array[]::text[];
begin
  perform set_config('app.user_id', v_dispo::text, true);

  foreach v_quantity in array array[0::numeric, -5::numeric]
  loop
    begin
      insert into public.inventory_movements
        (material_id, quantity, unit, movement_type, target_location_id, note)
      values (v_material, v_quantity, 'Meter', 'wareneingang', v_central,
              'N21 N9 unzulaessige Menge');
      v_wrong := array_append(v_wrong, v_quantity::text);
    exception
      -- check_violation ist genau SQLSTATE 23514.
      when check_violation then null;
    end;
  end loop;

  if array_length(v_wrong, 1) is not null then
    raise exception 'SMOKE N9 FAIL angenommene Menge(n): %', array_to_string(v_wrong, ', ');
  end if;

  raise notice 'SMOKE N9 OK Menge 0 und -5 scheitern an der Check-Bedingung (23514)';
end
$$;

-- N10: BESTANDSWAECHTER - eine Buchung ueber den vorhandenen Bestand hinaus
-- scheitert mit 23514 aus public.check_inventory_nonnegative() (0001), und der
-- Bestand bleibt unveraendert. Gebucht wird als Staff, damit die Abweisung
-- eindeutig vom Trigger und nicht von einer Policy stammt.
do $$
declare
  v_dispo uuid := '21b00000-0000-0000-0000-000000000002';
  v_material uuid := '21b00000-0000-0000-0000-0000000000d1';
  v_vehicle uuid := '21b00000-0000-0000-0000-0000000000d3';
  v_before numeric;
  v_after numeric;
begin
  perform set_config('app.user_id', v_dispo::text, true);

  select coalesce(sum(quantity), 0) into v_before
  from public.material_stock where material_id = v_material;

  begin
    insert into public.inventory_movements
      (material_id, quantity, unit, movement_type, source_location_id, note)
    values (v_material, 10000, 'Meter', 'verlust', v_vehicle,
            'N21 N10 Abgang ueber den Bestand hinaus');
    raise exception 'SMOKE N10 FAIL Abgang ueber den Bestand hinaus wurde gebucht';
  exception
    when check_violation then null;
  end;

  select coalesce(sum(quantity), 0) into v_after
  from public.material_stock where material_id = v_material;
  if v_after <> v_before or v_after <> 134 then
    raise exception 'SMOKE N10 FAIL Bestand vorher=% nachher=%, erwartet unveraendert 134',
      v_before, v_after;
  end if;

  raise notice 'SMOKE N10 OK Bestandswaechter weist den Abgang mit 23514 ab, Bestand bleibt 134';
end
$$;

-- N11: EINHEIT.
--
-- Teil 1 im Anwendungsmuster: die Einheit wird aus public.materials gelesen
-- (materialUnit(), inventory-actions.ts:283-289) und die gebuchte Bewegung
-- traegt genau diese Einheit.
--
-- Teil 2 haelt den BESTEHENDEN Zustand fest, ohne ihn zu aendern: die Datenbank
-- kennt KEINEN Einheitenabgleich zwischen public.inventory_movements.unit und
-- public.materials.unit - es gibt dafuer weder eine Check-Bedingung noch einen
-- Trigger. Eine absichtlich abweichende Einheit wird deshalb NICHT verhindert.
-- Die Zusage "die Einheit stammt ausschliesslich aus dem Material" ist eine
-- Zusage der Anwendung. Daran wird hier nichts geaendert.
do $$
declare
  v_dispo uuid := '21b00000-0000-0000-0000-000000000002';
  v_material uuid := '21b00000-0000-0000-0000-0000000000d1';
  v_central uuid := '21b00000-0000-0000-0000-0000000000d2';
  v_from_master uuid := '21b00000-0000-0000-0000-000000000109';
  v_deviating uuid := '21b00000-0000-0000-0000-00000000010a';
  v_unit text;
  v_booked text;
  v_material_unit text;
  v_deviating_unit text;
  v_total numeric;
begin
  perform set_config('app.user_id', v_dispo::text, true);

  select unit into v_unit from public.materials where id = v_material;

  insert into public.inventory_movements
    (id, material_id, quantity, unit, movement_type, target_location_id, note)
  values (v_from_master, v_material, 1, v_unit, 'wareneingang', v_central,
          'N21 N11 Einheit aus dem Material');

  select mv.unit, m.unit into v_booked, v_material_unit
  from public.inventory_movements mv
  join public.materials m on m.id = mv.material_id
  where mv.id = v_from_master;

  if v_booked is distinct from v_material_unit then
    raise exception 'SMOKE N11 FAIL gebuchte Einheit=% Materialeinheit=%',
      coalesce(v_booked, 'NULL'), coalesce(v_material_unit, 'NULL');
  end if;

  insert into public.inventory_movements
    (id, material_id, quantity, unit, movement_type, target_location_id, note)
  values (v_deviating, v_material, 1, 'Stk', 'wareneingang', v_central,
          'N21 N11 absichtlich abweichende Einheit');

  select unit into v_deviating_unit
  from public.inventory_movements where id = v_deviating;
  if v_deviating_unit is distinct from 'Stk' then
    raise exception 'SMOKE N11 FAIL abweichende Einheit wurde zu %',
      coalesce(v_deviating_unit, 'NULL');
  end if;

  select coalesce(sum(quantity), 0) into v_total
  from public.material_stock where material_id = v_material;
  if v_total <> 136 then
    raise exception 'SMOKE N11 FAIL Bestand=% nach zwei Zugaengen, erwartet 136', v_total;
  end if;

  raise notice
    'SMOKE N11 OK gebuchte Einheit stammt aus dem Material (%); eine abweichende Einheit wird von der Datenbank bestehend NICHT verhindert (Ist-Zustand, unveraendert)',
    v_material_unit;
end
$$;

-- N12: UNVERAENDERBARE CHRONIK.
--
-- Zwei unabhaengige Schranken, beide belegt: das fehlende Tabellenrecht (0015
-- vergibt auf public.inventory_movements bewusst nur select und insert) und die
-- fehlende Update-/Delete-Policy (0001). Erreicht wird hier die erste - deshalb
-- werden die Rechte zusaetzlich ueber has_table_privilege gemessen.
do $$
declare
  v_dispo uuid := '21b00000-0000-0000-0000-000000000002';
  v_movement uuid := '21b00000-0000-0000-0000-000000000109';
  v_policies integer;
begin
  perform set_config('app.user_id', v_dispo::text, true);

  if has_table_privilege('app_user', 'public.inventory_movements', 'update') then
    raise exception 'SMOKE N12 FAIL app_user besitzt update auf inventory_movements';
  end if;
  if has_table_privilege('app_user', 'public.inventory_movements', 'delete') then
    raise exception 'SMOKE N12 FAIL app_user besitzt delete auf inventory_movements';
  end if;

  begin
    update public.inventory_movements set note = 'N21 N12 unzulaessige Aenderung'
     where id = v_movement;
    raise exception 'SMOKE N12 FAIL Aenderung einer Bewegung wurde zugelassen';
  exception
    when insufficient_privilege then null;
  end;

  begin
    delete from public.inventory_movements where id = v_movement;
    raise exception 'SMOKE N12 FAIL Loeschen einer Bewegung wurde zugelassen';
  exception
    when insufficient_privilege then null;
  end;

  select count(*) into v_policies
  from pg_policies
  where schemaname = 'public' and tablename = 'inventory_movements'
    and cmd in ('UPDATE', 'DELETE');
  if v_policies <> 0 then
    raise exception 'SMOKE N12 FAIL % Update-/Delete-Policy auf inventory_movements gefunden',
      v_policies;
  end if;

  if not exists (select 1 from public.inventory_movements where id = v_movement) then
    raise exception 'SMOKE N12 FAIL die Bewegung ist nach den Versuchen nicht mehr vorhanden';
  end if;

  raise notice
    'SMOKE N12 OK kein update/delete-Recht, beide Versuche abgewiesen, keine Update-/Delete-Policy vorhanden';
end
$$;

-- N13: ROLLBACK NACH TEILSCHRITT.
--
-- Erst eine gueltige Bewegung, dann eine zweite mit negativer Menge. Beide
-- stehen in EINER Subtransaktion; ihre Ruecknahme entspricht dem Rollback von
-- withUserTransaction(). Danach darf die erste Bewegung NICHT vorhanden sein -
-- das ist der Nachweis, dass ein Fehler nach dem ersten Teilschritt keinen
-- Teilstand hinterlaesst.
do $$
declare
  v_dispo uuid := '21b00000-0000-0000-0000-000000000002';
  v_material uuid := '21b00000-0000-0000-0000-0000000000d1';
  v_central uuid := '21b00000-0000-0000-0000-0000000000d2';
  v_first uuid := '21b00000-0000-0000-0000-00000000010b';
  v_state text := null;
  v_reached boolean := false;
  v_rows integer;
  v_total numeric;
begin
  perform set_config('app.user_id', v_dispo::text, true);

  begin
    insert into public.inventory_movements
      (id, material_id, quantity, unit, movement_type, target_location_id, note)
    values (v_first, v_material, 7, 'Meter', 'wareneingang', v_central,
            'N21 N13 erster Teilschritt');

    -- Zweiter Teilschritt, absichtlich unzulaessig: negative Menge.
    insert into public.inventory_movements
      (material_id, quantity, unit, movement_type, target_location_id, note)
    values (v_material, -1, 'Meter', 'wareneingang', v_central,
            'N21 N13 zweiter Teilschritt');
    v_reached := true;
  exception
    when check_violation then
      v_state := sqlstate;
  end;

  if v_reached then
    raise exception 'SMOKE N13 FAIL der erzwungene Fehler ist nicht eingetreten';
  end if;
  if v_state is distinct from '23514' then
    raise exception 'SMOKE N13 FAIL erwarteter SQLSTATE 23514, erhalten %',
      coalesce(v_state, 'NULL');
  end if;

  select count(*) into v_rows from public.inventory_movements where id = v_first;
  if v_rows <> 0 then
    raise exception 'SMOKE N13 FAIL die erste Bewegung ueberlebt den Rollback (% Zeile(n))', v_rows;
  end if;

  select coalesce(sum(quantity), 0) into v_total
  from public.material_stock where material_id = v_material;
  if v_total <> 136 then
    raise exception 'SMOKE N13 FAIL Bestand=% nach dem Rollback, erwartet unveraendert 136', v_total;
  end if;

  raise notice
    'SMOKE N13 OK Fehler im zweiten Teilschritt nimmt auch den ersten zurueck, Bestand bleibt 136';
end
$$;

-- ---------------------------------------------------------------------
-- N14, Teil 1: AUDIT unveraendert - Gegenprobe im EIGENTUEMERKONTEXT.
--
-- app_user darf public.audit_events nicht lesen (Teil 2 belegt das). Die
-- Gegenprobe, dass die Auditsaetze wirklich entstehen, ist deshalb nur im
-- Eigentuemerkontext moeglich. Geschrieben werden sie ausschliesslich vom
-- SECURITY-DEFINER-Trigger public.tg_audit() ueber trg_audit_movements (0001);
-- der actor stammt aus app.current_user_id() zum Zeitpunkt der Buchung.
-- ---------------------------------------------------------------------
reset role;

do $$
declare
  v_material uuid := '21b00000-0000-0000-0000-0000000000d1';
  v_dispo uuid := '21b00000-0000-0000-0000-000000000002';
  v_monteur uuid := '21b00000-0000-0000-0000-000000000003';
  v_by_dispo uuid := '21b00000-0000-0000-0000-000000000109';
  v_by_monteur uuid := '21b00000-0000-0000-0000-000000000106';
  v_rolled_back uuid := '21b00000-0000-0000-0000-00000000010b';
  v_movements integer;
  v_audits integer;
  v_actor_dispo uuid;
  v_actor_monteur uuid;
  v_rollback_audits integer;
begin
  select count(*) into v_movements
  from public.inventory_movements where material_id = v_material;

  select count(*) into v_audits
  from public.audit_events
  where entity = 'inventory_movements'
    and action = 'INSERT'
    and entity_id in (select id from public.inventory_movements where material_id = v_material);

  if v_movements <> 12 then
    raise exception 'SMOKE N14 FAIL % Bewegung(en) fuer das Testmaterial, erwartet 12', v_movements;
  end if;
  if v_audits <> v_movements then
    raise exception 'SMOKE N14 FAIL % Auditsatz/-saetze zu % Bewegung(en)', v_audits, v_movements;
  end if;

  select actor into v_actor_dispo
  from public.audit_events
  where entity = 'inventory_movements' and action = 'INSERT' and entity_id = v_by_dispo;
  select actor into v_actor_monteur
  from public.audit_events
  where entity = 'inventory_movements' and action = 'INSERT' and entity_id = v_by_monteur;

  if v_actor_dispo is distinct from v_dispo or v_actor_monteur is distinct from v_monteur then
    raise exception 'SMOKE N14 FAIL actor der Disposition=% des Monteurs=%',
      coalesce(v_actor_dispo::text, 'NULL'), coalesce(v_actor_monteur::text, 'NULL');
  end if;

  -- Die in N13 zurueckgerollte Bewegung hat auch keinen Auditsatz hinterlassen:
  -- der Definer-Trigger schreibt in derselben Transaktion.
  select count(*) into v_rollback_audits
  from public.audit_events
  where entity = 'inventory_movements' and entity_id = v_rolled_back;
  if v_rollback_audits <> 0 then
    raise exception 'SMOKE N14 FAIL zurueckgerollte Bewegung hinterlaesst % Auditsatz/-saetze',
      v_rollback_audits;
  end if;

  raise notice
    'SMOKE N14 OK 12 Bewegungen, 12 Auditsaetze, actor entspricht der buchenden Identitaet, kein Auditsatz aus dem Rollback';
end
$$;

-- ---------------------------------------------------------------------
-- N14, Teil 2 und N15 wieder unter der Anwendungsrolle.
-- ---------------------------------------------------------------------
set role app_user;

-- N14, Teil 2: app_user kann den Audit nicht lesen - weder mit Admin-Identitaet
-- noch sonst. Die Schranke ist hier das fehlende Tabellenrecht (0014 und 0015
-- vergeben auf public.audit_events keines) und nicht die Policy audit_select.
do $$
declare
  v_admin uuid := '21b00000-0000-0000-0000-000000000001';
  v_rows integer;
begin
  perform set_config('app.user_id', v_admin::text, true);

  if has_table_privilege('app_user', 'public.audit_events', 'select') then
    raise exception 'SMOKE N14 FAIL app_user besitzt select auf audit_events';
  end if;

  begin
    select count(*) into v_rows from public.audit_events;
    raise exception 'SMOKE N14 FAIL app_user liest audit_events (% Zeile(n))', v_rows;
  exception
    when insufficient_privilege then null;
  end;

  raise notice 'SMOKE N14 OK app_user kann public.audit_events auch als Admin-Identitaet nicht lesen';
end
$$;

-- N15: RECHTEMATRIX als Smoke gemessen - dieselbe Positiv-/Negativmatrix wie in
-- Migration 0015, hier aber gegen die laufende Datenbank. has_table_privilege
-- beruecksichtigt die Gruppenmitgliedschaft, deckt also auch ein mittelbar
-- ueber authenticated geerbtes Recht auf.
do $$
declare
  item record;
  v_wrong text[] := array[]::text[];
begin
  for item in
    select * from (values
      -- Stammdaten: erteilt (0014 select, 0015 insert/update/delete)
      ('public.on_call_numbers', 'select', true),
      ('public.on_call_numbers', 'insert', true),
      ('public.on_call_numbers', 'update', true),
      ('public.on_call_numbers', 'delete', false),
      ('public.customers', 'select', true),
      ('public.customers', 'insert', true),
      ('public.customers', 'update', true),
      ('public.customers', 'delete', false),
      ('public.construction_stages', 'select', true),
      ('public.construction_stages', 'insert', true),
      ('public.construction_stages', 'update', true),
      ('public.construction_stages', 'delete', false),
      ('public.vzg_lines', 'select', true),
      ('public.vzg_lines', 'insert', true),
      ('public.vzg_lines', 'update', true),
      ('public.vzg_lines', 'delete', false),
      ('public.contacts', 'select', true),
      ('public.contacts', 'insert', true),
      ('public.contacts', 'update', true),
      ('public.contacts', 'delete', false),
      -- Vollstaendige Ersetzung: insert und delete, bewusst kein update.
      ('public.contact_phone_numbers', 'select', true),
      ('public.contact_phone_numbers', 'insert', true),
      ('public.contact_phone_numbers', 'delete', true),
      ('public.contact_phone_numbers', 'update', false),
      ('public.construction_stage_contacts', 'select', true),
      ('public.construction_stage_contacts', 'insert', true),
      ('public.construction_stage_contacts', 'delete', true),
      ('public.construction_stage_contacts', 'update', false),
      ('public.technicians', 'select', true),
      ('public.technicians', 'insert', true),
      ('public.technicians', 'update', true),
      ('public.technicians', 'delete', false),
      ('public.teams', 'select', true),
      ('public.teams', 'insert', true),
      ('public.teams', 'update', true),
      ('public.teams', 'delete', false),
      ('public.team_members', 'select', true),
      ('public.team_members', 'insert', true),
      ('public.team_members', 'delete', true),
      ('public.team_members', 'update', false),
      ('public.cable_types', 'select', true),
      ('public.cable_types', 'insert', true),
      ('public.cable_types', 'update', true),
      ('public.cable_types', 'delete', false),
      ('public.app_settings', 'select', true),
      ('public.app_settings', 'insert', true),
      ('public.app_settings', 'update', true),
      ('public.app_settings', 'delete', false),
      -- Inventar: Deaktivierung ueber is_active, kein delete.
      ('public.materials', 'select', true),
      ('public.materials', 'insert', true),
      ('public.materials', 'update', true),
      ('public.materials', 'delete', false),
      ('public.storage_locations', 'select', true),
      ('public.storage_locations', 'insert', true),
      ('public.storage_locations', 'update', true),
      ('public.storage_locations', 'delete', false),
      -- Die Bestands-View ist ausschliesslich ein Lesepfad.
      ('public.material_stock', 'select', true),
      ('public.material_stock', 'insert', false),
      ('public.material_stock', 'update', false),
      ('public.material_stock', 'delete', false),
      -- Die Chronik ist anhaengbar und unveraenderbar.
      ('public.inventory_movements', 'select', true),
      ('public.inventory_movements', 'insert', true),
      ('public.inventory_movements', 'update', false),
      ('public.inventory_movements', 'delete', false),
      -- Herkunft 0012 bzw. 0014, hier nur geprueft: der Bewegungsverlauf setzt
      -- beide Lesewege voraus.
      ('public.profiles', 'select', true),
      ('public.incidents', 'select', true),
      -- Der Audit bleibt vollstaendig unerreichbar.
      ('public.audit_events', 'select', false),
      ('public.audit_events', 'insert', false),
      ('public.audit_events', 'update', false),
      ('public.audit_events', 'delete', false),
      ('public.audit_events', 'truncate', false),
      ('public.audit_events', 'references', false),
      ('public.audit_events', 'trigger', false)
    ) as t(object_name, privilege, expected)
  loop
    if has_table_privilege('app_user', item.object_name, item.privilege) <> item.expected then
      v_wrong := array_append(
        v_wrong,
        item.object_name || ' ' || item.privilege || ' erwartet ' || item.expected::text);
    end if;
  end loop;

  if array_length(v_wrong, 1) is not null then
    raise exception 'SMOKE N15 FAIL Rechtematrix abweichend: %', array_to_string(v_wrong, ', ');
  end if;

  raise notice 'SMOKE N15 OK Rechtematrix entspricht dem Zielzustand aus 0014 und 0015';
end
$$;

-- N15, Gegenprobe: app_user bleibt eine nicht privilegierte Rolle. Ohne sie
-- waeren alle Faelle oben wertlos - mit SUPERUSER oder BYPASSRLS gilt keine
-- Policy. Muster aus 20_ap14b_data.sql, Fall D19.
do $$
declare
  v_flags record;
begin
  select rolsuper, rolbypassrls
  into v_flags
  from pg_roles where rolname = 'app_user';

  if not found then
    raise exception 'SMOKE N15 FAIL Rolle app_user fehlt';
  end if;
  if v_flags.rolsuper or v_flags.rolbypassrls then
    raise exception 'SMOKE N15 FAIL app_user ist privilegiert (super=% bypassrls=%)',
      v_flags.rolsuper, v_flags.rolbypassrls;
  end if;

  raise notice 'SMOKE N15 OK app_user ohne SUPERUSER und ohne BYPASSRLS';
end
$$;

reset role;
select set_config('app.user_id', '', false);

do $$
begin
  raise notice
    'SMOKE MN-ENDE OK AP14B-Stammdaten M1-M11 und Inventar N1-N15 unter app_user mit aktiver RLS belegt';
end
$$;
