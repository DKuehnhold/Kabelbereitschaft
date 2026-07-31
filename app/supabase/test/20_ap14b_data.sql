\set ON_ERROR_STOP on

-- =====================================================================
-- AP14/B - Datenschicht (Vorgaenge, Aufgaben, Offline-Sync) unter der
-- Anwendungsrolle app_user mit AKTIVER RLS.
--
-- Erwartet die vollstaendige Kette einschliesslich 0012, 0013 und 0014, den
-- Plattform-Smoke 19_ap14b_platform.sql sowie unmittelbar davor
-- 19a_ap14b_grant_reset.sql. Diese Datei ist der letzte Eintrag der Kette.
--
-- Verbindliche Eigenschaften dieses Smokes:
--   * Er arbeitet AUSSCHLIESSLICH mit den Rechten, die Migration 0014 der
--     Rolle app_user vergibt. Es wird kein `grant` und kein `revoke`
--     ausgefuehrt, keine Policy geaendert, kein Trigger abgeschaltet.
--     Dass dieser Rechtestand tatsaechlich der 0014-Stand ist und nicht der
--     Rest der pauschalen Alt-Grants aus den Smokes 15-18, stellt
--     19a_ap14b_grant_reset.sql unmittelbar vor dieser Datei her.
--   * Die Identitaet wird immer transaktionsgebunden mit
--     set_config('app.user_id', ..., true) gesetzt - genau so, wie
--     withUserTransaction() es tut (app/src/lib/db/index.ts:194-200). Jeder
--     `do`-Block ist eine eigene Transaktion, die Identitaet endet mit ihm.
--   * Nur synthetische Werte: keine echten Personen, keine Telefonnummern,
--     keine GPS-/EXIF-Daten, kein Passwort und kein Hashmaterial.
--   * Gezaehlt wird ausschliesslich RELATIV (eigene Kennungen, Differenz
--     vor/nach). Kein Fall zaehlt absolut ueber eine ganze Tabelle, damit die
--     Fixtures der Smokes 15-19 unberuehrt bleiben.
--
-- Kein Aufraeumen am Dateiende - und das ist eine bewusste Entscheidung, keine
-- Nachlaessigkeit: die Loeschsperre trg_incident_tasks_no_delete (0011:113-123)
-- ist eine unbedingte BEFORE-DELETE-Regel und greift auch im
-- Eigentuemerkontext sowie bei der Kaskade aus public.incidents. Ein
-- `delete from public.incidents` waere deshalb nur nach einer Aufweichung
-- dieser Sperre moeglich, und die ist ausgeschlossen. Da diese Datei der
-- letzte Eintrag der Kette ist und beide Startskripte die Testdatenbank
-- danach immer entfernen, bleiben die synthetischen Saetze bis zum Ende des
-- Laufs stehen. Alle Kennungen tragen den Praefix 20b00000-, der in keiner
-- anderen Testdatei vorkommt (die Praefixe d1/d3/d4/d5 gehoeren zu
-- 16_ap11_list.sql und werden hier bewusst gemieden); deshalb laeuft die Datei
-- in einer frischen Kette wiederholbar, ohne fremde Fixtures zu beruehren.
-- Ausnahme mit Absicht: der von D20 ueber create_incident_ap12 angelegte
-- Vorgang traegt eine von der Datenbank vergebene Kennung. Wiedererkannt wird
-- er ueber external_reference = 'D20-AP12'.
-- =====================================================================

reset role;
select set_config('app.user_id', '', false);

-- ---------------------------------------------------------------------
-- Fixtures im Eigentuemerkontext (RLS gilt fuer den Eigentuemer nicht; das
-- ist genau der Grund, weshalb ALLE Pruefungen weiter unten unter
-- `set role app_user` laufen).
--
-- Vier Identitaeten: Admin, Disposition, zugewiesener Monteur, fremder
-- Monteur. Jedes Profil braucht ein Auth-Konto, weil 0012 den Fremdschluessel
-- public.profiles.id auf public.auth_accounts umgehaengt hat (0012:229-278).
-- ---------------------------------------------------------------------
-- Das Admin-Konto ...0001 traegt bewusst den Platzhalter
-- '!MIGRATED-ACCOUNT-REQUIRES-RESET!' statt eines Argon2id-artigen Werts.
-- Grund: der Runner startet die Node-Integrationstests in DERSELBEN Datenbank
-- NACH dieser Datei. usableAdminCount() in
-- app/test/integration/ap14b-platform.int.mjs:277-286 und das Bootstrap-Gate
-- in app/scripts/bootstrap-admin.mjs:196-202 zaehlen jedes aktive
-- Admin-Profil, dessen password_hash auf '$argon2id$' passt. Ein solcher Wert
-- liesse I13, I14 und I16 scheitern, weil das Bootstrap eine Datenbank ohne
-- anmeldefaehigen Administrator voraussetzt.
-- Der Platzhalter ist projektweit etabliert: 0012:205 fuehrt ihn selbst ein,
-- 19_ap14b_platform.sql:736 toleriert ihn ausdruecklich.
-- Smoke 20 braucht den Hash nicht: die Identitaet wird ueber
-- set_config('app.user_id', ...) gesetzt; von auth_accounts wird nur der
-- Fremdschluessel auf die id gebraucht.
-- Diesen Wert NICHT auf einen '$argon2id$'-Wert zurueckdrehen.
insert into public.auth_accounts (id, email, password_hash, must_change_password)
values
  ('20b00000-0000-0000-0000-000000000001', 'd20.admin@beispiel.invalid', '!MIGRATED-ACCOUNT-REQUIRES-RESET!', false),
  ('20b00000-0000-0000-0000-000000000002', 'd20.dispo@beispiel.invalid', '$argon2id$synthetisch', false),
  ('20b00000-0000-0000-0000-000000000003', 'd20.monteur@beispiel.invalid', '$argon2id$synthetisch', false),
  ('20b00000-0000-0000-0000-000000000004', 'd20.fremd@beispiel.invalid', '$argon2id$synthetisch', false)
on conflict (id) do nothing;

insert into public.profiles (id, full_name, role, is_active)
values
  ('20b00000-0000-0000-0000-000000000001', 'D20 Admin', 'admin', true),
  ('20b00000-0000-0000-0000-000000000002', 'D20 Disposition', 'disponent', true),
  ('20b00000-0000-0000-0000-000000000003', 'D20 Monteur zugewiesen', 'monteur', true),
  ('20b00000-0000-0000-0000-000000000004', 'D20 Monteur fremd', 'monteur', true)
on conflict (id) do nothing;

insert into public.construction_stages (id, code, name)
values ('20b00000-0000-0000-0000-0000000000a1', 'B20', 'Bauabschnitt AP14B-Daten');

insert into public.vzg_lines (id, line_number, construction_stage_id)
values ('20b00000-0000-0000-0000-0000000000a2', '1820', '20b00000-0000-0000-0000-0000000000a1');

-- Kunde und Kabelart werden erst von den Vorgangs-RPCs in Abschnitt E
-- gebraucht: create_incident_ap12 fordert beide als Pflichtangabe
-- (0010:126-131 und 0010:187-189).
insert into public.customers (id, name)
values ('20b00000-0000-0000-0000-0000000000a3', 'D20 Kunde AP14B-Daten');

insert into public.cable_types (id, code, name, sort_order)
values ('20b00000-0000-0000-0000-0000000000a4', 'd20-kabel', 'D20 Kabelart', 20);

-- Vier Vorgaenge. Alle tragen eine aufgeloeste VzG-Zuordnung (vzg_line_id
-- gesetzt), damit die abgeleitete Aufgabe historic_vzg nicht entsteht und die
-- Aufgabenmenge vorhersagbar bleibt (0011:181-206).
--
-- ...b3 und ...b4 stehen ausschliesslich den Faellen D22/D23 zur Verfuegung und
-- bleiben bis dahin unberuehrt: beide brauchen einen Vorgang im Status 'neu'
-- ohne aktive Zuweisung, weil sonst weder der Statuswechsel der Zuweisung noch
-- die Konfliktbasis eindeutig waere. D1-D19 zaehlen ausschliesslich ueber
-- ...b1/...b2 und bleiben davon unberuehrt.
insert into public.incidents
  (id, construction_stage_id, vzg_line_number, vzg_line_id, km_from, status, description)
values
  ('20b00000-0000-0000-0000-0000000000b1', '20b00000-0000-0000-0000-0000000000a1',
   '1820', '20b00000-0000-0000-0000-0000000000a2', 20.100, 'monteur_zugewiesen',
   'AP14B Daten - zugewiesener Vorgang'),
  ('20b00000-0000-0000-0000-0000000000b2', '20b00000-0000-0000-0000-0000000000a1',
   '1820', '20b00000-0000-0000-0000-0000000000a2', 20.200, 'neu',
   'AP14B Daten - fremder Vorgang'),
  ('20b00000-0000-0000-0000-0000000000b3', '20b00000-0000-0000-0000-0000000000a1',
   '1820', '20b00000-0000-0000-0000-0000000000a2', 20.300, 'neu',
   'AP14B Daten - Zuweisung ueber RPC'),
  ('20b00000-0000-0000-0000-0000000000b4', '20b00000-0000-0000-0000-0000000000a1',
   '1820', '20b00000-0000-0000-0000-0000000000a2', 20.400, 'neu',
   'AP14B Daten - Massenaktion');

