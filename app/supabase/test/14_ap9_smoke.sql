-- =====================================================================
-- AP9 – Smoke-Test (Stammdaten & Einstellungen)
-- NUR FUER LOKALEN TEST gegen ein reines PostgreSQL.
-- Erwartet: 00_stub_auth_storage.sql + Migrationen 0001–0007 angewendet.
-- Deckt ab: CRUD, RLS (admin/disponent/monteur), feldgenaues Audit,
--           Constraints (VzG-Format/Unique, erp_id, profile_id, M:N-Unique,
--           app_settings-Singleton), Seeds.
-- =====================================================================
\set ON_ERROR_STOP off
\pset pager off

-- (0) Bootstrap als Service (auth.uid() = NULL) ------------------------------
reset role;
select set_config('test.uid', '', false);

insert into auth.users (id, email, raw_user_meta_data) values
  ('a9000000-0000-0000-0000-000000000001','admin9@example.test','{"full_name":"Admin9","role":"admin"}'),
  ('a9000000-0000-0000-0000-000000000002','dispo9@example.test','{"full_name":"Dispo9","role":"disponent"}'),
  ('a9000000-0000-0000-0000-000000000003','monteur9@example.test','{"full_name":"Monteur9"}')
on conflict (id) do nothing;

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'app_user') then create role app_user; end if;
end $$;
grant usage on schema public to app_user;
grant select, insert, update, delete on all tables in schema public to app_user;
grant usage, select on all sequences in schema public to app_user;
grant execute on all functions in schema public to app_user;
grant usage on schema auth to app_user;
grant select on auth.users to app_user;

set role app_user;

-- =====================================================================
-- ADMIN
-- =====================================================================
select set_config('test.uid', 'a9000000-0000-0000-0000-000000000001', false);

-- A1: Kunde anlegen (staff)
insert into public.customers (id, name, erp_id) values
  ('a9010000-0000-0000-0000-000000000001','Testkunde A9','ERP-A9')
on conflict (id) do nothing;
do $$ declare c int; begin
  select count(*) into c from public.customers where id='a9010000-0000-0000-0000-000000000001';
  if c=1 then raise notice 'SMOKE A1 OK Kunde angelegt'; else raise notice 'SMOKE A1 FAIL Kunde nicht angelegt'; end if;
end $$;

-- A2: erp_id eindeutig -> Dublette scheitert
do $$ begin
  insert into public.customers (name, erp_id) values ('Dubletten-Kunde','ERP-A9');
  raise notice 'SMOKE A2 FAIL erp_id-Dublette wurde zugelassen';
exception when others then raise notice 'SMOKE A2 OK erp_id-Dublette blockiert'; end $$;

-- A3: mehrere NULL-erp_id erlaubt
do $$ begin
  insert into public.customers (id,name) values
    ('a9010000-0000-0000-0000-000000000002','Kunde ohne ERP 1'),
    ('a9010000-0000-0000-0000-000000000003','Kunde ohne ERP 2');
  raise notice 'SMOKE A3 OK mehrere NULL-erp_id erlaubt';
exception when others then raise notice 'SMOKE A3 FAIL NULL-erp_id blockiert (%)', sqlerrm; end $$;

-- Bauabschnitte anlegen (für VzG/Contacts)
insert into public.construction_stages (id, code, name) values
  ('a9020000-0000-0000-0000-000000000001','BA-A9-1','Bauabschnitt A9-1'),
  ('a9020000-0000-0000-0000-000000000002','BA-A9-2','Bauabschnitt A9-2')
on conflict (id) do nothing;

-- A5: VzG-Format – 3 Ziffern scheitert, 4 Ziffern ok
do $$ begin
  insert into public.vzg_lines (line_number, construction_stage_id)
    values ('123','a9020000-0000-0000-0000-000000000001');
  raise notice 'SMOKE A5a FAIL VzG mit 3 Ziffern zugelassen';
