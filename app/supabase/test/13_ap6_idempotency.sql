-- =====================================================================
-- AP6 – Idempotenz/Dedup der Synchronisation (sync_actions).
-- NUR LOKAL gegen reines PostgreSQL. Erwartet: 00_stub + Migrationen 0001–0006.
-- Meldet je Prüfung 'SMOKE I.. OK ..' oder 'SMOKE I.. FAIL ..'.
-- =====================================================================
\set ON_ERROR_STOP off
\pset pager off

reset role;
select set_config('test.uid', '', false);

insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111','admin@example.test','{"full_name":"Admin","role":"admin"}'),
  ('22222222-2222-2222-2222-222222222222','monteur@example.test','{"full_name":"Monteur"}');

do $$ begin
  if not exists (select 1 from pg_roles where rolname='app_user') then create role app_user; end if;
end $$;
grant usage on schema public to app_user;
grant select, insert, update, delete on all tables in schema public to app_user;
grant usage, select on all sequences in schema public to app_user;
grant execute on all functions in schema public to app_user;
grant usage on schema auth to app_user;
grant select on auth.users to app_user;

set role app_user;

-- ADMIN: erste Aktion setzen
select set_config('test.uid', '11111111-1111-1111-1111-111111111111', false);
do $$ begin
  insert into public.sync_actions (client_action_id, kind, incident_id)
    values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','note', null);
  raise notice 'SMOKE I1 OK erste Aktion aufgezeichnet';
exception when others then raise notice 'SMOKE I1 FAIL erste Aktion (%)', sqlerrm; end $$;

-- ADMIN: dieselbe Client-Action-ID erneut => Unique-Verletzung (Dedup)
do $$ begin
  insert into public.sync_actions (client_action_id, kind, incident_id)
    values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','note', null);
  raise notice 'SMOKE I2 FAIL Duplikat wurde zugelassen';
exception when unique_violation then raise notice 'SMOKE I2 OK Duplikat dedupliziert (unique_violation)';
         when others then raise notice 'SMOKE I2 OK Duplikat blockiert (%)', sqlerrm; end $$;

-- MONTEUR: gleiche Client-Action-ID, ANDERER Benutzer => erlaubt (pro Benutzer eindeutig)
select set_config('test.uid', '22222222-2222-2222-2222-222222222222', false);
do $$ begin
  insert into public.sync_actions (client_action_id, kind, incident_id)
    values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','note', null);
  raise notice 'SMOKE I3 OK gleiche ID bei anderem Benutzer erlaubt';
exception when others then raise notice 'SMOKE I3 FAIL anderer Benutzer blockiert (%)', sqlerrm; end $$;

-- RLS: Monteur sieht nur eigene Aktionen (nicht die des Admins)
do $$ declare c int; begin
  select count(*) into c from public.sync_actions where client_action_id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  if c = 1 then raise notice 'SMOKE I4 OK RLS: Monteur sieht nur eigene Aktion (%)', c;
  else raise notice 'SMOKE I4 FAIL RLS: Monteur sieht % Aktionen (erwartet 1)', c; end if;
end $$;

-- ADMIN: sieht ebenfalls nur eigene
select set_config('test.uid', '11111111-1111-1111-1111-111111111111', false);
do $$ declare c int; begin
  select count(*) into c from public.sync_actions where client_action_id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  if c = 1 then raise notice 'SMOKE I5 OK RLS: Admin sieht nur eigene Aktion (%)', c;
  else raise notice 'SMOKE I5 FAIL RLS: Admin sieht % Aktionen (erwartet 1)', c; end if;
end $$;