-- Nur der erste Vorgang (...b1) ist dem Monteur ...003 zugewiesen; ...b2 bleibt
-- fuer beide Monteure fremd.
insert into public.incident_assignments (incident_id, monteur_id)
values ('20b00000-0000-0000-0000-0000000000b1', '20b00000-0000-0000-0000-000000000003');

-- =====================================================================
-- Ab hier ausschliesslich unter der Anwendungsrolle app_user.
-- =====================================================================
set role app_user;

-- ---------------------------------------------------------------------
-- A) Rollen und Zeilensichtbarkeit (vier Identitaeten)
--
-- Grundlage: public.incidents traegt incidents_select mit
-- `is_staff() or is_assigned_to_incident(id)` (0001:540-541). Die Liste
-- public.incident_list_view ist eine security_invoker-View (0011:619-620),
-- ihre Zeilensichtbarkeit stammt also aus derselben Policy.
-- ---------------------------------------------------------------------

-- D1: Admin sieht beide Vorgaenge - in der Tabelle und in der Liste.
do $$
declare
  v_admin uuid := '20b00000-0000-0000-0000-000000000001';
  v_a uuid := '20b00000-0000-0000-0000-0000000000b1';
  v_b uuid := '20b00000-0000-0000-0000-0000000000b2';
  v_rows integer;
  v_view integer;
begin
  perform set_config('app.user_id', v_admin::text, true);

  select count(*) into v_rows from public.incidents where id in (v_a, v_b);
  select count(*) into v_view from public.incident_list_view where id in (v_a, v_b);

  if v_rows <> 2 or v_view <> 2 then
    raise exception 'SMOKE D1 FAIL Admin sieht incidents=% liste=%, erwartet je 2', v_rows, v_view;
  end if;
  raise notice 'SMOKE D1 OK Admin sieht beide Vorgaenge in Tabelle und Liste';
end
$$;

-- D2: Disposition sieht beide Vorgaenge (Staff-Sicht, dieselbe Policy).
do $$
declare
  v_dispo uuid := '20b00000-0000-0000-0000-000000000002';
  v_a uuid := '20b00000-0000-0000-0000-0000000000b1';
  v_b uuid := '20b00000-0000-0000-0000-0000000000b2';
  v_rows integer;
  v_view integer;
begin
  perform set_config('app.user_id', v_dispo::text, true);

  select count(*) into v_rows from public.incidents where id in (v_a, v_b);
  select count(*) into v_view from public.incident_list_view where id in (v_a, v_b);

  if v_rows <> 2 or v_view <> 2 then
    raise exception 'SMOKE D2 FAIL Disponent sieht incidents=% liste=%, erwartet je 2', v_rows, v_view;
  end if;
  raise notice 'SMOKE D2 OK Disponent sieht beide Vorgaenge (Staff-Sicht)';
end
$$;

-- D3: Der zugewiesene Monteur sieht GENAU seinen Vorgang - nicht den anderen.
do $$
declare
  v_monteur uuid := '20b00000-0000-0000-0000-000000000003';
  v_a uuid := '20b00000-0000-0000-0000-0000000000b1';
  v_b uuid := '20b00000-0000-0000-0000-0000000000b2';
  v_own integer;
  v_other integer;
  v_view_own integer;
  v_view_other integer;
begin
  perform set_config('app.user_id', v_monteur::text, true);

  select count(*) into v_own from public.incidents where id = v_a;
  select count(*) into v_other from public.incidents where id = v_b;
  select count(*) into v_view_own from public.incident_list_view where id = v_a;
  select count(*) into v_view_other from public.incident_list_view where id = v_b;

  if v_own <> 1 or v_view_own <> 1 then
    raise exception
      'SMOKE D3 FAIL zugewiesener Monteur sieht den eigenen Vorgang nicht (tabelle=% liste=%)',
      v_own, v_view_own;
  end if;
  if v_other <> 0 or v_view_other <> 0 then
    raise exception
      'SMOKE D3 FAIL zugewiesener Monteur sieht den fremden Vorgang (tabelle=% liste=%)',
      v_other, v_view_other;
  end if;
  raise notice 'SMOKE D3 OK zugewiesener Monteur sieht genau seinen Vorgang in Tabelle und Liste';
end
$$;

-- D4: Der fremde Monteur sieht KEINEN der beiden Vorgaenge.
do $$
declare
  v_fremd uuid := '20b00000-0000-0000-0000-000000000004';
  v_a uuid := '20b00000-0000-0000-0000-0000000000b1';
  v_b uuid := '20b00000-0000-0000-0000-0000000000b2';
  v_rows integer;
  v_view integer;
begin
  perform set_config('app.user_id', v_fremd::text, true);

  select count(*) into v_rows from public.incidents where id in (v_a, v_b);
  select count(*) into v_view from public.incident_list_view where id in (v_a, v_b);

  if v_rows <> 0 or v_view <> 0 then
    raise exception
      'SMOKE D4 FAIL fremder Monteur sieht incidents=% liste=%, erwartet je 0', v_rows, v_view;
  end if;
  raise notice 'SMOKE D4 OK fremder Monteur sieht keinen der beiden Vorgaenge';
end
$$;

-- D5: Der Monteur erhaelt seine Aufgaben ausschliesslich ueber die RPC.
--
-- Genauer Befund zur Rechtelage - er weicht von der verbreiteten Formulierung
-- "Monteure haben kein Tabellenrecht auf incident_tasks" ab: seit dem
-- Wegfall der Supabase-Rollen laeuft JEDER Benutzer unter derselben
-- Anwendungsrolle app_user, und die besitzt select/insert/update auf
-- public.incident_tasks (0014:85, zuvor bereits `grant ... to authenticated`
-- in 0011:147). Die Trennung leistet also NICHT das Tabellenrecht, sondern
-- allein die Policy incident_tasks_select mit `is_staff()` (0011:131-132).
-- Genau das wird hier belegt: derselbe Vorgang, dieselbe Anweisung, ein
-- Ergebnis fuer Staff und keine Zeile fuer den Monteur.
do $$
declare
  v_dispo uuid := '20b00000-0000-0000-0000-000000000002';
  v_monteur uuid := '20b00000-0000-0000-0000-000000000003';
  v_a uuid := '20b00000-0000-0000-0000-0000000000b1';
  v_staff_rows integer;
  v_monteur_rows integer;
  v_rpc integer;
  v_rpc_typed integer;
  v_columns text[];
begin
  -- Gegenprobe zuerst: als Staff gibt es fuer diesen Vorgang ueberhaupt
  -- Aufgabenzeilen. Ohne sie waere die 0 des Monteurs kein Nachweis.
  perform set_config('app.user_id', v_dispo::text, true);
  select count(*) into v_staff_rows from public.incident_tasks where incident_id = v_a;
  if v_staff_rows = 0 then
    raise exception 'SMOKE D5 FAIL Staff sieht keine Aufgabenzeile - Ableitung fehlt';
  end if;

  perform set_config('app.user_id', v_monteur::text, true);
  select count(*) into v_monteur_rows from public.incident_tasks where incident_id = v_a;
  if v_monteur_rows <> 0 then
    raise exception
      'SMOKE D5 FAIL Monteur liest % Aufgabenzeile(n) direkt (RLS unwirksam)', v_monteur_rows;
  end if;

  -- Der einzige zulaessige Weg: die gehaertete RPC (0011:330-360).
  select count(*) into v_rpc from public.get_assigned_incident_tasks(v_a);
  if v_rpc = 0 then
    raise exception 'SMOKE D5 FAIL RPC liefert dem zugewiesenen Monteur keine Aufgabe';
  end if;

  -- Die Rueckgabe enthaelt GENAU die fuenf minimierten Spalten. Gelesen wird
  -- die Signatur aus dem Katalog, nicht aus einer Annahme.
  select array_agg(p.proargnames[i] order by i)
    into v_columns
  from pg_proc p,
       generate_subscripts(p.proargnames, 1) as i
  where p.oid = 'public.get_assigned_incident_tasks(uuid)'::regprocedure
    -- Modus 't' = TABLE-Rueckgabespalte; die Eingangsparameter bleiben aussen.
    and p.proargmodes[i] = 't';

  if v_columns is distinct from
     array['incident_id', 'task_type', 'title', 'status', 'due_at']::text[]
  then
    raise exception 'SMOKE D5 FAIL RPC-Spalten sind %', v_columns;
  end if;

  -- Und die Spalten sind tatsaechlich benutzbar: eine falsche Signatur waere
  -- hier ein Fehler, kein stilles Abweichen.
  select count(*) into v_rpc_typed
  from public.get_assigned_incident_tasks(v_a) t
  where t.incident_id = v_a
    and t.task_type is not null
    and t.title is not null
    and t.status in ('open', 'in_progress');
  if v_rpc_typed <> v_rpc then
    raise exception 'SMOKE D5 FAIL RPC liefert % von % Zeilen mit erwarteter Gestalt',
      v_rpc_typed, v_rpc;
  end if;

  raise notice
    'SMOKE D5 OK Aufgaben nur ueber RPC (% Zeilen, Staff sieht %, Monteur direkt 0)',
    v_rpc, v_staff_rows;
end
$$;

-- D6: Die RPC weist den fremden Monteur ab.
--
-- Tatsaechliches Verhalten laut 0011:350-352: nicht "keine Zeile", sondern ein
-- Fehler mit errcode 42501 aus der Pruefung is_assigned_to_incident().
do $$
declare
  v_fremd uuid := '20b00000-0000-0000-0000-000000000004';
  v_a uuid := '20b00000-0000-0000-0000-0000000000b1';