exception when others then raise notice 'SMOKE A5a OK VzG-Format erzwungen (3 Ziffern blockiert)'; end $$;
do $$ begin
  insert into public.vzg_lines (id, line_number, construction_stage_id)
    values ('a9060000-0000-0000-0000-000000000001','1733','a9020000-0000-0000-0000-000000000001');
  raise notice 'SMOKE A5b OK VzG 1733 angelegt';
exception when others then raise notice 'SMOKE A5b FAIL VzG 1733 blockiert (%)', sqlerrm; end $$;

-- A6: Unique je Bauabschnitt; gleiche Nummer in anderem Bauabschnitt erlaubt
do $$ begin
  insert into public.vzg_lines (line_number, construction_stage_id)
    values ('1733','a9020000-0000-0000-0000-000000000001');
  raise notice 'SMOKE A6a FAIL VzG-Dublette im selben Bauabschnitt zugelassen';
exception when others then raise notice 'SMOKE A6a OK VzG eindeutig je Bauabschnitt'; end $$;
do $$ begin
  insert into public.vzg_lines (line_number, construction_stage_id)
    values ('1733','a9020000-0000-0000-0000-000000000002');
  raise notice 'SMOKE A6b OK gleiche VzG in anderem Bauabschnitt erlaubt';
exception when others then raise notice 'SMOKE A6b FAIL gleiche VzG in anderem Bauabschnitt blockiert (%)', sqlerrm; end $$;

-- A7: Ansprechpartner + Telefonnummer + Bauabschnitts-Zuordnung
insert into public.contacts (id, customer_id, name, email) values
  ('a9030000-0000-0000-0000-000000000001','a9010000-0000-0000-0000-000000000001','Max Muster','max@example.test')
on conflict (id) do nothing;
insert into public.contact_phone_numbers (contact_id, phone, phone_type, sort_order) values
  ('a9030000-0000-0000-0000-000000000001','0170 1234567','mobil',0);
insert into public.construction_stage_contacts (construction_stage_id, contact_id) values
  ('a9020000-0000-0000-0000-000000000001','a9030000-0000-0000-0000-000000000001');
do $$ declare p int; s int; begin
  select count(*) into p from public.contact_phone_numbers where contact_id='a9030000-0000-0000-0000-000000000001';
  select count(*) into s from public.construction_stage_contacts where contact_id='a9030000-0000-0000-0000-000000000001';
  if p=1 and s=1 then raise notice 'SMOKE A7 OK Kontakt + Telefon + Zuordnung';
  else raise notice 'SMOKE A7 FAIL Telefon=% Zuordnung=%', p, s; end if;
end $$;

-- A8: leere Telefonnummer scheitert (Check)
do $$ begin
  insert into public.contact_phone_numbers (contact_id, phone) values ('a9030000-0000-0000-0000-000000000001','   ');
  raise notice 'SMOKE A8 FAIL leere Telefonnummer zugelassen';
exception when others then raise notice 'SMOKE A8 OK leere Telefonnummer blockiert'; end $$;

-- A9: M:N-Zuordnung eindeutig
do $$ begin
  insert into public.construction_stage_contacts (construction_stage_id, contact_id)
    values ('a9020000-0000-0000-0000-000000000001','a9030000-0000-0000-0000-000000000001');
  raise notice 'SMOKE A9 FAIL doppelte Bauabschnitts-Zuordnung zugelassen';
exception when others then raise notice 'SMOKE A9 OK Bauabschnitts-Zuordnung eindeutig'; end $$;

-- A10: Monteure + Profil-Verknüpfung eindeutig
insert into public.technicians (id, first_name, last_name, profile_id) values
  ('a9040000-0000-0000-0000-000000000001','Erika','Musterfrau','a9000000-0000-0000-0000-000000000003')
on conflict (id) do nothing;
insert into public.technicians (id, first_name, last_name) values
  ('a9040000-0000-0000-0000-000000000002','Klaus','Kabel')
on conflict (id) do nothing;
do $$ begin
  insert into public.technicians (first_name, last_name, profile_id)
    values ('Doppelt','Verknüpft','a9000000-0000-0000-0000-000000000003');
  raise notice 'SMOKE A10 FAIL doppelte profile_id zugelassen';
