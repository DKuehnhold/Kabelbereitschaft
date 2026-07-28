-- =====================================================================
-- AP13 – Smoke-Test (Aufgabenmodell, Ableitung, minimierte Monteur-Sicht,
-- Massenaktionen mit Konfliktpruefung und Einzelauditierung).
-- Erwartet: 00_stub_auth_storage.sql + Migrationen 0001-0011.
-- Grundlage: Roadmap B.3, Version 1.13.
-- =====================================================================
\set ON_ERROR_STOP on
\pset pager off

reset role;
select set_config('test.uid', '', false);

insert into auth.users (id, email, raw_user_meta_data) values
  ('f1000000-0000-0000-0000-000000000001','admin13@t','{"full_name":"Admin13","role":"admin"}'),
  ('f1000000-0000-0000-0000-000000000002','dispo13@t','{"full_name":"Dispo13","role":"disponent"}'),
  ('f1000000-0000-0000-0000-000000000003','monteur13@t','{"full_name":"Monteur13"}'),
  ('f1000000-0000-0000-0000-000000000004','fremd13@t','{"full_name":"Fremd13"}')
on conflict (id) do nothing;

do $$ begin if not exists (select 1 from pg_roles where rolname='app_user') then create role app_user; end if; end $$;
grant usage on schema public to app_user;
grant select, insert, update, delete on all tables in schema public to app_user;
grant usage, select on all sequences in schema public to app_user;
grant usage on schema auth to app_user;
grant select on auth.users to app_user;
grant execute on function public.get_assigned_incident_tasks(uuid) to app_user;
grant execute on function public.refresh_incident_tasks_ap13(uuid) to app_user;
grant execute on function public.assign_incident_monteur_ap13(uuid,uuid,timestamptz,uuid[]) to app_user;
grant execute on function public.bulk_update_incident_status_ap13(jsonb,public.incident_status) to app_user;
grant execute on function public.bulk_assign_incident_monteur_ap13(jsonb,uuid) to app_user;

-- Fruehere Smokes vergeben pauschal `grant select, insert, update, delete on
-- all tables` und `grant execute on all functions` an app_user. Diese
-- Pauschalrechte muessen fuer AP13 gezielt zurueckgenommen werden, sonst
-- pruefen E6 und E19 nicht das echte Produktverhalten:
--   * ohne REVOKE DELETE greift die fehlende Delete-Policy nur still (0 Zeilen,
--     kein Fehler) und der Loeschtrigger feuert gar nicht,
--   * ohne REVOKE EXECUTE bleibt die interne Reconciliation fuer app_user
--     aufrufbar, obwohl die Migration sie public/anon/authenticated entzieht.
revoke delete on public.incident_tasks from app_user;
revoke execute on function public.sync_incident_tasks_internal(uuid) from app_user;

insert into public.customers(id,name) values ('f2000000-0000-0000-0000-000000000001','Kunde 13');
insert into public.construction_stages(id,code,name)
  values ('f3000000-0000-0000-0000-000000000001','B13','Bauabschnitt 13');
insert into public.vzg_lines(id,line_number,construction_stage_id)
  values ('f4000000-0000-0000-0000-000000000001','1813','f3000000-0000-0000-0000-000000000001');

-- Referenzvorgang (Staff-Kontext, Definer-Trigger laufen mit)
insert into public.incidents(id,construction_stage_id,vzg_line_number,vzg_line_id,km_from,status)
values ('f5000000-0000-0000-0000-000000000001','f3000000-0000-0000-0000-000000000001',
        '1813','f4000000-0000-0000-0000-000000000001',1.000,'neu');

set role app_user;
select set_config('test.uid', 'f1000000-0000-0000-0000-000000000001', false);

-- ---------------------------------------------------------------------
-- E1: Ableitung beim Anlegen (kein Monteur, keine Bilder, keine Kabelposition)
-- ---------------------------------------------------------------------
do $$ declare v_open int; begin
  select count(*) into v_open from incident_tasks
   where incident_id='f5000000-0000-0000-0000-000000000001' and status='open';
  if v_open = 3 then raise notice 'SMOKE E1 OK drei abgeleitete Aufgaben';
  else raise notice 'SMOKE E1 FAIL offene=%',v_open; end if;
