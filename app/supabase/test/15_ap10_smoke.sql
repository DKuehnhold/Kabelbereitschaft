-- =====================================================================
-- AP10 – Smoke-Test (Stammdaten in der Vorgangserfassung)
-- NUR FUER LOKALEN TEST gegen ein reines PostgreSQL.
-- Erwartet: 00_stub_auth_storage.sql + Migrationen 0001–0008 angewendet.
-- Deckt ab: transaktionale Anlage (Incident + Pflicht-Kabelposition) via RPC,
--   VzG-Snapshot, RLS (admin/disponent/monteur), Belonging-Prüfung,
--   Pflichtfelder, optionale km, Update inkl. Snapshot, Positions-Constraints,
--   Kabelpositions-RLS, feldgenaues Audit.
-- =====================================================================
\set ON_ERROR_STOP off
\pset pager off

reset role;
select set_config('test.uid', '', false);

insert into auth.users (id, email, raw_user_meta_data) values
  ('aa000000-0000-0000-0000-000000000001','admin10@t','{"full_name":"Admin10","role":"admin"}'),
  ('aa000000-0000-0000-0000-000000000002','dispo10@t','{"full_name":"Dispo10","role":"disponent"}'),
  ('aa000000-0000-0000-0000-000000000003','monA10@t','{"full_name":"Monteur A10"}'),
  ('aa000000-0000-0000-0000-000000000004','monB10@t','{"full_name":"Monteur B10"}')
on conflict (id) do nothing;

do $$ begin if not exists (select 1 from pg_roles where rolname='app_user') then create role app_user; end if; end $$;
grant usage on schema public to app_user;
grant select, insert, update, delete on all tables in schema public to app_user;
grant usage, select on all sequences in schema public to app_user;
grant execute on all functions in schema public to app_user;
grant usage on schema auth to app_user;
grant select on auth.users to app_user;

-- Stammdaten als Service anlegen (RLS umgangen im Bootstrap).
insert into public.customers (id, name, is_active) values
  ('ab000000-0000-0000-0000-000000000001','Kunde aktiv', true),
  ('ab000000-0000-0000-0000-000000000002','Kunde inaktiv', false)
on conflict (id) do nothing;
insert into public.construction_stages (id, code, name) values
  ('ac000000-0000-0000-0000-000000000001','BA10-1','Bauabschnitt 10-1'),
  ('ac000000-0000-0000-0000-000000000002','BA10-2','Bauabschnitt 10-2')
on conflict (id) do nothing;
insert into public.vzg_lines (id, line_number, construction_stage_id) values
  ('ad000000-0000-0000-0000-000000000001','1733','ac000000-0000-0000-0000-000000000001'),
  ('ad000000-0000-0000-0000-000000000003','1800','ac000000-0000-0000-0000-000000000001'),
  ('ad000000-0000-0000-0000-000000000002','2000','ac000000-0000-0000-0000-000000000002')
on conflict (id) do nothing;

set role app_user;
select set_config('test.uid', 'aa000000-0000-0000-0000-000000000001', false);

-- P1: Admin legt Vorgang + Pflicht-Kabelposition transaktional an; VzG-Snapshot.
do $$ declare v_id uuid; v_snap text; v_pos int; begin
  v_id := public.create_incident_ap10(
    'ab000000-0000-0000-0000-000000000001','ac000000-0000-0000-0000-000000000001','ad000000-0000-0000-0000-000000000001',
    null,'normal'::public.incident_priority,'Störung Kabel',
    null,null,null,null,null,null,null,12.5,null,null,null,null,
    (select id from public.cable_types where code='lst'));
  select vzg_line_number into v_snap from public.incidents where id=v_id;
  select count(*) into v_pos from public.incident_cable_positions where incident_id=v_id;
  if v_snap='1733' and v_pos=1 then raise notice 'SMOKE P1 OK Anlage + Snapshot(%) + Position(%)', v_snap, v_pos;
  else raise notice 'SMOKE P1 FAIL Snapshot=% Position=%', v_snap, v_pos; end if;
end $$;