begin
  perform set_config('app.user_id', v_fremd::text, true);

  begin
    perform 1 from public.get_assigned_incident_tasks(v_a);
    raise exception 'SMOKE D6 FAIL fremder Monteur erhaelt Aufgaben ueber die RPC';
  exception
    when insufficient_privilege then null;
  end;

  raise notice 'SMOKE D6 OK RPC weist den fremden Monteur mit 42501 ab';
end
$$;

-- D7: Ein Monteur legt keinen Vorgang an und aendert keinen fremden Vorgang.
--
-- Zwei unterschiedliche Wirkungen, die auseinandergehalten werden muessen:
--   * INSERT scheitert mit 42501, weil incidents_insert
--     `with check (is_staff())` fordert (0001:542-543). Das Tabellenrecht
--     selbst ist vorhanden (0014:55) - die Abweisung kommt aus der Policy.
--   * UPDATE eines fremden Vorgangs erzeugt KEINEN Fehler: die USING-Klausel
--     von incidents_update (0001:544-546) filtert die Zeile heraus, die
--     Anweisung trifft 0 Zeilen. Ein Fehler waere hier die falsche Erwartung;
--     der Nachweis ist der Zeilenzaehler zusammen mit dem unveraenderten Wert.
do $$
declare
  v_monteur uuid := '20b00000-0000-0000-0000-000000000003';
  v_a uuid := '20b00000-0000-0000-0000-0000000000b1';
  v_b uuid := '20b00000-0000-0000-0000-0000000000b2';
  v_rows integer;
  v_status_before public.incident_status;
  v_status_after public.incident_status;
begin
  perform set_config('app.user_id', v_monteur::text, true);

  begin
    insert into public.incidents
      (construction_stage_id, vzg_line_number, vzg_line_id, km_from, status, description)
    values ('20b00000-0000-0000-0000-0000000000a1', '1820',
            '20b00000-0000-0000-0000-0000000000a2', 20.900, 'neu',
            'AP14B Daten - Monteur-Anlageversuch');
    raise exception 'SMOKE D7 FAIL Monteur darf einen Vorgang anlegen';
  exception
    when insufficient_privilege then null;
  end;

  -- Der fremde Vorgang bleibt unberuehrt. Der Ausgangswert wird im
  -- Eigentuemerkontext gar nicht gebraucht: der Monteur sieht die Zeile nicht,
  -- also ist schon der Zeilenzaehler der Nachweis.
  update public.incidents set status = 'in_bearbeitung' where id = v_b;
  get diagnostics v_rows = row_count;
  if v_rows <> 0 then
    raise exception 'SMOKE D7 FAIL Monteur aendert % fremde Vorgangszeile(n)', v_rows;
  end if;

  -- Gegenprobe: der eigene Vorgang ist mit einem zulaessigen Status aenderbar.
  -- Ohne sie koennte D7 auch dann bestehen, wenn der Monteur ueberhaupt nichts
  -- aendern kann und die 0 oben nur die generelle Sperre widerspiegelt.
  select status into v_status_before from public.incidents where id = v_a;
  update public.incidents set status = 'vor_ort' where id = v_a;
  get diagnostics v_rows = row_count;
  select status into v_status_after from public.incidents where id = v_a;
  if v_rows <> 1 or v_status_after <> 'vor_ort' then
    raise exception
      'SMOKE D7 FAIL eigener Vorgang nicht aenderbar (zeilen=% vorher=% nachher=%)',
      v_rows, v_status_before, v_status_after;
  end if;

  raise notice 'SMOKE D7 OK Monteur legt nicht an, aendert nichts Fremdes, aber den eigenen Vorgang';
end
$$;

-- ---------------------------------------------------------------------
-- B) Aufgaben (public.incident_tasks)
-- ---------------------------------------------------------------------

-- D8: Staff legt eine manuelle Aufgabe an und aendert sie.
-- Entspricht createIncidentTask (app/src/lib/task-actions.ts:182-187) und
-- updateIncidentTask (app/src/lib/task-actions.ts:266-268).
do $$
declare
  v_dispo uuid := '20b00000-0000-0000-0000-000000000002';
  v_monteur uuid := '20b00000-0000-0000-0000-000000000003';
  v_a uuid := '20b00000-0000-0000-0000-0000000000b1';
  v_before integer;
  v_after integer;
  v_task uuid;
  v_status text;
  v_title text;
  v_assignee uuid;
begin
  perform set_config('app.user_id', v_dispo::text, true);

  select count(*) into v_before from public.incident_tasks where incident_id = v_a;

  insert into public.incident_tasks
    (incident_id, task_type, source, title, body, status, priority, assignee_profile_id)
  values (v_a, 'manual', 'manual', 'D20 Manuelle Rueckfrage', 'synthetischer Text',
          'open', 'high', v_monteur)
  returning id into v_task;

  select count(*) into v_after from public.incident_tasks where incident_id = v_a;
  if v_after - v_before <> 1 then
    raise exception 'SMOKE D8 FAIL Anlage ergibt Differenz % statt 1', v_after - v_before;
  end if;

  update public.incident_tasks
     set status = 'in_progress', title = 'D20 Manuelle Rueckfrage (geaendert)'
   where id = v_task;

  select status, title, assignee_profile_id
    into v_status, v_title, v_assignee
  from public.incident_tasks where id = v_task;

  if v_status <> 'in_progress'
     or v_title <> 'D20 Manuelle Rueckfrage (geaendert)'
     or v_assignee is distinct from v_monteur then
    raise exception 'SMOKE D8 FAIL status=% title=% assignee=%', v_status, v_title, v_assignee;
  end if;

  raise notice 'SMOKE D8 OK Staff legt manuelle Aufgabe an und aendert sie';
end
$$;

-- D9: Die Loeschsperre gilt weiter - auf beiden Ebenen.
--
-- Ebene 1: app_user hat kein delete-Recht (0014:83-85 vergibt es nicht,
-- 18_ap13_tasks.sql:40 nimmt das pauschale Testrecht zurueck).
-- Ebene 2: zusaetzlich existiert die unbedingte BEFORE-DELETE-Regel
-- trg_incident_tasks_no_delete (0011:113-123). Sie wird hier nicht erreicht,
-- weil das fehlende Tabellenrecht schon vorher greift - deshalb wird ihr
-- Vorhandensein aus dem Katalog belegt statt behauptet.
do $$
declare
  v_dispo uuid := '20b00000-0000-0000-0000-000000000002';
  v_a uuid := '20b00000-0000-0000-0000-0000000000b1';
  v_rows integer;
  v_trigger integer;
begin
  perform set_config('app.user_id', v_dispo::text, true);

  if has_table_privilege('app_user', 'public.incident_tasks', 'delete') then
    raise exception 'SMOKE D9 FAIL app_user besitzt delete auf incident_tasks';
  end if;

  select count(*) into v_rows from public.incident_tasks where incident_id = v_a;
  if v_rows = 0 then
    raise exception 'SMOKE D9 FAIL keine Aufgabenzeile fuer den Loeschversuch vorhanden';
  end if;

  begin
    delete from public.incident_tasks where incident_id = v_a;
    raise exception 'SMOKE D9 FAIL Loeschen einer Aufgabe wurde zugelassen';
  exception
    when insufficient_privilege then null;
  end;

  select count(*) into v_trigger
  from pg_trigger
  where tgrelid = 'public.incident_tasks'::regclass
    and tgname = 'trg_incident_tasks_no_delete'
    and not tgisinternal;
  if v_trigger <> 1 then
    raise exception 'SMOKE D9 FAIL Loeschtrigger fehlt (% Treffer)', v_trigger;
  end if;

  if (select count(*) from public.incident_tasks where incident_id = v_a) <> v_rows then
    raise exception 'SMOKE D9 FAIL Aufgabenbestand hat sich durch den Loeschversuch geaendert';
  end if;

  raise notice 'SMOKE D9 OK kein delete-Recht, Loeschversuch abgewiesen, Sperrtrigger vorhanden';
end
$$;

-- D10: Quittieren setzt Status, Zeitpunkt und Person gemeinsam.
--
-- Die Kohaerenzbedingung incident_tasks_ack_coherence_chk (0011:70-78) laesst
-- keinen Zwischenzustand zu. Genau deshalb setzt acknowledgeIncidentTask alle
-- drei Felder in EINER Anweisung (app/src/lib/task-actions.ts:293-297).
do $$
declare
  v_dispo uuid := '20b00000-0000-0000-0000-000000000002';
  v_a uuid := '20b00000-0000-0000-0000-0000000000b1';
  v_task uuid;
  v_status text;
  v_at timestamptz;
  v_by uuid;