end $$;

-- ---------------------------------------------------------------------
-- E2: Idempotenz der Ableitung (Refresh erzeugt keine Dubletten)
-- ---------------------------------------------------------------------
do $$ declare v_before int; v_after int; begin
  select count(*) into v_before from incident_tasks
   where incident_id='f5000000-0000-0000-0000-000000000001';
  perform public.refresh_incident_tasks_ap13('f5000000-0000-0000-0000-000000000001');
  perform public.refresh_incident_tasks_ap13('f5000000-0000-0000-0000-000000000001');
  select count(*) into v_after from incident_tasks
   where incident_id='f5000000-0000-0000-0000-000000000001';
  if v_before = v_after then raise notice 'SMOKE E2 OK Ableitung idempotent (%)',v_after;
  else raise notice 'SMOKE E2 FAIL vorher=% nachher=%',v_before,v_after; end if;
end $$;

-- ---------------------------------------------------------------------
-- E3: Triggerauslösung ueber incident_cable_positions -> no_cable wird void
-- ---------------------------------------------------------------------
do $$ declare v_status text; begin
  insert into public.incident_cable_positions(incident_id,cable_type_id,sort_order,quantity_value,quantity_unit,condition_code)
  values ('f5000000-0000-0000-0000-000000000001',(select id from cable_types where code='lst' limit 1),
          1,3,'piece','ready');
  select status into v_status from incident_tasks
   where incident_id='f5000000-0000-0000-0000-000000000001' and task_type='no_cable';
  if v_status='void' then raise notice 'SMOKE E3 OK no_cable auf void (Trigger cable_positions)';
  else raise notice 'SMOKE E3 FAIL status=%',v_status; end if;
end $$;

-- ---------------------------------------------------------------------
-- E4: Wiederöffnung bei Wiederauftreten der Ursache
-- ---------------------------------------------------------------------
do $$ declare v_status text; begin
  delete from public.incident_cable_positions where incident_id='f5000000-0000-0000-0000-000000000001';
  select status into v_status from incident_tasks
   where incident_id='f5000000-0000-0000-0000-000000000001' and task_type='no_cable';
  if v_status='open' then raise notice 'SMOKE E4 OK no_cable wieder open';
  else raise notice 'SMOKE E4 FAIL status=%',v_status; end if;
end $$;

-- ---------------------------------------------------------------------
-- E5: Quittierungskohärenz und quittierte Aufgabe bei fortbestehender Ursache
-- ---------------------------------------------------------------------
do $$ begin
  update incident_tasks set status='acknowledged'
   where incident_id='f5000000-0000-0000-0000-000000000001' and task_type='no_images';
  raise notice 'SMOKE E5a FAIL Quittierung ohne acknowledged_by zugelassen';
exception when check_violation then
  raise notice 'SMOKE E5a OK Kohaerenz-Constraint greift';
end $$;

do $$ declare v_status text; begin
  update incident_tasks
     set status='acknowledged', acknowledged_at=now(),
         acknowledged_by='f1000000-0000-0000-0000-000000000001'
   where incident_id='f5000000-0000-0000-0000-000000000001' and task_type='no_images';
  perform public.refresh_incident_tasks_ap13('f5000000-0000-0000-0000-000000000001');
  select status into v_status from incident_tasks
   where incident_id='f5000000-0000-0000-0000-000000000001' and task_type='no_images';
  if v_status='acknowledged' then raise notice 'SMOKE E5b OK quittierte Aufgabe bleibt acknowledged';
  else raise notice 'SMOKE E5b FAIL status=%',v_status; end if;
end $$;

-- ---------------------------------------------------------------------
-- E6: Löschen abgewiesen
-- ---------------------------------------------------------------------
do $$ begin
  delete from incident_tasks where incident_id='f5000000-0000-0000-0000-000000000001';
  raise notice 'SMOKE E6 FAIL Loeschen zugelassen';
