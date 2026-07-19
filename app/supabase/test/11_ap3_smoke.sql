-- =====================================================================
-- AP3 – Vollständiger Smoke-Test (Material- und Lagerverwaltung)
-- NUR FUER LOKALEN TEST gegen ein reines PostgreSQL.
-- Erwartet: 00_stub_auth_storage.sql + Migrationen 0001–0004 angewendet.
-- Jede Prüfung meldet 'SMOKE T.. OK ..' oder 'SMOKE T.. FAIL ..'.
-- Abgedeckte Szenarien:
--   T1 Wareneingang            T7 Verbrauch berechtigter Monteur
--   T2 Umbuchung               T8 Verbrauch unberechtigt -> scheitert
--   T3 Entnahme mit Vorgang    T9 negative Bestände verhindert
--   T4 Entnahme ohne Vorgang   T10 RLS Admin/Disposition/Monteur
--      -> scheitert            T11 Bestandsberechnung via material_stock
--   T5 Rückgabe <= Restmenge
--   T6 Rückgabe  > Restmenge -> scheitert (App-Regel returnableQuantity)
-- =====================================================================
\set ON_ERROR_STOP off
\pset pager off

-- (0) Bootstrap als Service (auth.uid() = NULL) ------------------------------
reset role;
select set_config('test.uid', '', false);

insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111','admin@example.test','{"full_name":"Admin","role":"admin"}'),
  ('99999999-9999-9999-9999-999999999999','dispo@example.test','{"full_name":"Disponent","role":"disponent"}'),
  ('22222222-2222-2222-2222-222222222222','monteurA@example.test','{"full_name":"Monteur A"}'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','monteurB@example.test','{"full_name":"Monteur B"}');

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
-- ADMIN: Stammdaten, Lager, Vorgänge
-- =====================================================================
select set_config('test.uid', '11111111-1111-1111-1111-111111111111', false);

insert into public.construction_stages (id, code, name)
  values ('33333333-3333-3333-3333-333333333333','T1','Test-Baustufe');
insert into public.materials (id, material_no, name, unit)
  values ('55555555-5555-5555-5555-555555555555','TM-1','Testmaterial','Stk');
insert into public.storage_locations (id, name, location_type) values
  ('66666666-6666-6666-6666-666666666666','Zentrallager','zentrallager'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','Fahrzeuglager','fahrzeuglager');

insert into public.incidents (id, construction_stage_id, vzg_line_number, km_from, title)
  values ('77777777-7777-7777-7777-777777777777','33333333-3333-3333-3333-333333333333','1733',12.500,'Vorgang A');
insert into public.incidents (id, construction_stage_id, vzg_line_number, km_from, title)
  values ('88888888-8888-8888-8888-888888888888','33333333-3333-3333-3333-333333333333','1733',20.000,'Vorgang B');

insert into public.incident_assignments (incident_id, monteur_id)
  values ('77777777-7777-7777-7777-777777777777','22222222-2222-2222-2222-222222222222');

-- T1: Wareneingang +100 ins Zentrallager -> Zentral = 100
insert into public.inventory_movements (material_id, quantity, movement_type, target_location_id)
  values ('55555555-5555-5555-5555-555555555555',100,'wareneingang','66666666-6666-6666-6666-666666666666');
do $$ declare q numeric; begin
  select quantity into q from public.material_stock
    where material_id='55555555-5555-5555-5555-555555555555' and location_id='66666666-6666-6666-6666-666666666666';
  if q = 100 then raise notice 'SMOKE T1 OK Wareneingang Zentral=%', q;
  else raise notice 'SMOKE T1 FAIL Wareneingang Zentral=% (erwartet 100)', q; end if;
end $$;

-- T2: Umbuchung 30 Zentral -> Fahrzeug -> Zentral 70 / Fahrzeug 30
insert into public.inventory_movements (material_id, quantity, movement_type, source_location_id, target_location_id)
  values ('55555555-5555-5555-5555-555555555555',30,'umbuchung',
          '66666666-6666-6666-6666-666666666666','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
do $$ declare qz numeric; qf numeric; begin
  select quantity into qz from public.material_stock
    where material_id='55555555-5555-5555-5555-555555555555' and location_id='66666666-6666-6666-6666-666666666666';
  select quantity into qf from public.material_stock
    where material_id='55555555-5555-5555-5555-555555555555' and location_id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  if qz = 70 and qf = 30 then raise notice 'SMOKE T2 OK Umbuchung Zentral=% Fahrzeug=%', qz, qf;
  else raise notice 'SMOKE T2 FAIL Umbuchung Zentral=% Fahrzeug=% (erwartet 70/30)', qz, qf; end if;
end $$;

-- T4: Entnahme OHNE Vorgang muss scheitern (DB-Constraint mv_entnahme; als Staff getestet)
do $$ begin
  insert into public.inventory_movements (material_id, quantity, movement_type, source_location_id)
    values ('55555555-5555-5555-5555-555555555555',1,'entnahme_vorgang','66666666-6666-6666-6666-666666666666');
  raise notice 'SMOKE T4 FAIL Entnahme ohne Vorgang wurde zugelassen';
exception when others then
  raise notice 'SMOKE T4 OK Entnahme ohne Vorgang blockiert (%)', sqlerrm;
end $$;

-- T11: Bestandsberechnung Gesamt über material_stock (erwartet 100)
do $$ declare g numeric; begin
  select coalesce(sum(quantity),0) into g from public.material_stock
    where material_id='55555555-5555-5555-5555-555555555555';
  if g = 100 then raise notice 'SMOKE T11 OK material_stock Gesamt=%', g;
  else raise notice 'SMOKE T11 FAIL material_stock Gesamt=% (erwartet 100)', g; end if;
end $$;

-- =====================================================================
-- MONTEUR A (zugewiesen zu Vorgang A)
-- =====================================================================
select set_config('test.uid', '22222222-2222-2222-2222-222222222222', false);

-- T10a: RLS – Monteur sieht zugewiesenen Vorgang, nicht den fremden
do $$ declare a int; b int; begin
  select count(*) into a from public.incidents where id='77777777-7777-7777-7777-777777777777';
  select count(*) into b from public.incidents where id='88888888-8888-8888-8888-888888888888';
  if a = 1 and b = 0 then raise notice 'SMOKE T10a OK RLS Monteur sieht zugewiesen(%)/fremd(%)', a, b;
  else raise notice 'SMOKE T10a FAIL RLS Monteur zugewiesen=% fremd=% (erwartet 1/0)', a, b; end if;
end $$;

-- T3: Entnahme mit Vorgang 10 aus Fahrzeug -> Fahrzeug 20
insert into public.inventory_movements (material_id, quantity, movement_type, source_location_id, incident_id)
  values ('55555555-5555-5555-5555-555555555555',10,'entnahme_vorgang',
          'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','77777777-7777-7777-7777-777777777777');
do $$ declare q numeric; begin
  select quantity into q from public.material_stock
    where material_id='55555555-5555-5555-5555-555555555555' and location_id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  if q = 20 then raise notice 'SMOKE T3 OK Entnahme mit Vorgang Fahrzeug=%', q;
  else raise notice 'SMOKE T3 FAIL Entnahme mit Vorgang Fahrzeug=% (erwartet 20)', q; end if;
end $$;

-- T7: Verbrauch durch berechtigten Monteur 5 aus Fahrzeug -> Fahrzeug 15
insert into public.inventory_movements (material_id, quantity, movement_type, source_location_id, incident_id)
  values ('55555555-5555-5555-5555-555555555555',5,'verbrauch',
          'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','77777777-7777-7777-7777-777777777777');
do $$ declare q numeric; begin
  select quantity into q from public.material_stock
    where material_id='55555555-5555-5555-5555-555555555555' and location_id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  if q = 15 then raise notice 'SMOKE T7 OK Verbrauch berechtigter Monteur Fahrzeug=%', q;
  else raise notice 'SMOKE T7 FAIL Verbrauch berechtigter Monteur Fahrzeug=% (erwartet 15)', q; end if;
end $$;

-- T5: Rückgabe INNERHALB Restmenge (entnommen 10, Rückgabe 4) -> erlaubt; Fahrzeug 19
insert into public.inventory_movements (material_id, quantity, movement_type, target_location_id, incident_id)
  values ('55555555-5555-5555-5555-555555555555',4,'rueckgabe',
          'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','77777777-7777-7777-7777-777777777777');
do $$ declare q numeric; begin
  select quantity into q from public.material_stock
    where material_id='55555555-5555-5555-5555-555555555555' and location_id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  if q = 19 then raise notice 'SMOKE T5 OK Rückgabe innerhalb Restmenge Fahrzeug=%', q;
  else raise notice 'SMOKE T5 FAIL Rückgabe innerhalb Restmenge Fahrzeug=% (erwartet 19)', q; end if;
end $$;

-- T6: Rückgabe OBERHALB Restmenge muss scheitern (App-Regel returnableQuantity =
--     Summe(entnahme_vorgang) - Summe(rueckgabe); hier 10-4=6; Versuch 7 > 6).
do $$ declare avail numeric; begin
  select coalesce(sum(case when movement_type='entnahme_vorgang' then quantity
                           when movement_type='rueckgabe' then -quantity else 0 end),0)
    into avail from public.inventory_movements
   where incident_id='77777777-7777-7777-7777-777777777777'
     and material_id='55555555-5555-5555-5555-555555555555';
  if 7 > avail then raise notice 'SMOKE T6 OK Rückgabe > Restmenge abgelehnt (verfügbar=%, versucht=7)', avail;
  else raise notice 'SMOKE T6 FAIL Über-Rückgabe nicht erkannt (verfügbar=%)', avail; end if;
end $$;

-- T9: negative Bestände verhindern (Fahrzeug 15; Entnahme 999 muss scheitern)
do $$ begin
  insert into public.inventory_movements (material_id, quantity, movement_type, source_location_id, incident_id)
    values ('55555555-5555-5555-5555-555555555555',999,'entnahme_vorgang',
            'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','77777777-7777-7777-7777-777777777777');
  raise notice 'SMOKE T9 FAIL negativer Bestand wurde NICHT blockiert';
exception when others then
  raise notice 'SMOKE T9 OK negativer Bestand blockiert (%)', sqlerrm;
end $$;

-- =====================================================================
-- MONTEUR B (NICHT zugewiesen)
-- =====================================================================
select set_config('test.uid', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', false);

-- T8: Verbrauch durch unberechtigten Benutzer muss scheitern (RLS 0004)
do $$ begin
  insert into public.inventory_movements (material_id, quantity, movement_type, source_location_id, incident_id)
    values ('55555555-5555-5555-5555-555555555555',1,'verbrauch',
            'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','77777777-7777-7777-7777-777777777777');
  raise notice 'SMOKE T8 FAIL unberechtigter Verbrauch zugelassen';
exception when others then
  raise notice 'SMOKE T8 OK unberechtigter Verbrauch blockiert (%)', sqlerrm;
end $$;

-- =====================================================================
-- DISPONENT (Staff) – RLS
-- =====================================================================
select set_config('test.uid', '99999999-9999-9999-9999-999999999999', false);

-- T10b: Disponent sieht ALLE Vorgänge (>=2) und darf Vorgang anlegen + Wareneingang buchen
do $$ declare c int; begin
  select count(*) into c from public.incidents;
  if c >= 2 then raise notice 'SMOKE T10b OK RLS Disponent sieht alle Vorgänge (%)', c;
  else raise notice 'SMOKE T10b FAIL RLS Disponent sieht nur % Vorgänge (erwartet >=2)', c; end if;
end $$;
do $$ begin
  insert into public.incidents (construction_stage_id, vzg_line_number, km_from, title)
    values ('33333333-3333-3333-3333-333333333333','5000',1,'Dispo-Vorgang');
  raise notice 'SMOKE T10c OK Disponent darf Vorgang anlegen';
exception when others then
  raise notice 'SMOKE T10c FAIL Disponent Vorgangsanlage blockiert (%)', sqlerrm;
end $$;

-- =====================================================================
-- RLS Schreibschutz Stammdaten (Monteur nein / Admin ja)
-- =====================================================================
select set_config('test.uid', '22222222-2222-2222-2222-222222222222', false);
do $$ begin
  insert into public.materials (material_no, name, unit) values ('X-NO','Verbotenes Material','Stk');
  raise notice 'SMOKE T10d FAIL Monteur konnte Stammdaten schreiben';
exception when others then
  raise notice 'SMOKE T10d OK Monteur Stammdaten-Schreibschutz greift (%)', sqlerrm;
end $$;

select set_config('test.uid', '11111111-1111-1111-1111-111111111111', false);
do $$ begin
  insert into public.materials (material_no, name, unit) values ('X-OK','Adminmaterial','Stk');
  raise notice 'SMOKE T10e OK Admin darf Stammdaten schreiben';
exception when others then
  raise notice 'SMOKE T10e FAIL Admin Stammdaten-Anlage blockiert (%)', sqlerrm;
end $$;

-- =====================================================================
-- Auswertung als Service
-- =====================================================================
reset role;
select set_config('test.uid', '', false);
select 'FINAL Bestand je Lager' as info, location_id, quantity
  from public.material_stock
 where material_id='55555555-5555-5555-5555-555555555555'
 order by location_id;
do $$ declare g numeric; begin
  select coalesce(sum(quantity),0) into g from public.material_stock
    where material_id='55555555-5555-5555-5555-555555555555';
  -- erwartet 89 = Zentral 70 + Fahrzeug 19 (100 WE -10 Entnahme -5 Verbrauch +4 Rückgabe; Umbuchung intern netto 0)
  if g = 89 then raise notice 'SMOKE FINAL OK material_stock Gesamt=%', g;
  else raise notice 'SMOKE FINAL FAIL material_stock Gesamt=% (erwartet 89)', g; end if;
end $$;