begin
  perform set_config('app.user_id', v_dispo::text, true);

  select id into v_task
  from public.incident_tasks
  where incident_id = v_a and source = 'manual'
  order by created_at
  limit 1;
  if v_task is null then
    raise exception 'SMOKE D10 FAIL manuelle Aufgabe aus D8 nicht gefunden';
  end if;

  -- Zwischenzustand: Status gesetzt, Felder NULL -> abgewiesen.
  begin
    update public.incident_tasks set status = 'acknowledged' where id = v_task;
    raise exception 'SMOKE D10 FAIL Quittierung ohne Zeitpunkt und Person zugelassen';
  exception
    when check_violation then null;
  end;

  update public.incident_tasks
     set status = 'acknowledged', acknowledged_at = now(), acknowledged_by = v_dispo
   where id = v_task;

  select status, acknowledged_at, acknowledged_by
    into v_status, v_at, v_by
  from public.incident_tasks where id = v_task;

  if v_status <> 'acknowledged' or v_at is null or v_by is distinct from v_dispo then
    raise exception 'SMOKE D10 FAIL status=% at=% by=%', v_status, v_at, v_by;
  end if;

  raise notice 'SMOKE D10 OK Quittierung nur gemeinsam, Zwischenzustand abgewiesen';
end
$$;

-- ---------------------------------------------------------------------
-- C) Offline-Synchronisation (public.sync_actions)
--
-- Belegt wird genau das, was app/src/app/api/sync/route.ts zusagt.
-- ---------------------------------------------------------------------

-- D11: Der Urheber stammt aus dem Spaltendefault, nicht aus der Eingabe.
-- route.ts:136-143 setzt actor bewusst NICHT. Der Default kommt aus 0006:11
-- (urspruenglich auth.uid()) und wurde von 0012:280-310 auf
-- app.current_user_id() umgeschrieben.
do $$
declare
  v_monteur uuid := '20b00000-0000-0000-0000-000000000003';
  v_a uuid := '20b00000-0000-0000-0000-0000000000b1';
  v_action uuid := '20b00000-0000-0000-0000-0000000000c1';
  v_actor uuid;
  v_default text;
begin
  perform set_config('app.user_id', v_monteur::text, true);

  insert into public.sync_actions (client_action_id, kind, incident_id)
  values (v_action, 'status', v_a);

  select actor into v_actor
  from public.sync_actions where client_action_id = v_action;
  if v_actor is distinct from v_monteur then
    raise exception 'SMOKE D11 FAIL actor ist % statt der gesetzten Identitaet', v_actor;
  end if;

  select pg_get_expr(d.adbin, d.adrelid) into v_default
  from pg_attrdef d
  join pg_attribute a on a.attrelid = d.adrelid and a.attnum = d.adnum
  where d.adrelid = 'public.sync_actions'::regclass and a.attname = 'actor';
  if v_default is null or v_default not like '%app.current_user_id()%' then
    raise exception 'SMOKE D11 FAIL Spaltendefault von actor ist %', coalesce(v_default, 'NULL');
  end if;

  raise notice 'SMOKE D11 OK actor stammt aus dem Default app.current_user_id()';
end
$$;

-- D12: Idempotenz - derselbe (actor, client_action_id) verletzt die
-- Eindeutigkeit sync_actions_actor_client_uniq (0006:20-22) mit SQLSTATE
-- 23505. Genau daran erkennt route.ts:138-147 einen bereits angewendeten
-- Eintrag.
do $$
declare
  v_monteur uuid := '20b00000-0000-0000-0000-000000000003';
  v_a uuid := '20b00000-0000-0000-0000-0000000000b1';
  v_action uuid := '20b00000-0000-0000-0000-0000000000c1';
  v_rows integer;
begin
  perform set_config('app.user_id', v_monteur::text, true);

  begin
    insert into public.sync_actions (client_action_id, kind, incident_id)
    values (v_action, 'status', v_a);
    raise exception 'SMOKE D12 FAIL derselbe Dedup-Marker wurde zweimal angenommen';
  exception
    -- unique_violation ist genau SQLSTATE 23505.
    when unique_violation then null;
  end;

  select count(*) into v_rows
  from public.sync_actions
  where client_action_id = v_action and actor = v_monteur;
  if v_rows <> 1 then
    raise exception 'SMOKE D12 FAIL % Marker statt genau einem', v_rows;
  end if;

  raise notice 'SMOKE D12 OK zweiter identischer Dedup-Marker verletzt 23505';
end
$$;

-- D13: Identitaetstrennung - dieselbe client_action_id eines ANDEREN
-- Benutzers ist zulaessig. Die Eindeutigkeit ist zusammengesetzt, nicht
-- global; zusaetzlich zeigt sync_actions_select (0006:32-33) jedem nur die
-- eigene Zeile.
--
-- Warum hier KEIN `min(actor)` steht: PostgreSQL kennt kein Aggregat min(uuid)
-- (nur min(text) und die uebrigen ordinalen Typen). Ein `select count(*),
-- min(actor)` bricht deshalb mit 42883 "function min(uuid) does not exist" ab.
-- Die Erwartung bleibt unveraendert scharf und wird nur anders formuliert: die
-- Zaehlung der passenden Zeilen belegt den erwarteten actor, und
-- min(actor::text) dient ausschliesslich der Diagnose in der Fehlermeldung.
-- Bitte nicht auf min(actor) zurueckdrehen.
do $$
declare
  v_monteur uuid := '20b00000-0000-0000-0000-000000000003';
  v_fremd uuid := '20b00000-0000-0000-0000-000000000004';
  v_action uuid := '20b00000-0000-0000-0000-0000000000c1';
  v_own integer;
  v_matching integer;
  v_actor_text text;
begin
  -- Derselbe Wert, andere Identitaet: kein Konflikt.
  perform set_config('app.user_id', v_fremd::text, true);
  insert into public.sync_actions (client_action_id, kind, incident_id)
  values (v_action, 'status', null);

  select count(*),
         count(*) filter (where actor = v_fremd),
         min(actor::text)
    into v_own, v_matching, v_actor_text
  from public.sync_actions where client_action_id = v_action;
  if v_own <> 1 or v_matching <> 1 then
    raise exception 'SMOKE D13 FAIL fremde Sicht zeigt % Zeile(n) mit actor %',
      v_own, coalesce(v_actor_text, 'NULL');
  end if;

  -- Und die Gegenseite sieht weiterhin genau ihre eigene Zeile.
  perform set_config('app.user_id', v_monteur::text, true);
  select count(*),
         count(*) filter (where actor = v_monteur),
         min(actor::text)
    into v_own, v_matching, v_actor_text
  from public.sync_actions where client_action_id = v_action;
  if v_own <> 1 or v_matching <> 1 then
    raise exception 'SMOKE D13 FAIL eigene Sicht zeigt % Zeile(n) mit actor %',
      v_own, coalesce(v_actor_text, 'NULL');
  end if;

  raise notice 'SMOKE D13 OK gleiche client_action_id zweier Identitaeten ohne Konflikt';
end
$$;

-- D14: Rollback statt Kompensation.
--
-- route.ts:28-32 setzt an die Stelle des frueheren Kompensations-DELETE den
-- echten Transaktionsrollback (app/src/lib/db/index.ts:210-227). Der
-- sicherheitsrelevante Punkt: die Delete-Policy aus 0006:39-42 besteht
-- unveraendert weiter (von 0012:331-363 auf app.current_user_id()
-- umgeschrieben). Sie allein wuerde die Kompensation also NICHT verhindern -
-- das leistet ausschliesslich das fehlende Tabellenrecht. Beides wird
-- getrennt belegt.
do $$
declare
  v_monteur uuid := '20b00000-0000-0000-0000-000000000003';
  v_a uuid := '20b00000-0000-0000-0000-0000000000b1';
  v_action uuid := '20b00000-0000-0000-0000-0000000000c1';
  v_rollback_action uuid := '20b00000-0000-0000-0000-0000000000c2';
  v_policies integer;
  v_rows integer;
begin
  perform set_config('app.user_id', v_monteur::text, true);

  -- 1) Kein Tabellenrecht.
  if has_table_privilege('app_user', 'public.sync_actions', 'delete') then
    raise exception 'SMOKE D14 FAIL app_user besitzt delete auf sync_actions';
  end if;

  -- 2) Der Loeschversuch auf dem eigenen Marker wird abgewiesen.
  begin
    delete from public.sync_actions where client_action_id = v_action and actor = v_monteur;
    raise exception 'SMOKE D14 FAIL Kompensation per DELETE wurde zugelassen';
  exception
    when insufficient_privilege then null;
  end;

  -- 3) Die Delete-Policy existiert weiterhin: sie ist NICHT die Schranke.
  select count(*) into v_policies
  from pg_policies
  where schemaname = 'public' and tablename = 'sync_actions' and cmd = 'DELETE';
  if v_policies <> 1 then
    raise exception
      'SMOKE D14 FAIL erwartet genau eine Delete-Policy auf sync_actions, gefunden %',
      v_policies;
  end if;

  -- 4) Der Rollback entfernt den Marker vollstaendig. Ein
  --    Exception-Block in PL/pgSQL ist ein Savepoint; das Zuruecksetzen
  --    entspricht dem `rollback` des Wrappers.
  begin
    insert into public.sync_actions (client_action_id, kind, incident_id)
    values (v_rollback_action, 'status', v_a);

    select count(*) into v_rows
    from public.sync_actions where client_action_id = v_rollback_action;
    if v_rows <> 1 then
      raise exception 'SMOKE D14 FAIL Marker ist innerhalb der Transaktion nicht sichtbar';
    end if;

    -- Erzwungener Fehlschlag mit einem eigenen, sonst nicht verwendeten
    -- SQLSTATE. Ein generisches raise waere von der Behandlung unten nicht
    -- von einem echten FAIL zu unterscheiden.
    raise exception 'SMOKE D14 erzwungener Rollback' using errcode = 'ZD141';
  exception
    when sqlstate 'ZD141' then null;
  end;

  select count(*) into v_rows
  from public.sync_actions where client_action_id = v_rollback_action;
  if v_rows <> 0 then
    raise exception 'SMOKE D14 FAIL Marker ueberlebt den Rollback (% Zeile(n))', v_rows;
  end if;

  raise notice 'SMOKE D14 OK kein delete-Recht, DELETE abgewiesen, Rollback nimmt den Marker zurueck';