exception when insufficient_privilege then
  raise notice 'SMOKE E6 OK Loeschen abgewiesen';
end $$;

-- ---------------------------------------------------------------------
-- E7: Staff-CRUD einer manuellen Aufgabe inkl. Zuweisung an profiles
-- ---------------------------------------------------------------------
do $$ declare v_id uuid; v_assignee uuid; begin
  insert into incident_tasks(incident_id,task_type,source,title,status,priority,assignee_profile_id)
  values ('f5000000-0000-0000-0000-000000000001','manual','manual','Rueckfrage Bauleitung','open','high',
          'f1000000-0000-0000-0000-000000000003')
  returning id into v_id;
  update incident_tasks set status='in_progress' where id=v_id;
  select assignee_profile_id into v_assignee from incident_tasks where id=v_id;
  if v_assignee='f1000000-0000-0000-0000-000000000003' then
    raise notice 'SMOKE E7 OK manuelle Aufgabe angelegt, zugewiesen und bearbeitet';
  else raise notice 'SMOKE E7 FAIL assignee=%',v_assignee; end if;
end $$;

-- ---------------------------------------------------------------------
-- E8: Trigger durch zulaessige Monteur-Aktion ohne RLS-Fehler
--     (Monteur darf Bilder anlegen; Definer-Reconciliation muss greifen)
-- ---------------------------------------------------------------------
insert into public.incident_assignments(incident_id,monteur_id)
values ('f5000000-0000-0000-0000-000000000001','f1000000-0000-0000-0000-000000000003');

select set_config('test.uid', 'f1000000-0000-0000-0000-000000000003', false);
do $$ declare v_status text; begin
  insert into public.incident_images(incident_id,file_name,mime_type,file_size,storage_path)
  values ('f5000000-0000-0000-0000-000000000001','m.jpg','image/jpeg',1024,'x/m.jpg');
  raise notice 'SMOKE E8a OK Monteur-Bildanlage ohne RLS-Fehler (Definer-Trigger)';
exception when others then
  raise notice 'SMOKE E8a FAIL Monteur-Aktion scheitert: % (%)',sqlerrm,sqlstate;
end $$;

-- ---------------------------------------------------------------------
-- E9: Monteur hat kein direktes Tabellenrecht, aber begrenzten RPC-Zugriff
-- ---------------------------------------------------------------------
do $$ declare v_count int; begin
  select count(*) into v_count from incident_tasks
   where incident_id='f5000000-0000-0000-0000-000000000001';
  if v_count = 0 then raise notice 'SMOKE E9a OK Monteur sieht keine Tabellenzeilen';
  else raise notice 'SMOKE E9a FAIL Monteur sieht % Zeilen',v_count; end if;
end $$;

do $$ begin
  insert into incident_tasks(incident_id,task_type,source,title)
  values ('f5000000-0000-0000-0000-000000000001','manual','manual','Monteur-Versuch');
  raise notice 'SMOKE E9b FAIL Monteur darf schreiben';
exception when insufficient_privilege then
  raise notice 'SMOKE E9b OK Monteur-Schreibzugriff abgewiesen';
end $$;

do $$ declare v_count int; begin
  select count(*) into v_count
  from public.get_assigned_incident_tasks('f5000000-0000-0000-0000-000000000001');
  if v_count > 0 then raise notice 'SMOKE E9c OK minimierte Monteur-RPC liefert % Aufgaben',v_count;
  else raise notice 'SMOKE E9c FAIL RPC liefert nichts'; end if;
end $$;

-- E10: fremder Monteur ohne Sicht
select set_config('test.uid', 'f1000000-0000-0000-0000-000000000004', false);
do $$ begin
  perform public.get_assigned_incident_tasks('f5000000-0000-0000-0000-000000000001');
  raise notice 'SMOKE E10 FAIL fremder Monteur erhaelt Aufgaben';
exception when insufficient_privilege then
  raise notice 'SMOKE E10 OK fremder Monteur abgewiesen';
end $$;

