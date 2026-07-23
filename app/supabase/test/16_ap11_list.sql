-- =====================================================================
-- AP11 – Smoke-Test (operative Vorgangsliste / incident_list_view)
-- NUR FUER LOKALEN TEST gegen ein reines PostgreSQL.
-- Erwartet: 00_stub_auth_storage.sql + Migrationen 0001–0009 angewendet.
-- Deckt ab: RLS (security_invoker) staff vs. monteur, Aggregate (Bilder,
--   Kabelarten, Monteure), abgeleitete Hinweise, Suchtext, Statusfilter,
--   Aktivitätsfilter, lokales Erstelldatum.
-- =====================================================================
\set ON_ERROR_STOP off
\pset pager off

reset role;
select set_config('test.uid', '', false);

insert into auth.users (id, email, raw_user_meta_data) values
  ('d1000000-0000-0000-0000-000000000001','adm11@t','{"full_name":"Admin11","role":"admin"}'),
  ('d1000000-0000-0000-0000-000000000003','ma11@t','{"full_name":"Monteur A11"}'),
  ('d1000000-0000-0000-0000-000000000004','mb11@t','{"full_name":"Monteur B11"}')
on conflict (id) do nothing;

do $$ begin if not exists (select 1 from pg_roles where rolname='app_user') then create role app_user; end if; end $$;
grant usage on schema public to app_user;
grant select, insert, update, delete on all tables in schema public to app_user;
grant usage, select on all sequences in schema public to app_user;
grant execute on all functions in schema public to app_user;
grant usage on schema auth to app_user;
grant select on auth.users to app_user;

insert into public.customers(id,name) values('d2000000-0000-0000-0000-000000000001','Kunde 11');
insert into public.construction_stages(id,code,name) values('d3000000-0000-0000-0000-000000000001','B11','Bauabschnitt 11');
insert into public.vzg_lines(id,line_number,construction_stage_id) values('d4000000-0000-0000-0000-000000000001','1733','d3000000-0000-0000-0000-000000000001');
insert into public.incidents(id,customer_id,construction_stage_id,vzg_line_id,vzg_line_number,operating_point,description)
  values ('d5000000-0000-0000-0000-000000000001','d2000000-0000-0000-0000-000000000001','d3000000-0000-0000-0000-000000000001','d4000000-0000-0000-0000-000000000001','1733','Bf 11','Kabelschaden Nord'),
         ('d5000000-0000-0000-0000-000000000002','d2000000-0000-0000-0000-000000000001','d3000000-0000-0000-0000-000000000001',null,'9999',null,'Alt-Vorgang 11');
insert into public.incident_cable_positions(incident_id,cable_type_id,sort_order) values
  ('d5000000-0000-0000-0000-000000000001',(select id from cable_types where code='lst'),0),
  ('d5000000-0000-0000-0000-000000000001',(select id from cable_types where code='tk'),1);
insert into public.incident_images(incident_id,file_name,mime_type,file_size,storage_path,category)
  values ('d5000000-0000-0000-0000-000000000001','a.jpg','image/jpeg',100,'incidents/d5/a.jpg','uebersicht');
insert into public.incident_assignments(incident_id,monteur_id) values
  ('d5000000-0000-0000-0000-000000000001','d1000000-0000-0000-0000-000000000003');

set role app_user;

-- L1/L6/L7/L8: Admin
select set_config('test.uid', 'd1000000-0000-0000-0000-000000000001', false);
do $$ declare n int; begin
  select count(*) into n from public.incident_list_view;
  if n=2 then raise notice 'SMOKE L1 OK Admin sieht alle (%)', n; else raise notice 'SMOKE L1 FAIL Admin count=%', n; end if;
end $$;
do $$ declare a jsonb; il int; cn int; mn int; begin
  select image_count, array_length(cable_arts,1), array_length(monteur_names,1)
    into il, cn, mn from public.incident_list_view where id='d5000000-0000-0000-0000-000000000001';
  if il=1 and cn=2 and mn=1 then raise notice 'SMOKE L3 OK Aggregate (Bilder=% Kabel=% Monteure=%)', il, cn, mn;
  else raise notice 'SMOKE L3 FAIL Bilder=% Kabel=% Monteure=%', il, cn, mn; end if;
end $$;
do $$ declare hv boolean; nc boolean; ni boolean; nm boolean; begin
  select historic_vzg,no_cable,no_images,no_monteur into hv,nc,ni,nm
    from public.incident_list_view where id='d5000000-0000-0000-0000-000000000002';
  if hv and nc and ni and nm then raise notice 'SMOKE L4 OK Hinweise Alt-Vorgang (historisch/ohne Kabel/Bild/Monteur)';
  else raise notice 'SMOKE L4 FAIL hv=% nc=% ni=% nm=%', hv,nc,ni,nm; end if;
end $$;
do $$ declare n int; begin
  select count(*) into n from public.incident_list_view where search_text like '%kabelschaden%';
  if n=1 then raise notice 'SMOKE L5 OK Suchtext trifft (%)', n; else raise notice 'SMOKE L5 FAIL Suche=%', n; end if;
end $$;
do $$ declare n int; begin
  select count(*) into n from public.incident_list_view where status not in ('abgeschlossen','storniert');
  if n=2 then raise notice 'SMOKE L6 OK Aktivitätsfilter aktiv (%)', n; else raise notice 'SMOKE L6 FAIL aktiv=%', n; end if;
end $$;
do $$ declare d date; begin
  select created_date_local into d from public.incident_list_view where id='d5000000-0000-0000-0000-000000000001';
  if d is not null then raise notice 'SMOKE L7 OK created_date_local gesetzt (%)', d; else raise notice 'SMOKE L7 FAIL kein created_date_local'; end if;
end $$;

-- L2: RLS Monteur
select set_config('test.uid', 'd1000000-0000-0000-0000-000000000003', false);
do $$ declare n int; begin
  select count(*) into n from public.incident_list_view;
  if n=1 then raise notice 'SMOKE L2a OK Monteur A sieht nur zugewiesenen (%)', n; else raise notice 'SMOKE L2a FAIL monA=%', n; end if;
end $$;
select set_config('test.uid', 'd1000000-0000-0000-0000-000000000004', false);
do $$ declare n int; begin
  select count(*) into n from public.incident_list_view;
  if n=0 then raise notice 'SMOKE L2b OK Monteur B sieht keine (%)', n; else raise notice 'SMOKE L2b FAIL monB=%', n; end if;
end $$;

reset role;
select set_config('test.uid', '', false);
select 'AP11 SMOKE FERTIG' as info;