end
$$;

-- D15: Konfliktbasis - eine serverseitige Aenderung verschiebt
-- incidents.updated_at, sodass eine veraltete Basis erkennbar wird.
-- Entspricht der Pruefung in route.ts:179-200; updated_at wird vom Trigger
-- tg_touch_updated (0001:81-87) gepflegt.
do $$
declare
  v_dispo uuid := '20b00000-0000-0000-0000-000000000002';
  v_a uuid := '20b00000-0000-0000-0000-0000000000b1';
  v_base timestamptz;
  v_server timestamptz;
begin
  perform set_config('app.user_id', v_dispo::text, true);

  -- Konfliktbasis des Clients (Stand vor der Aenderung).
  select updated_at into v_base from public.incidents where id = v_a;

  update public.incidents set status = 'in_bearbeitung' where id = v_a;

  select updated_at into v_server from public.incidents where id = v_a;

  if v_server is null or v_base is null then
    raise exception 'SMOKE D15 FAIL updated_at ist NULL (basis=% server=%)', v_base, v_server;
  end if;
  if v_server <= v_base then
    raise exception
      'SMOKE D15 FAIL updated_at bleibt stehen (basis=% server=%)', v_base, v_server;
  end if;

  raise notice 'SMOKE D15 OK serverseitige Aenderung macht die veraltete Konfliktbasis erkennbar';
end
$$;

-- D16: Ein Monteur setzt ueber den Sync keinen Status, der ihm fachlich nicht
-- erlaubt ist.
--
-- Zwei Schranken, die nicht deckungsgleich sind - beides gelesen, nicht
-- angenommen:
--   * Datenbankseitig weist der Trigger tg_incident_guard (0001:394-417)
--     genau 'durch_disposition_geprueft', 'abgeschlossen' und 'storniert' fuer
--     jeden Nichtstaff mit gesetzter Identitaet mit 42501 ab. Das ist die hier
--     nachgewiesene Wirkung.
--   * Die Anwendung ist strenger: MONTEUR_STATUS
--     (app/src/lib/status.ts:188-200) laesst zusaetzlich 'neu',
--     'monteur_zugewiesen' und 'dokumentation_vollstaendig' nicht zu, und
--     route.ts:171-173 lehnt sie ab. Der Kommentar in status.ts:187
--     ("Deckungsgleich mit dem DB-Trigger") trifft fuer diese drei Werte also
--     nicht zu; die Anwendungsschranke ist die engere. Datenbankseitig ist
--     dieser Teil nicht pruefbar und wird hier bewusst NICHT behauptet.
do $$
declare
  v_monteur uuid := '20b00000-0000-0000-0000-000000000003';
  v_a uuid := '20b00000-0000-0000-0000-0000000000b1';
  v_status public.incident_status;
  v_rows integer;
begin
  perform set_config('app.user_id', v_monteur::text, true);

  begin
    update public.incidents set status = 'abgeschlossen' where id = v_a;
    raise exception 'SMOKE D16 FAIL Monteur darf den Vorgang abschliessen';
  exception
    when insufficient_privilege then null;
  end;

  begin
    update public.incidents set status = 'storniert' where id = v_a;
    raise exception 'SMOKE D16 FAIL Monteur darf den Vorgang stornieren';
  exception
    when insufficient_privilege then null;
  end;

  -- Gegenprobe: ein fachlich zulaessiger Wechsel wird nicht behindert.
  update public.incidents set status = 'technisch_abgeschlossen' where id = v_a;
  get diagnostics v_rows = row_count;
  select status into v_status from public.incidents where id = v_a;
  if v_rows <> 1 or v_status <> 'technisch_abgeschlossen' then
    raise exception 'SMOKE D16 FAIL zulaessiger Wechsel schlaegt fehl (zeilen=% status=%)',
      v_rows, v_status;
  end if;

  raise notice 'SMOKE D16 OK Statuswechsel-Guard weist den Monteur ab, zulaessiger Wechsel greift';
end
$$;

-- D17: Notizen ueber den Sync - anhaengbar am eigenen, nicht am fremden
-- Vorgang. Entspricht route.ts:154-164; Grundlage sind notes_insert
-- (0001:563-564) und `grant select, insert` ohne update/delete (0014:63).
do $$
declare
  v_monteur uuid := '20b00000-0000-0000-0000-000000000003';
  v_a uuid := '20b00000-0000-0000-0000-0000000000b1';
  v_b uuid := '20b00000-0000-0000-0000-0000000000b2';
  v_before integer;
  v_after integer;
begin
  perform set_config('app.user_id', v_monteur::text, true);

  select count(*) into v_before from public.incident_notes where incident_id = v_a;

  insert into public.incident_notes (incident_id, body, note_type)
  values (v_a, 'D20 synthetische Offline-Notiz', 'allgemein');

  select count(*) into v_after from public.incident_notes where incident_id = v_a;
  if v_after - v_before <> 1 then
    raise exception 'SMOKE D17 FAIL Notiz am eigenen Vorgang ergibt Differenz %', v_after - v_before;
  end if;

  begin
    insert into public.incident_notes (incident_id, body, note_type)
    values (v_b, 'D20 unzulaessige Notiz', 'allgemein');
    raise exception 'SMOKE D17 FAIL Monteur haengt eine Notiz an einen fremden Vorgang';
  exception
    when insufficient_privilege then null;
  end;

  raise notice 'SMOKE D17 OK Notiz am eigenen Vorgang zulaessig, am fremden abgewiesen';
end
$$;

-- ---------------------------------------------------------------------
-- D) Rechtematrix
-- ---------------------------------------------------------------------

-- D18: Stichprobe des Zielzustands aus 0014. has_table_privilege
-- beruecksichtigt die Gruppenmitgliedschaft, deckt also auch ein mittelbar
-- geerbtes Recht auf.
--
-- Der gemessene Rechtestand ist seit 19a_ap14b_grant_reset.sql tatsaechlich der
-- finale 0014-Stand und stammt NICHT mehr aus den pauschalen Alt-Grants der
-- Smokes 15-18: 19a nimmt diese Pauschalrechte unmittelbar vor dieser Datei
-- gegen app_user zurueck, stellt die produktseitigen Direktrechte aus 0012 her
-- und wendet 0014 anschliessend erneut an.
--
-- Genau deshalb sind hier jetzt auch die beiden Rechte pruefbar, ueber die der
-- Smoke frueher bewusst nichts behauptet hat: `update` auf
-- public.incident_notes (Notizen sind unveraenderlich, 0014:62-63) und
-- `insert` auf public.incident_status_history (die Chronik schreibt
-- ausschliesslich der Definer-Trigger, 0014:41-43). Beide fehlen jetzt
-- tatsaechlich und werden unten als Negativprobe gefuehrt.
do $$
declare
  item record;
  v_wrong text[] := array[]::text[];
begin
  for item in
    select * from (values
      ('public.incidents', 'select', true),
      ('public.incidents', 'insert', true),
      ('public.incidents', 'update', true),
      ('public.incidents', 'delete', false),
      ('public.incident_notes', 'select', true),
      ('public.incident_notes', 'insert', true),
      ('public.incident_notes', 'update', false),
      ('public.incident_notes', 'delete', false),
      ('public.incident_tasks', 'select', true),
      ('public.incident_tasks', 'update', true),
      ('public.incident_tasks', 'delete', false),
      ('public.sync_actions', 'select', true),
      ('public.sync_actions', 'insert', true),
      ('public.sync_actions', 'delete', false),
      ('public.incident_list_view', 'select', true),
      ('public.incident_status_history', 'select', true),
      ('public.incident_status_history', 'insert', false),
      -- Neu aus 0014: Voraussetzung der Vorgangs-Lesewege, die die
      -- Standardvorbelegung jetzt selbst aus PostgreSQL lesen.
      ('public.app_settings', 'select', true),
      -- Herkunft 0012:114 - Mindestrecht der Sitzungsauswertung, hier nur
      -- geprueft und von 0014 nicht erteilt.
      ('public.profiles', 'select', true),
      -- Negativproben, die belegen, dass die Alt-Grants zurueckgenommen sind
      -- und diese Matrix wirklich den 0014-Stand misst:
      --   * public.inventory_movements bekommt von KEINER Migration ein Recht
      --     fuer app_user oder authenticated; ein Treffer koennte nur aus den
      --     Pauschal-Grants der Smokes 15-18 stammen.
      --   * auf public.customers erteilt 0014 ausdruecklich nur select.
      ('public.inventory_movements', 'select', false),
      ('public.customers', 'select', true),
      ('public.customers', 'insert', false),
      ('public.audit_events', 'select', false),
      ('public.audit_events', 'insert', false),
      ('public.audit_events', 'update', false),
      ('public.audit_events', 'delete', false)
    ) as t(object_name, privilege, expected)
  loop
    if has_table_privilege('app_user', item.object_name, item.privilege) <> item.expected then
      v_wrong := array_append(
        v_wrong,
        item.object_name || ' ' || item.privilege || ' erwartet ' || item.expected::text);
    end if;
  end loop;

  if array_length(v_wrong, 1) is not null then
    raise exception 'SMOKE D18 FAIL Rechtematrix abweichend: %', array_to_string(v_wrong, ', ');
  end if;

  raise notice 'SMOKE D18 OK Rechtematrix entspricht dem Zielzustand aus 0014';