-- E11: Monteur darf keine Massenaktion ausfuehren
select set_config('test.uid', 'f1000000-0000-0000-0000-000000000003', false);
do $$ begin
  perform public.bulk_update_incident_status_ap13(
    jsonb_build_array(jsonb_build_object('id','f5000000-0000-0000-0000-000000000001',
                                         'expected_updated_at',now())),
    'in_bearbeitung');
  raise notice 'SMOKE E11 FAIL Monteur-Bulk zugelassen';
exception when insufficient_privilege then
  raise notice 'SMOKE E11 OK Monteur-Bulk abgewiesen';
end $$;

-- ---------------------------------------------------------------------
-- E12: Bulk-Status mit >= 20 Vorgaengen, Teilerfolg und Konflikt
-- ---------------------------------------------------------------------
reset role;
select set_config('test.uid', '', false);
do $$ declare i int; begin
  for i in 1..22 loop
    insert into public.incidents(construction_stage_id,vzg_line_number,vzg_line_id,km_from,status,description)
    values ('f3000000-0000-0000-0000-000000000001','1813','f4000000-0000-0000-0000-000000000001',
            i,'neu','AP13 Bulk '||i);
  end loop;
end $$;

set role app_user;
select set_config('test.uid', 'f1000000-0000-0000-0000-000000000002', false);

do $$
declare
  v_items jsonb;
  v_ok int; v_conflict int; v_notfound int;
begin
  -- 22 gueltige Eintraege + 1 unbekannter + 1 mit falschem updated_at
  select jsonb_agg(jsonb_build_object('id', id, 'expected_updated_at', updated_at))
    into v_items
  from public.incidents where description like 'AP13 Bulk %';

  v_items := v_items
    || jsonb_build_array(jsonb_build_object(
         'id','f9999999-9999-9999-9999-999999999999','expected_updated_at', now()))
    || jsonb_build_array(jsonb_build_object(
         'id','f5000000-0000-0000-0000-000000000001',
         'expected_updated_at', now() - interval '10 days'));

  select
    count(*) filter (where code='ok'),
    count(*) filter (where code='conflict'),
    count(*) filter (where code='not_found')
  into v_ok, v_conflict, v_notfound
  from public.bulk_update_incident_status_ap13(v_items, 'in_bearbeitung');

  if v_ok >= 20 and v_conflict = 1 and v_notfound = 1 then
    raise notice 'SMOKE E12 OK Bulk-Teilerfolg ok=% conflict=% not_found=%',v_ok,v_conflict,v_notfound;
  else
    raise notice 'SMOKE E12 FAIL ok=% conflict=% not_found=%',v_ok,v_conflict,v_notfound;
  end if;
end $$;

-- E13: Audit je Einzeländerung und Statushistorie nur bei echter Aenderung
-- audit_events ist per RLS nur fuer Admin sichtbar -> Admin-Kontext.
select set_config('test.uid', 'f1000000-0000-0000-0000-000000000001', false);
do $$ declare v_audit int; v_hist int; begin
  select count(*) into v_audit from public.audit_events
   where entity='incidents'
     and entity_id in (select id from public.incidents where description like 'AP13 Bulk %');
  select count(*) into v_hist from public.incident_status_history
   where incident_id in (select id from public.incidents where description like 'AP13 Bulk %')
     and new_status='in_bearbeitung';
  if v_audit >= 22 and v_hist = 22 then
    raise notice 'SMOKE E13 OK Einzelaudit (%) und Statushistorie (%)',v_audit,v_hist;
  else raise notice 'SMOKE E13 FAIL audit=% hist=%',v_audit,v_hist; end if;
end $$;
-- Folgekontext fuer E14-E16 wiederherstellen (Disponent).
select set_config('test.uid', 'f1000000-0000-0000-0000-000000000002', false);

-- E14: Obergrenze 201 Eintraege ist harter Fehler
do $$ declare v_items jsonb; begin
  select jsonb_agg(jsonb_build_object('id', gen_random_uuid(), 'expected_updated_at', now()))
    into v_items from generate_series(1,201);
  perform public.bulk_update_incident_status_ap13(v_items, 'in_bearbeitung');
  raise notice 'SMOKE E14 FAIL 201 Eintraege zugelassen';