exception when others then raise notice 'SMOKE A10 OK profile_id eindeutig'; end $$;

-- A11: Teams + Mitglieder; Mehrfachmitgliedschaft; Dublette scheitert
insert into public.teams (id, name) values ('a9050000-0000-0000-0000-000000000001','Team A9') on conflict (id) do nothing;
insert into public.teams (id, name) values ('a9050000-0000-0000-0000-000000000002','Team B9') on conflict (id) do nothing;
insert into public.team_members (team_id, technician_id) values
  ('a9050000-0000-0000-0000-000000000001','a9040000-0000-0000-0000-000000000001'),
  ('a9050000-0000-0000-0000-000000000002','a9040000-0000-0000-0000-000000000001'); -- selber Monteur in 2 Teams
do $$ declare c int; begin
  select count(*) into c from public.team_members where technician_id='a9040000-0000-0000-0000-000000000001';
  if c=2 then raise notice 'SMOKE A11a OK Mehrfachmitgliedschaft';
  else raise notice 'SMOKE A11a FAIL Mehrfachmitgliedschaft c=%', c; end if;
end $$;
do $$ begin
  insert into public.team_members (team_id, technician_id)
    values ('a9050000-0000-0000-0000-000000000001','a9040000-0000-0000-0000-000000000001');
  raise notice 'SMOKE A11b FAIL doppeltes Teammitglied zugelassen';
exception when others then raise notice 'SMOKE A11b OK Teammitglied eindeutig je Team'; end $$;

-- A12: Kabelarten – Seed vorhanden + Code eindeutig
do $$ declare c int; begin
  select count(*) into c from public.cable_types;
  if c>=6 then raise notice 'SMOKE A12a OK Kabelart-Seed (%)', c;
  else raise notice 'SMOKE A12a FAIL Kabelart-Seed (%)', c; end if;
end $$;
do $$ begin
  insert into public.cable_types (code, name) values ('lst','Doppelt LST');
  raise notice 'SMOKE A12b FAIL Kabelart-Code-Dublette zugelassen';
exception when others then raise notice 'SMOKE A12b OK Kabelart-Code eindeutig'; end $$;

-- A13: app_settings – Singleton (zweite Zeile scheitert), Update ok
do $$ begin
  insert into public.app_settings (id) values (2);
  raise notice 'SMOKE A13a FAIL zweite app_settings-Zeile zugelassen';
exception when others then raise notice 'SMOKE A13a OK app_settings Singleton erzwungen'; end $$;
update public.app_settings set default_customer_id='a9010000-0000-0000-0000-000000000001' where id=1;
do $$ declare v uuid; begin
  select default_customer_id into v from public.app_settings where id=1;
  if v='a9010000-0000-0000-0000-000000000001' then raise notice 'SMOKE A13b OK Standardkunde gesetzt';
  else raise notice 'SMOKE A13b FAIL Standardkunde=%', v; end if;
end $$;

-- =====================================================================
-- AUDIT (feldgenau)
-- =====================================================================
-- A14: UPDATE erzeugt detail.changes mit old/new; op bleibt erhalten
update public.customers set name='Testkunde A9 (neu)' where id='a9010000-0000-0000-0000-000000000001';
do $$ declare d jsonb; begin
  select detail into d from public.audit_events
   where entity='customers' and entity_id='a9010000-0000-0000-0000-000000000001' and action='UPDATE'
   order by created_at desc limit 1;
  if d ? 'op' and (d->'changes'->'name'->>'old')='Testkunde A9'
       and (d->'changes'->'name'->>'new')='Testkunde A9 (neu)' then
    raise notice 'SMOKE A14 OK feldgenaues Audit (name old/new + op)';
  else raise notice 'SMOKE A14 FAIL Audit-Detail=%', d; end if;
end $$;