end
$$;

-- D19: app_user bleibt eine nicht privilegierte Rolle. Ohne diese Pruefung
-- waeren alle Faelle oben wertlos: mit SUPERUSER oder BYPASSRLS gilt keine
-- Policy.
do $$
declare
  v_flags record;
begin
  select rolsuper, rolbypassrls
  into v_flags
  from pg_roles where rolname = 'app_user';

  if v_flags is null then
    raise exception 'SMOKE D19 FAIL Rolle app_user fehlt';
  end if;
  if v_flags.rolsuper or v_flags.rolbypassrls then
    raise exception 'SMOKE D19 FAIL app_user ist privilegiert (super=% bypassrls=%)',
      v_flags.rolsuper, v_flags.rolbypassrls;
  end if;

  raise notice 'SMOKE D19 OK app_user ohne SUPERUSER und ohne BYPASSRLS';
end
$$;

-- ---------------------------------------------------------------------
-- E) Vorgangsanlage, Vorgangspflege, Zuweisung und Massenaktion
--
-- D20-D24 rufen genau die Fachfunktionen auf, die 0014 der Rolle app_user
-- freigibt (0014:87-103) und die die Anwendungsmodule benutzen. Alle Aufrufe
-- sind positions- und typgenau nach den Signaturen in 0010 bzw. 0011.
-- D25 belegt datenbankseitig die Zaehlung der Vorgangsliste.
-- ---------------------------------------------------------------------

-- D20: Disposition legt einen Vorgang ueber create_incident_ap12 an, ein
-- Monteur darf dieselbe Anlage nicht ausfuehren.
--
-- Die Abweisung des Monteurs kommt NICHT aus dem Ausfuehrungsrecht - app_user
-- ist dieselbe Rolle fuer alle Identitaeten und besitzt es (0014:88-91) -,
-- sondern aus incidents_insert `with check (is_staff())` (0001:542-543):
-- create_incident_ap12 ist SECURITY INVOKER (0010:107), die Policy bleibt also
-- massgeblich.
--
-- Der angelegte Vorgang traegt 'D20-AP12' in external_reference; D21 findet ihn
-- darueber wieder, weil die Kennung von der Datenbank vergeben wird.
do $$
declare
  v_dispo uuid := '20b00000-0000-0000-0000-000000000002';
  v_monteur uuid := '20b00000-0000-0000-0000-000000000003';
  v_customer uuid := '20b00000-0000-0000-0000-0000000000a3';
  v_stage uuid := '20b00000-0000-0000-0000-0000000000a1';
  v_vzg uuid := '20b00000-0000-0000-0000-0000000000a2';
  v_cable uuid := '20b00000-0000-0000-0000-0000000000a4';
  v_positions jsonb;
  v_new uuid;
  v_status public.incident_status;
  v_count integer;
begin
  -- Zwei Positionen: D21 uebermittelt spaeter nur noch die erste.
  v_positions := jsonb_build_array(
    jsonb_build_object(
      'cable_type_id', v_cable::text,
      'quantity_value', '12.500',
      'quantity_unit', 'meter',
      'condition_code', 'ready'),
    jsonb_build_object(
      'cable_type_id', v_cable::text,
      'quantity_value', '3',
      'quantity_unit', 'piece',
      'condition_code', 'restricted'));

  perform set_config('app.user_id', v_dispo::text, true);

  -- 21 Parameter in der Reihenfolge aus 0010:83-104.
  v_new := public.create_incident_ap12(
    v_customer,                                         -- p_customer_id
    v_stage,                                            -- p_construction_stage_id
    v_vzg,                                              -- p_vzg_line_id
    null::uuid,                                         -- p_on_call_number_id
    'normal'::public.incident_priority,                 -- p_priority
    'AP14B Daten - Anlage ueber create_incident_ap12',  -- p_description
    null::text,                                         -- p_operating_point
    null::text,                                         -- p_track
    null::text,                                         -- p_direction
    null::text,                                         -- p_object_type
    null::text,                                         -- p_object_designation
    null::text,                                         -- p_location_description
    'D20-AP12'::text,                                   -- p_external_reference
    20.500::numeric,                                    -- p_km_from
    null::numeric,                                      -- p_km_to
    null::text,                                         -- p_caller_name
    null::text,                                         -- p_caller_contact
    null::text,                                         -- p_internal_note
    null::uuid,                                         -- p_contact_id
    null::uuid,                                         -- p_contact_phone_number_id
    v_positions);                                       -- p_cable_positions

  if v_new is null then
    raise exception 'SMOKE D20 FAIL create_incident_ap12 liefert keine Kennung';
  end if;

  select status into v_status from public.incidents where id = v_new;
  select count(*) into v_count
  from public.incident_cable_positions where incident_id = v_new;
  if v_status is distinct from 'neu' or v_count <> 2 then
    raise exception 'SMOKE D20 FAIL status=% kabelpositionen=%, erwartet neu und 2',
      v_status, v_count;
  end if;

  -- Gegenprobe: derselbe Aufruf unter einer Monteur-Identitaet.
  perform set_config('app.user_id', v_monteur::text, true);
  begin
    perform public.create_incident_ap12(
      v_customer, v_stage, v_vzg, null::uuid, 'normal'::public.incident_priority,
      'AP14B Daten - Monteur-Anlageversuch ueber RPC',
      null::text, null::text, null::text, null::text, null::text, null::text,
      'D20-AP12-MONTEUR'::text, 20.600::numeric, null::numeric,
      null::text, null::text, null::text, null::uuid, null::uuid, v_positions);
    raise exception 'SMOKE D20 FAIL Monteur legt einen Vorgang ueber die RPC an';
  exception
    when insufficient_privilege then null;
  end;

  raise notice
    'SMOKE D20 OK Disposition legt an (2 Kabelpositionen), Monteur wird abgewiesen';
end
$$;

-- D21: Disposition aendert den Vorgang ueber update_incident_ap12.
--
-- Zwei Wirkungen in EINEM Aufruf (0010:335-387):
--   * die mitgegebene Kabelposition behaelt ihre id und wird aktualisiert,
--   * die nicht uebermittelte Position wird geloescht (0010:386-387).
-- Damit wird das in 0014:61 erteilte `delete` auf incident_cable_positions
-- tatsaechlich ausgeuebt und nicht nur behauptet.
do $$
declare
  v_dispo uuid := '20b00000-0000-0000-0000-000000000002';
  v_customer uuid := '20b00000-0000-0000-0000-0000000000a3';
  v_stage uuid := '20b00000-0000-0000-0000-0000000000a1';
  v_vzg uuid := '20b00000-0000-0000-0000-0000000000a2';
  v_cable uuid := '20b00000-0000-0000-0000-0000000000a4';
  v_target uuid;
  v_keep uuid;
  v_drop uuid;
  v_left uuid;
  v_count integer;
  v_quantity numeric(12,3);
  v_condition text;
begin
  perform set_config('app.user_id', v_dispo::text, true);

  select id into v_target
  from public.incidents where external_reference = 'D20-AP12';
  if v_target is null then
    raise exception 'SMOKE D21 FAIL Vorgang aus D20 nicht gefunden';
  end if;

  select id into v_keep
  from public.incident_cable_positions
  where incident_id = v_target order by sort_order limit 1;
  select id into v_drop
  from public.incident_cable_positions
  where incident_id = v_target order by sort_order desc limit 1;
  if v_keep is null or v_drop is null or v_keep = v_drop then
    raise exception 'SMOKE D21 FAIL zwei unterscheidbare Positionen erwartet (behalten=% entfallen=%)',
      v_keep, v_drop;
  end if;

  -- 22 Parameter in der Reihenfolge aus 0010:200-222.
  perform public.update_incident_ap12(
    v_target,                                             -- p_id
    v_customer,                                           -- p_customer_id
    v_stage,                                              -- p_construction_stage_id
    v_vzg,                                                -- p_vzg_line_id
    null::uuid,                                           -- p_on_call_number_id
    'hoch'::public.incident_priority,                     -- p_priority
    'AP14B Daten - Aenderung ueber update_incident_ap12', -- p_description
    null::text,                                           -- p_operating_point
    null::text,                                           -- p_track
    null::text,                                           -- p_direction
    null::text,                                           -- p_object_type
    null::text,                                           -- p_object_designation
    null::text,                                           -- p_location_description
    'D20-AP12'::text,                                     -- p_external_reference
    20.500::numeric,                                      -- p_km_from
    null::numeric,                                        -- p_km_to
    null::text,                                           -- p_caller_name
    null::text,                                           -- p_caller_contact
    null::text,                                           -- p_internal_note
    null::uuid,                                           -- p_contact_id
    null::uuid,                                           -- p_contact_phone_number_id
    jsonb_build_array(jsonb_build_object(                 -- p_cable_positions
      'id', v_keep::text,
      'cable_type_id', v_cable::text,
      'quantity_value', '15.000',
      'quantity_unit', 'meter',
      'condition_code', 'damaged')));

  select count(*) into v_count
  from public.incident_cable_positions where incident_id = v_target;
  select id, quantity_value, condition_code
    into v_left, v_quantity, v_condition
  from public.incident_cable_positions where incident_id = v_target;

  if v_count <> 1 or v_left is distinct from v_keep
     or v_quantity is distinct from 15.000 or v_condition is distinct from 'damaged' then
    raise exception 'SMOKE D21 FAIL positionen=% id=% menge=% zustand=%',
      v_count, v_left, v_quantity, v_condition;
  end if;
  if exists (select 1 from public.incident_cable_positions where id = v_drop) then
    raise exception 'SMOKE D21 FAIL nicht uebermittelte Kabelposition besteht weiter';
  end if;

  raise notice
    'SMOKE D21 OK mitgegebene Position behaelt ihre id, nicht uebermittelte wird geloescht';