exception when others then
  raise notice 'SMOKE E14 OK Obergrenze greift (%)',sqlstate;
end $$;

-- ---------------------------------------------------------------------
-- E15: Monteurzuweisung – No-op, Konflikt ueber Monteurmenge, Statuswechsel
-- ---------------------------------------------------------------------
do $$
declare
  v_id uuid; v_upd timestamptz; v_code text; v_status public.incident_status;
begin
  select id, updated_at into v_id, v_upd from public.incidents
   where description like 'AP13 Bulk %' order by km_from limit 1;

  -- erste Zuweisung: Status neu -> monteur_zugewiesen erwartet
  update public.incidents set status='neu' where id=v_id;
  select updated_at into v_upd from public.incidents where id=v_id;

  v_code := public.assign_incident_monteur_ap13(
    v_id,'f1000000-0000-0000-0000-000000000003',v_upd,array[]::uuid[]);
  select status into v_status from public.incidents where id=v_id;

  if v_code='ok' and v_status='monteur_zugewiesen' then
    raise notice 'SMOKE E15a OK Zuweisung mit Statuswechsel';
  else raise notice 'SMOKE E15a FAIL code=% status=%',v_code,v_status; end if;

  -- identische Zuweisung: No-op mit ok
  select updated_at into v_upd from public.incidents where id=v_id;
  v_code := public.assign_incident_monteur_ap13(
    v_id,'f1000000-0000-0000-0000-000000000003',v_upd,
    array['f1000000-0000-0000-0000-000000000003']::uuid[]);
  if v_code='ok' then raise notice 'SMOKE E15b OK identische Zuweisung ist No-op';
  else raise notice 'SMOKE E15b FAIL code=%',v_code; end if;

  -- Konflikt ueber abweichende erwartete Monteurmenge
  select updated_at into v_upd from public.incidents where id=v_id;
  v_code := public.assign_incident_monteur_ap13(
    v_id,'f1000000-0000-0000-0000-000000000003',v_upd,array[]::uuid[]);
  if v_code='conflict' then raise notice 'SMOKE E15c OK Konflikt ueber Monteurmenge';
  else raise notice 'SMOKE E15c FAIL code=%',v_code; end if;

  -- Konflikt ueber veraltetes updated_at
  v_code := public.assign_incident_monteur_ap13(
    v_id,'f1000000-0000-0000-0000-000000000003', now() - interval '10 days',
    array['f1000000-0000-0000-0000-000000000003']::uuid[]);
  if v_code='conflict' then raise notice 'SMOKE E15d OK Konflikt ueber updated_at';
  else raise notice 'SMOKE E15d FAIL code=%',v_code; end if;

  -- ungueltiges Ziel (kein aktives Monteur-Profil)
  select updated_at into v_upd from public.incidents where id=v_id;
  v_code := public.assign_incident_monteur_ap13(
    v_id,'f1000000-0000-0000-0000-000000000001',v_upd,
    array['f1000000-0000-0000-0000-000000000003']::uuid[]);
  if v_code='invalid_monteur' then raise notice 'SMOKE E15e OK Nicht-Monteur abgewiesen';
  else raise notice 'SMOKE E15e FAIL code=%',v_code; end if;
end $$;

-- E16: Bulk-Zuweisung nutzt denselben Pfad (Teilerfolg mit Konflikt)
do $$
declare v_items jsonb; v_ok int; v_conflict int;
begin
  select jsonb_agg(jsonb_build_object(
           'id', id,
           'expected_updated_at', updated_at,
           'expected_monteur_ids', coalesce((
             select jsonb_agg(a.monteur_id order by a.monteur_id)
             from public.incident_assignments a
             where a.incident_id = i.id and a.is_active), '[]'::jsonb)))
    into v_items
  from public.incidents i where i.description like 'AP13 Bulk %';

  v_items := v_items || jsonb_build_array(jsonb_build_object(
    'id', (select id from public.incidents where description like 'AP13 Bulk %' limit 1),
    'expected_updated_at', now() - interval '10 days',
    'expected_monteur_ids', '[]'::jsonb));

  select count(*) filter (where code='ok'), count(*) filter (where code='conflict')
    into v_ok, v_conflict
  from public.bulk_assign_incident_monteur_ap13(v_items,'f1000000-0000-0000-0000-000000000003');

  if v_ok >= 20 and v_conflict >= 1 then
    raise notice 'SMOKE E16 OK Bulk-Zuweisung ok=% conflict=%',v_ok,v_conflict;
  else raise notice 'SMOKE E16 FAIL ok=% conflict=%',v_ok,v_conflict; end if;