-- A15: INSERT-Audit enthält detail.new
do $$ declare d jsonb; begin
  select detail into d from public.audit_events
   where entity='customers' and entity_id='a9010000-0000-0000-0000-000000000001' and action='INSERT'
   order by created_at asc limit 1;
  if d ? 'op' and (d->'new'->>'name')='Testkunde A9' then raise notice 'SMOKE A15 OK Insert-Audit (detail.new)';
  else raise notice 'SMOKE A15 FAIL Insert-Audit=%', d; end if;
end $$;

-- A16: Aktiv/Inaktiv-Umschaltung wird feldgenau auditiert
update public.customers set is_active=false where id='a9010000-0000-0000-0000-000000000002';
do $$ declare d jsonb; begin
  select detail into d from public.audit_events
   where entity='customers' and entity_id='a9010000-0000-0000-0000-000000000002' and action='UPDATE'
   order by created_at desc limit 1;
  if (d->'changes'->'is_active'->>'old')='true' and (d->'changes'->'is_active'->>'new')='false' then
    raise notice 'SMOKE A16 OK Aktiv-Umschaltung auditiert';
  else raise notice 'SMOKE A16 FAIL Aktiv-Audit=%', d; end if;
end $$;

-- A17: M:N-Insert + Delete werden auditiert
insert into public.team_members (id, team_id, technician_id)
  values ('a9070000-0000-0000-0000-000000000001','a9050000-0000-0000-0000-000000000001','a9040000-0000-0000-0000-000000000002');
delete from public.team_members where id='a9070000-0000-0000-0000-000000000001';
do $$ declare i int; del int; begin
  select count(*) into i from public.audit_events where entity='team_members' and entity_id='a9070000-0000-0000-0000-000000000001' and action='INSERT';
  select count(*) into del from public.audit_events where entity='team_members' and entity_id='a9070000-0000-0000-0000-000000000001' and action='DELETE';
  if i=1 and del=1 then raise notice 'SMOKE A17 OK M:N Insert+Delete auditiert';
  else raise notice 'SMOKE A17 FAIL M:N Audit insert=% delete=%', i, del; end if;
end $$;

-- =====================================================================
-- RLS: DISPONENT darf Stammdaten schreiben (Broadening construction_stages)
-- =====================================================================
select set_config('test.uid', 'a9000000-0000-0000-0000-000000000002', false);
do $$ begin
  insert into public.construction_stages (code, name) values ('BA-DISPO','Dispo-Bauabschnitt');
  raise notice 'SMOKE A18 OK Disponent darf Bauabschnitt schreiben (is_staff)';
exception when others then raise notice 'SMOKE A18 FAIL Disponent Bauabschnitt blockiert (%)', sqlerrm; end $$;
do $$ begin
  insert into public.customers (name) values ('Dispo-Kunde');
  raise notice 'SMOKE A19 OK Disponent darf Kunde schreiben';
exception when others then raise notice 'SMOKE A19 FAIL Disponent Kunde blockiert (%)', sqlerrm; end $$;

-- =====================================================================
-- RLS: MONTEUR – nur lesen, nicht schreiben
-- =====================================================================
select set_config('test.uid', 'a9000000-0000-0000-0000-000000000003', false);
do $$ declare c int; begin
  select count(*) into c from public.cable_types;
  if c>=6 then raise notice 'SMOKE A20 OK Monteur darf Kabelarten lesen (%)', c;
  else raise notice 'SMOKE A20 FAIL Monteur Leserecht Kabelarten c=%', c; end if;
end $$;
do $$ begin
  insert into public.customers (name) values ('Monteur-Kunde');
  raise notice 'SMOKE A21 FAIL Monteur konnte Kunde schreiben';
exception when others then raise notice 'SMOKE A21 OK Monteur Schreibschutz greift'; end $$;
do $$ begin
  insert into public.technicians (first_name, last_name) values ('Monteur','Selbstanlage');
  raise notice 'SMOKE A22 FAIL Monteur konnte Monteur anlegen';
exception when others then raise notice 'SMOKE A22 OK Monteur Schreibschutz (technicians) greift'; end $$;

-- =====================================================================
reset role;
select set_config('test.uid', '', false);
select 'AP9 SMOKE FERTIG' as info;