end
$$;

-- D22: Einzelzuweisung ueber assign_incident_monteur_ap13 (0011:458-545).
-- Entspricht assignIncidentMonteur (app/src/lib/incidents.ts).
--
-- Konfliktbasis sind incidents.updated_at UND die erwartete sortierte Menge
-- aktiver monteur_ids (0011:502-518). Geprueft wird der Erfolgsfall und der
-- Konflikt aus einer veralteten Zeitbasis.
do $$
declare
  v_dispo uuid := '20b00000-0000-0000-0000-000000000002';
  v_monteur uuid := '20b00000-0000-0000-0000-000000000003';
  v_c uuid := '20b00000-0000-0000-0000-0000000000b3';
  v_base timestamptz;
  v_code text;
  v_active integer;
  v_status public.incident_status;
begin
  perform set_config('app.user_id', v_dispo::text, true);

  select updated_at into v_base from public.incidents where id = v_c;
  if v_base is null then
    raise exception 'SMOKE D22 FAIL Vorgang ...b3 ist fuer die Disposition nicht sichtbar';
  end if;

  -- Erfolgsfall: aktuelle Zeitbasis, erwartete Monteurmenge noch leer.
  v_code := public.assign_incident_monteur_ap13(v_c, v_monteur, v_base, array[]::uuid[]);
  if v_code is distinct from 'ok' then
    raise exception 'SMOKE D22 FAIL Zuweisung liefert code=% statt ok', v_code;
  end if;

  select count(*) into v_active
  from public.incident_assignments
  where incident_id = v_c and monteur_id = v_monteur and is_active;
  select status into v_status from public.incidents where id = v_c;
  if v_active <> 1 or v_status is distinct from 'monteur_zugewiesen' then
    raise exception 'SMOKE D22 FAIL aktive Zuweisungen=% status=%', v_active, v_status;
  end if;

  -- Konfliktfall: veraltete Zeitbasis. Der Aufruf bleibt wirkungslos.
  v_code := public.assign_incident_monteur_ap13(
    v_c, v_monteur, v_base - interval '1 hour', array[v_monteur]::uuid[]);
  if v_code is distinct from 'conflict' then
    raise exception 'SMOKE D22 FAIL veraltete Zeitbasis liefert code=% statt conflict', v_code;
  end if;

  select count(*) into v_active
  from public.incident_assignments where incident_id = v_c and is_active;
  if v_active <> 1 then
    raise exception 'SMOKE D22 FAIL Konfliktfall veraendert den Bestand (% aktive Zuweisungen)',
      v_active;
  end if;

  raise notice 'SMOKE D22 OK Zuweisung ergibt ok, veraltete Zeitbasis ergibt conflict';
end
$$;

-- D23: Massenstatusaenderung ueber bulk_update_incident_status_ap13
-- (0011:380-448). Entspricht der Massenaktion aus incident-list-actions.
--
-- Zum Ergebniscode 'invalid_status' - er wird hier bewusst NICHT behauptet,
-- weil er aus diesem Smoke heraus nicht erreichbar ist: er entsteht
-- ausschliesslich, wenn das UPDATE der Statusspalte check_violation,
-- invalid_parameter_value oder foreign_key_violation ausloest (0011:443-445).
-- Auf public.incidents gibt es keine solche Bedingung - die einzige
-- Check-Bedingung ist incidents_km_order (0001:206), die ein Statuswechsel
-- nicht beruehrt; der fachliche Statusschutz sitzt in tg_incident_guard und
-- meldet 42501, also 'guard_rejected' (0011:440-442). Ein unbekannter
-- Statuswert wiederum erreicht die Funktion gar nicht: p_new_status ist vom
-- Typ public.incident_status, die Umwandlung scheitert schon beim Aufruf mit
-- 22P02. Genau das - und nur das - wird unten belegt.
do $$
declare
  v_dispo uuid := '20b00000-0000-0000-0000-000000000002';
  v_d uuid := '20b00000-0000-0000-0000-0000000000b4';
  v_base timestamptz;
  v_code text;
  v_status public.incident_status;
  v_unknown text := 'kein_gueltiger_status';
begin
  perform set_config('app.user_id', v_dispo::text, true);

  select updated_at into v_base from public.incidents where id = v_d;
  if v_base is null then
    raise exception 'SMOKE D23 FAIL Vorgang ...b4 ist fuer die Disposition nicht sichtbar';
  end if;

  -- Erfolgsfall: aktuelle Konfliktbasis.
  select code into v_code
  from public.bulk_update_incident_status_ap13(
    jsonb_build_array(jsonb_build_object(
      'id', v_d::text, 'expected_updated_at', v_base::text)),
    'in_bearbeitung'::public.incident_status);
  select status into v_status from public.incidents where id = v_d;
  if v_code is distinct from 'ok' or v_status is distinct from 'in_bearbeitung' then
    raise exception 'SMOKE D23 FAIL Erfolgsfall liefert code=% status=%', v_code, v_status;
  end if;

  -- Konfliktfall: veraltete Konfliktbasis, der Status bleibt stehen.
  select code into v_code
  from public.bulk_update_incident_status_ap13(
    jsonb_build_array(jsonb_build_object(
      'id', v_d::text, 'expected_updated_at', (v_base - interval '1 hour')::text)),
    'vor_ort'::public.incident_status);
  select status into v_status from public.incidents where id = v_d;
  if v_code is distinct from 'conflict' or v_status is distinct from 'in_bearbeitung' then
    raise exception 'SMOKE D23 FAIL Konfliktfall liefert code=% status=%', v_code, v_status;
  end if;

  -- Unbekannter Statuswert: 22P02 bereits bei der Umwandlung des Arguments.
  begin
    perform public.bulk_update_incident_status_ap13(
      jsonb_build_array(jsonb_build_object(
        'id', v_d::text, 'expected_updated_at', v_base::text)),
      v_unknown::public.incident_status);
    raise exception 'SMOKE D23 FAIL unbekannter Statuswert wurde angenommen';
  exception
    when invalid_text_representation then null;
  end;

  raise notice
    'SMOKE D23 OK Massenaktion ergibt ok und conflict, unbekannter Status scheitert mit 22P02';
end
$$;

-- D24: Zustandsbewertung.
--
-- Ausdrueckliche Abweichung vom Auftragstext: die Zustandsbewertung
-- condition_rating sitzt auf public.incidents (Spalte 0001:177, Aufzaehlung
-- 0001:25-29), NICHT auf public.incident_cable_positions. Diese Tabelle traegt
-- die positionsbezogene Zustandsangabe condition_code (0010:38-41), die bereits
-- D20 und D21 ueber die AP12-RPCs ausueben. Geprueft wird deshalb genau der
-- Weg, den updateCondition() geht (app/src/lib/incident-actions.ts:455-462).
do $$
declare
  v_dispo uuid := '20b00000-0000-0000-0000-000000000002';
  v_fremd uuid := '20b00000-0000-0000-0000-000000000004';
  v_b uuid := '20b00000-0000-0000-0000-0000000000b2';
  v_rows integer;
  v_rating public.condition_rating;
begin
  perform set_config('app.user_id', v_dispo::text, true);

  update public.incidents
     set condition_rating = 'geringfuegig_beschaedigt'
   where id = v_b;
  get diagnostics v_rows = row_count;
  select condition_rating into v_rating from public.incidents where id = v_b;
  if v_rows <> 1 or v_rating is distinct from 'geringfuegig_beschaedigt' then
    raise exception 'SMOKE D24 FAIL Staff-Bewertung (zeilen=% wert=%)', v_rows, v_rating;
  end if;

  -- Gegenprobe fuer den fremden Monteur. Wie in D7 ist die Wirkung KEIN Fehler,
  -- sondern die leere Treffermenge aus der USING-Klausel von incidents_update
  -- (0001:544-546); der Nachweis ist der Zeilenzaehler samt unveraendertem Wert.
  perform set_config('app.user_id', v_fremd::text, true);
  update public.incidents
     set condition_rating = 'nicht_betriebsbereit'
   where id = v_b;
  get diagnostics v_rows = row_count;
  if v_rows <> 0 then
    raise exception 'SMOKE D24 FAIL fremder Monteur bewertet % Zeile(n)', v_rows;
  end if;

  perform set_config('app.user_id', v_dispo::text, true);
  select condition_rating into v_rating from public.incidents where id = v_b;
  if v_rating is distinct from 'geringfuegig_beschaedigt' then
    raise exception 'SMOKE D24 FAIL Bewertung wurde vom fremden Monteur veraendert (%)', v_rating;
  end if;

  raise notice
    'SMOKE D24 OK Staff bewertet den Zustand, fremder Monteur trifft keine Zeile';