-- P2: Disponent darf anlegen
select set_config('test.uid', 'aa000000-0000-0000-0000-000000000002', false);
do $$ declare v_id uuid; begin
  v_id := public.create_incident_ap10(
    'ab000000-0000-0000-0000-000000000001','ac000000-0000-0000-0000-000000000001','ad000000-0000-0000-0000-000000000001',
    null,'hoch'::public.incident_priority,'Dispo-Anlage',
    null,null,null,null,null,null,null,null,null,null,null,null,
    (select id from public.cable_types where code='tk'));
  raise notice 'SMOKE P2 OK Disponent darf anlegen';
exception when others then raise notice 'SMOKE P2 FAIL Disponent Anlage blockiert (%)', sqlerrm; end $$;

-- P3: Monteur darf NICHT anlegen (RLS incidents_insert = is_staff)
select set_config('test.uid', 'aa000000-0000-0000-0000-000000000003', false);
do $$ begin
  perform public.create_incident_ap10(
    'ab000000-0000-0000-0000-000000000001','ac000000-0000-0000-0000-000000000001','ad000000-0000-0000-0000-000000000001',
    null,'normal'::public.incident_priority,'Monteur-Anlage',
    null,null,null,null,null,null,null,null,null,null,null,null,
    (select id from public.cable_types where code='lst'));
  raise notice 'SMOKE P3 FAIL Monteur konnte Vorgang anlegen';
exception when others then raise notice 'SMOKE P3 OK Monteur-Anlage blockiert'; end $$;

-- Zurück zu Admin
select set_config('test.uid', 'aa000000-0000-0000-0000-000000000001', false);

-- P4: VzG gehört nicht zum Bauabschnitt -> Fehler
do $$ begin
  perform public.create_incident_ap10(
    'ab000000-0000-0000-0000-000000000001','ac000000-0000-0000-0000-000000000001','ad000000-0000-0000-0000-000000000002',
    null,'normal'::public.incident_priority,'Falsche VzG',
    null,null,null,null,null,null,null,null,null,null,null,null,
    (select id from public.cable_types where code='lst'));
  raise notice 'SMOKE P4 FAIL VzG-Bauabschnitt-Mismatch zugelassen';
exception when others then raise notice 'SMOKE P4 OK VzG-Zugehörigkeit erzwungen'; end $$;

-- P5: fehlende Pflicht-Kabelposition (cable null) -> Fehler
do $$ begin
  perform public.create_incident_ap10(
    'ab000000-0000-0000-0000-000000000001','ac000000-0000-0000-0000-000000000001','ad000000-0000-0000-0000-000000000001',
    null,'normal'::public.incident_priority,'Ohne Kabel',
    null,null,null,null,null,null,null,null,null,null,null,null, null);
  raise notice 'SMOKE P5 FAIL Anlage ohne Kabelart zugelassen';
exception when others then raise notice 'SMOKE P5 OK Kabelposition ist Pflicht'; end $$;

-- P6: km optional -> Anlage ohne km ok
do $$ declare v_id uuid; v_km numeric; begin
  v_id := public.create_incident_ap10(
    'ab000000-0000-0000-0000-000000000001','ac000000-0000-0000-0000-000000000001','ad000000-0000-0000-0000-000000000001',
    null,'normal'::public.incident_priority,'Ohne km',
    null,null,null,null,null,null,null,null,null,null,null,null,
    (select id from public.cable_types where code='lwl'));
  select km_from into v_km from public.incidents where id=v_id;
  if v_km is null then raise notice 'SMOKE P6 OK km optional (null)';
  else raise notice 'SMOKE P6 FAIL km=%', v_km; end if;
end $$;

-- P7: Update ändert VzG-Snapshot + Kabelposition
do $$ declare v_id uuid; v_snap text; v_cable uuid; begin
  v_id := public.create_incident_ap10(
    'ab000000-0000-0000-0000-000000000001','ac000000-0000-0000-0000-000000000001','ad000000-0000-0000-0000-000000000001',
    null,'normal'::public.incident_priority,'Vor Update',
    null,null,null,null,null,null,null,null,null,null,null,null,
    (select id from public.cable_types where code='lst'));
  perform public.update_incident_ap10(
    v_id,'ab000000-0000-0000-0000-000000000001','ac000000-0000-0000-0000-000000000001','ad000000-0000-0000-0000-000000000003',
    null,'kritisch'::public.incident_priority,'Nach Update',
    null,null,null,null,null,null,null,null,null,null,null,null,
    (select id from public.cable_types where code='ola'));
  select vzg_line_number into v_snap from public.incidents where id=v_id;
  select cable_type_id into v_cable from public.incident_cable_positions where incident_id=v_id order by sort_order limit 1;
  if v_snap='1800' and v_cable=(select id from public.cable_types where code='ola')
    then raise notice 'SMOKE P7 OK Update Snapshot(%) + Kabelart aktualisiert', v_snap;
  else raise notice 'SMOKE P7 FAIL Snapshot=% cable=%', v_snap, v_cable; end if;