end $$;

-- E17: Audit je neuer Zuweisung (Admin-Kontext wegen RLS auf audit_events)
select set_config('test.uid', 'f1000000-0000-0000-0000-000000000001', false);
do $$ declare v_audit int; begin
  select count(*) into v_audit from public.audit_events
   where entity='incident_assignments';
  if v_audit >= 20 then raise notice 'SMOKE E17 OK Audit je Zuweisung (%)',v_audit;
  else raise notice 'SMOKE E17 FAIL audit=%',v_audit; end if;
end $$;
-- Folgekontext fuer E18 wiederherstellen (Disponent).
select set_config('test.uid', 'f1000000-0000-0000-0000-000000000002', false);

-- E18: has_open_task in incident_list_view
do $$ declare v_true int; v_false int; begin
  select count(*) filter (where has_open_task), count(*) filter (where not has_open_task)
    into v_true, v_false from public.incident_list_view;
  if v_true > 0 then raise notice 'SMOKE E18 OK has_open_task vorhanden (true=% false=%)',v_true,v_false;
  else raise notice 'SMOKE E18 FAIL true=% false=%',v_true,v_false; end if;
end $$;

-- E19: interne Reconciliation ist nicht direkt aufrufbar
select set_config('test.uid', 'f1000000-0000-0000-0000-000000000002', false);
do $$ begin
  perform public.sync_incident_tasks_internal('f5000000-0000-0000-0000-000000000001');
  raise notice 'SMOKE E19 FAIL interne Reconciliation direkt aufrufbar';
exception when insufficient_privilege then
  raise notice 'SMOKE E19 OK interne Reconciliation nicht aufrufbar';
end $$;

-- ---------------------------------------------------------------------
-- E20: Quittierte abgeleitete Aufgabe – beide Faelle belastbar geprueft
--   (a) Ursache besteht weiter  -> bleibt 'acknowledged' mit gesetzten Feldern
--   (b) Ursache entfaellt       -> 'void' und beide Quittierungsfelder NULL
-- Laeuft im Staff-Kontext (Disponent aus E19).
-- ---------------------------------------------------------------------
do $$
declare
  v_id uuid;
  v_status text;
  v_at timestamptz;
  v_by uuid;