end
$$;

-- D25: Gesamtzahl der Vorgangsliste jenseits des angeforderten Bereichs.
--
-- Datenbankseitiger Beleg fuer die Zaehlung in fetchList
-- (app/src/lib/incidents.ts): `count(*) over ()` ist eine SPALTE der
-- Ergebniszeilen. Liegt der OFFSET hinter der Treffermenge, kommt keine Zeile
-- und damit auch keine Gesamtzahl zurueck; `select count(*)` ueber dieselbe
-- WHERE-Klausel liefert sie unabhaengig vom Bereich. Gezaehlt wird ueber die
-- eigene Bauabschnittskennung, nicht ueber die ganze Liste.
do $$
declare
  v_dispo uuid := '20b00000-0000-0000-0000-000000000002';
  v_stage uuid := '20b00000-0000-0000-0000-0000000000a1';
  v_total integer;
  v_rows integer;
  v_window integer;
begin
  perform set_config('app.user_id', v_dispo::text, true);

  select count(*)::int into v_total
  from public.incident_list_view
  where construction_stage_id = v_stage;
  if v_total < 1 then
    raise exception 'SMOKE D25 FAIL keine Listenzeile fuer den eigenen Bauabschnitt';
  end if;

  -- Innerhalb der Menge: das Fenster liefert die vollstaendige Gesamtzahl.
  select count(*)::int, min(w.total_count)
    into v_rows, v_window
  from (
    select (count(*) over ())::int as total_count
    from public.incident_list_view
    where construction_stage_id = v_stage
    order by updated_at desc
    limit 1 offset 0
  ) w;
  if v_rows <> 1 or v_window is distinct from v_total then
    raise exception 'SMOKE D25 FAIL Fensterzaehlung im Bereich: zeilen=% zahl=% erwartet %',
      v_rows, v_window, v_total;
  end if;

  -- Jenseits der Menge: keine Zeile, also auch keine Gesamtzahl.
  select count(*)::int, min(w.total_count)
    into v_rows, v_window
  from (
    select (count(*) over ())::int as total_count
    from public.incident_list_view
    where construction_stage_id = v_stage
    order by updated_at desc
    limit 50 offset v_total
  ) w;
  if v_rows <> 0 or v_window is not null then
    raise exception 'SMOKE D25 FAIL Fensterzaehlung jenseits des Bereichs: zeilen=% zahl=%',
      v_rows, v_window;
  end if;

  -- Dieselbe WHERE-Klausel als eigene Zaehlung: die Gesamtzahl bleibt richtig.
  select count(*)::int into v_rows
  from public.incident_list_view
  where construction_stage_id = v_stage;
  if v_rows <> v_total then
    raise exception 'SMOKE D25 FAIL getrennte Zaehlung liefert % statt %', v_rows, v_total;
  end if;

  raise notice
    'SMOKE D25 OK jenseits des OFFSET liefert das Fenster keine Zahl (% Treffer), die getrennte Zaehlung schon',
    v_total;
end
$$;

-- ---------------------------------------------------------------------
-- F) Ausfuehrungsrechte
--
-- Der Ausfuehrungsrechteteil von 0014 (Abschnitt 3) war bisher in dieser Datei
-- vollstaendig ungeprueft: es gab keine einzige has_function_privilege-Probe.
-- D26 holt das im Katalog nach, D27 belegt die Wirkung zusaetzlich zur
-- Laufzeit. Beide Faelle stehen bewusst am Dateiende, damit die Zuweisung in
-- D27 keine Erwartung eines frueheren Falls verschieben kann.
-- ---------------------------------------------------------------------

-- D26: Ausfuehrungsrechte der Rolle app_user, positiv und negativ.
-- has_function_privilege beruecksichtigt die Gruppenmitgliedschaft; ein ueber
-- authenticated geerbtes Recht faellt hier also ebenso auf wie eine
-- Direktvergabe. Die Signaturen sind zeichengenau die aus 0014, Abschnitt 3.
do $$
declare
  signature text;
  v_wrong text[] := array[]::text[];
begin
  -- Erteilt (0014): die sieben Fachfunktionen der Anwendungsmodule.
  foreach signature in array array[
    'public.get_assigned_incident_contact(uuid)',
    'public.create_incident_ap12(uuid, uuid, uuid, uuid, public.incident_priority, '
      || 'text, text, text, text, text, text, text, text, numeric, numeric, '
      || 'text, text, text, uuid, uuid, jsonb)',
    'public.update_incident_ap12(uuid, uuid, uuid, uuid, uuid, public.incident_priority, '
      || 'text, text, text, text, text, text, text, text, numeric, numeric, '
      || 'text, text, text, uuid, uuid, jsonb)',
    'public.bulk_update_incident_status_ap13(jsonb, public.incident_status)',
    'public.assign_incident_monteur_ap13(uuid, uuid, timestamptz, uuid[])',
    'public.bulk_assign_incident_monteur_ap13(jsonb, uuid)',
    'public.get_assigned_incident_tasks(uuid)'
  ]
  loop
    if not has_function_privilege('app_user', signature, 'execute') then
      v_wrong := array_append(v_wrong, signature || ' fehlt');
    end if;
  end loop;

  -- Entzogen: die Refresh-RPC (0014, Abschnitt 3) und die interne
  -- Reconciliation (0011:241).
  foreach signature in array array[
    'public.refresh_incident_tasks_ap13(uuid)',
    'public.sync_incident_tasks_internal(uuid)'
  ]
  loop
    if has_function_privilege('app_user', signature, 'execute') then
      v_wrong := array_append(v_wrong, signature || ' unerwartet vorhanden');
    end if;
  end loop;

  if array_length(v_wrong, 1) is not null then
    raise exception 'SMOKE D26 FAIL Ausfuehrungsrechte abweichend: %',
      array_to_string(v_wrong, ', ');
  end if;

  raise notice 'SMOKE D26 OK sieben Fachfunktionen ausfuehrbar, Refresh und interne Ableitung entzogen';
end
$$;

-- D27: Der Entzug der Refresh-RPC wirkt zur LAUFZEIT - und der interne
-- Ableitungspfad bleibt davon unberuehrt.
--
-- Teil 1 belegt den Entzug trotz Rollenvererbung: 0011:315 hatte das Recht an
-- authenticated erteilt, und app_user ist ueber bootstrap/01_roles.sql:21
-- Mitglied dieser Rolle. Erst der Entzug in 0014 gegen public, anon,
-- authenticated UND app_user macht den Aufruf unmoeglich; erwartet wird
-- 42501 aus der Rechtepruefung, nicht die Staff-Pruefung in der Funktion.
--
-- Teil 2 belegt, dass damit nichts Fachliches verloren geht: die Trigger aus
-- 0011:267-281 rufen public.sync_incident_tasks_internal(uuid) auf, und eine
-- Triggerfunktion laeuft ohne Ausfuehrungsrecht des aufrufenden Benutzers.
-- Benutzt wird der bereits vorhandene synthetische Vorgang ...b4. Er ist mit
-- D23 fertig ausgewertet (dort nur Statuswechsel, keine Zuweisung), hat bis
-- hierher ueberhaupt keine Zuweisung, und es folgt kein weiterer Fall. Die
-- abgeleitete Aufgabe no_monteur entstand beim Anlegen des Vorgangs
-- (trg_sync_tasks_incidents) und muss deshalb vorher 'open' sein; die Zuweisung
-- loest trg_sync_tasks_assignments aus und setzt sie auf 'void'. Ein reiner
-- Statuswechsel wie in D23 feuert den Trigger nicht: er haengt an
-- vzg_line_id/vzg_line_number (0011:267-269).
do $$
declare
  v_dispo uuid := '20b00000-0000-0000-0000-000000000002';
  v_monteur uuid := '20b00000-0000-0000-0000-000000000003';
  v_d uuid := '20b00000-0000-0000-0000-0000000000b4';
  v_before text;
  v_after text;
begin
  perform set_config('app.user_id', v_dispo::text, true);

  begin
    perform public.refresh_incident_tasks_ap13(v_d);
    raise exception 'SMOKE D27 FAIL Refresh-RPC ist fuer app_user weiterhin aufrufbar';
  exception
    when insufficient_privilege then null;
  end;

  select status into v_before
  from public.incident_tasks
  where incident_id = v_d and task_type = 'no_monteur' and source = 'derived';
  if v_before is distinct from 'open' then
    raise exception
      'SMOKE D27 FAIL abgeleitete Aufgabe no_monteur steht vor der Zuweisung auf %',
      coalesce(v_before, 'NULL');
  end if;

  insert into public.incident_assignments (incident_id, monteur_id)
  values (v_d, v_monteur);

  select status into v_after
  from public.incident_tasks
  where incident_id = v_d and task_type = 'no_monteur' and source = 'derived';
  if v_after is distinct from 'void' then
    raise exception
      'SMOKE D27 FAIL Triggerpfad leitet nicht ab (no_monteur=% statt void)',
      coalesce(v_after, 'NULL');
  end if;

  raise notice
    'SMOKE D27 OK Refresh-RPC mit 42501 abgewiesen, Triggerpfad leitet weiterhin ab (open -> void)';
end
$$;

reset role;
select set_config('app.user_id', '', false);

do $$
begin
  raise notice
    'SMOKE D-ENDE OK AP14B-Datenschicht D1-D27 unter app_user mit aktiver RLS belegt';
end
$$;