end $$;

-- P8: sort_order eindeutig je Vorgang
do $$ declare v_id uuid; begin
  select id into v_id from public.incidents order by created_at desc limit 1;
  insert into public.incident_cable_positions (incident_id, cable_type_id, sort_order)
    values (v_id, (select id from public.cable_types where code='tk'), 0);
  raise notice 'SMOKE P8 FAIL doppelte sort_order zugelassen';
exception when others then raise notice 'SMOKE P8 OK sort_order je Vorgang eindeutig'; end $$;

-- Assignment für RLS-Positionstest (P1-Vorgang) anlegen
do $$ declare v_id uuid; begin
  select i.id into v_id from public.incidents i where i.description='Störung Kabel' limit 1;
  insert into public.incident_assignments (incident_id, monteur_id)
    values (v_id, 'aa000000-0000-0000-0000-000000000003') on conflict do nothing;
end $$;

-- P9: RLS Kabelpositionen – zugewiesener Monteur sieht, fremder nicht
select set_config('test.uid', 'aa000000-0000-0000-0000-000000000003', false);
do $$ declare a int; begin
  select count(*) into a from public.incident_cable_positions p
    join public.incidents i on i.id=p.incident_id where i.description='Störung Kabel';
  if a>=1 then raise notice 'SMOKE P9a OK zugewiesener Monteur sieht Kabelposition (%)', a;
  else raise notice 'SMOKE P9a FAIL zugewiesener Monteur sieht nichts (%)', a; end if;
end $$;
select set_config('test.uid', 'aa000000-0000-0000-0000-000000000004', false);
do $$ declare b int; begin
  select count(*) into b from public.incident_cable_positions p
    join public.incidents i on i.id=p.incident_id where i.description='Störung Kabel';
  if b=0 then raise notice 'SMOKE P9b OK fremder Monteur sieht keine Kabelposition';
  else raise notice 'SMOKE P9b FAIL fremder Monteur sieht % Positionen', b; end if;
end $$;

-- P10: fremder Monteur darf keine Kabelposition schreiben
do $$ declare v_id uuid; begin
  select i.id into v_id from public.incidents i where i.description='Störung Kabel' limit 1;
  insert into public.incident_cable_positions (incident_id, cable_type_id, sort_order)
    values (v_id, (select id from public.cable_types where code='tk'), 5);
  raise notice 'SMOKE P10 FAIL fremder Monteur konnte Kabelposition schreiben';
exception when others then raise notice 'SMOKE P10 OK Kabelpositions-Schreibschutz greift'; end $$;

-- P11: Audit (feldgenau) – Incident-INSERT, Kabelposition-INSERT, Incident-UPDATE-Changes
select set_config('test.uid', 'aa000000-0000-0000-0000-000000000001', false);
do $$ declare ci int; cp int; cu int; begin
  select count(*) into ci from public.audit_events where entity='incidents' and action='INSERT';
  select count(*) into cp from public.audit_events where entity='incident_cable_positions' and action='INSERT';
  select count(*) into cu from public.audit_events where entity='incidents' and action='UPDATE'
    and detail ? 'changes';
  if ci>=1 and cp>=1 and cu>=1 then raise notice 'SMOKE P11 OK Audit Incident(%)/Position(%)/Update-Changes(%)', ci, cp, cu;
  else raise notice 'SMOKE P11 FAIL Audit i=% p=% u=%', ci, cp, cu; end if;
end $$;

reset role;
select set_config('test.uid', '', false);
select 'AP10 SMOKE FERTIG' as info;