begin
  insert into public.incidents(construction_stage_id,vzg_line_number,vzg_line_id,km_from,status,description)
  values ('f3000000-0000-0000-0000-000000000001','1813','f4000000-0000-0000-0000-000000000001',
          77.000,'neu','AP13 Ack-Zyklus')
  returning id into v_id;

  -- Abgeleitete no_cable-Aufgabe quittieren (Ursache besteht weiterhin).
  update public.incident_tasks
     set status='acknowledged', acknowledged_at=now(),
         acknowledged_by='f1000000-0000-0000-0000-000000000002'
   where incident_id=v_id and task_type='no_cable' and source='derived';

  -- (a) Reconciliation bei fortbestehender Ursache
  perform public.refresh_incident_tasks_ap13(v_id);
  select status, acknowledged_at, acknowledged_by into v_status, v_at, v_by
    from public.incident_tasks where incident_id=v_id and task_type='no_cable';
  if v_status='acknowledged' and v_at is not null and v_by is not null then
    raise notice 'SMOKE E20a OK Ursache besteht: acknowledged bleibt erhalten';
  else
    raise notice 'SMOKE E20a FAIL status=% at=% by=%',v_status,v_at,v_by;
  end if;

  -- (b) Ursache entfaellt: Kabelposition anlegen -> Trigger
  insert into public.incident_cable_positions(incident_id,cable_type_id,sort_order,quantity_value,quantity_unit,condition_code)
  values (v_id,(select id from cable_types where code='lst' limit 1),1,5,'meter','ready');

  select status, acknowledged_at, acknowledged_by into v_status, v_at, v_by
    from public.incident_tasks where incident_id=v_id and task_type='no_cable';
  if v_status='void' and v_at is null and v_by is null then
    raise notice 'SMOKE E20b OK Ursache entfallen: void und Quittierungsfelder NULL';
  else
    raise notice 'SMOKE E20b FAIL status=% at=% by=%',v_status,v_at,v_by;
  end if;

  -- Gegenprobe: Wiederauftreten oeffnet dieselbe Aufgabe wieder, ohne Quittierung.
  delete from public.incident_cable_positions where incident_id=v_id;
  select status, acknowledged_at into v_status, v_at
    from public.incident_tasks where incident_id=v_id and task_type='no_cable';
  if v_status='open' and v_at is null then
    raise notice 'SMOKE E20c OK Wiederauftreten oeffnet wieder (ohne Quittierung)';
  else
    raise notice 'SMOKE E20c FAIL status=% at=%',v_status,v_at;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- E21: Kein Informationszugriff eines Monteurs auf fremde Vorgaenge
--   * der frueher vorhandene Definer-Helfer darf nicht mehr existieren,
--   * ein fremder Vorgang ist ueber die View gar nicht sichtbar,
--   * has_open_task liefert dem Monteur keinen Informationsgewinn.
-- ---------------------------------------------------------------------
do $$ declare v_cnt int; begin
  select count(*) into v_cnt from pg_proc p
   join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname='incident_has_open_task';
  if v_cnt=0 then raise notice 'SMOKE E21a OK kein frei nutzbarer Definer-Helfer vorhanden';
  else raise notice 'SMOKE E21a FAIL incident_has_open_task existiert (%)',v_cnt; end if;
end $$;

select set_config('test.uid', 'f1000000-0000-0000-0000-000000000004', false);
do $$ declare v_rows int; begin
  select count(*) into v_rows from public.incident_list_view
   where id='f5000000-0000-0000-0000-000000000001';
  if v_rows=0 then raise notice 'SMOKE E21b OK fremder Monteur sieht den Vorgang nicht';
  else raise notice 'SMOKE E21b FAIL fremder Monteur sieht % Zeilen',v_rows; end if;
end $$;

select set_config('test.uid', 'f1000000-0000-0000-0000-000000000003', false);
do $$
declare
  v_rows int;
  v_flag boolean;
  v_open int;
begin
  -- Der zugewiesene Monteur MUSS den Vorgang sehen: genau eine View-Zeile.
  -- Ohne diesen Zaehler koennte der Test faelschlich bestehen, wenn die
  -- View gar keine Zeile liefert (SELECT INTO liesse v_flag dann NULL).
  select count(*) into v_rows from public.incident_list_view
   where id='f5000000-0000-0000-0000-000000000001';

  if v_rows <> 1 then
    raise notice 'SMOKE E21c FAIL zugewiesener Monteur erhaelt % View-Zeile(n), erwartet genau 1',v_rows;
  else
    select has_open_task into strict v_flag from public.incident_list_view
     where id='f5000000-0000-0000-0000-000000000001';

    select count(*) into v_open
    from public.get_assigned_incident_tasks('f5000000-0000-0000-0000-000000000001');

    -- v_flag muss ausdruecklich false sein (NULL gilt als Fehlschlag):
    -- die RLS von incident_tasks gibt dem Monteur keine Aufgabenzeilen frei.
    if v_flag is false and v_open > 0 then
      raise notice 'SMOKE E21c OK eine View-Zeile, has_open_task=false ohne Informationsgewinn, RPC liefert % Aufgaben',v_open;
    else
      raise notice 'SMOKE E21c FAIL rows=% flag=% rpc_offen=%',v_rows,v_flag,v_open;
    end if;
  end if;
end $$;

reset role;
select set_config('test.uid', '', false);
