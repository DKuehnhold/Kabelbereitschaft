-- NUR FUER LOKALEN TEST. Verhaltenspruefung von RLS, Triggern, Bestandsschutz.
-- Erwartet: 00_stub_auth_storage.sql + Migrationen bereits angewendet.

\set ON_ERROR_STOP off

-- (1) Bootstrap als Service (auth.uid() = NULL) -------------------------------
reset role;
select set_config('test.uid', '', false);

insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111','admin@example.test','{"full_name":"Admin Test","role":"admin"}'),
  ('22222222-2222-2222-2222-222222222222','monteur@example.test','{"full_name":"Monteur Test"}');

select id, role from public.profiles order by role;

create role app_user;
grant usage on schema public to app_user;
grant select, insert, update, delete on all tables in schema public to app_user;
grant usage, select on all sequences in schema public to app_user;
grant execute on all functions in schema public to app_user;
grant usage on schema storage to app_user;
grant select, insert, update, delete on storage.objects to app_user;
grant select on storage.buckets to app_user;
grant usage on schema auth to app_user;
grant select on auth.users to app_user;

-- (2) Als ADMIN Stammdaten + Vorgang anlegen ---------------------------------
set role app_user;
select set_config('test.uid', '11111111-1111-1111-1111-111111111111', false);

insert into public.construction_stages (id, code, name)
  values ('33333333-3333-3333-3333-333333333333','T1','Test-Baustufe');
insert into public.on_call_numbers (id, number)
  values ('44444444-4444-4444-4444-444444444444','TN-1');
insert into public.materials (id, material_no, name, unit)
  values ('55555555-5555-5555-5555-555555555555','TM-1','Testmaterial','Stk');
insert into public.storage_locations (id, name, location_type)
  values ('66666666-6666-6666-6666-666666666666','Testlager','zentrallager');

insert into public.incidents
  (id, construction_stage_id, vzg_line_number, km_from, on_call_number_id, call_received_at, caller_name, title)
  values ('77777777-7777-7777-7777-777777777777',
          '33333333-3333-3333-3333-333333333333','1733',12.500,
          '44444444-4444-4444-4444-444444444444', now(),'Fdl Test','Testvorgang');

-- zweiter Vorgang OHNE Zuweisung an den Monteur
insert into public.incidents
  (id, construction_stage_id, vzg_line_number, km_from)
  values ('88888888-8888-8888-8888-888888888888',
          '33333333-3333-3333-3333-333333333333','1733',20.000);

insert into public.incident_assignments (incident_id, monteur_id)
  values ('77777777-7777-7777-7777-777777777777','22222222-2222-2222-2222-222222222222');

-- Wareneingang +10
insert into public.inventory_movements (material_id, quantity, movement_type, target_location_id)
  values ('55555555-5555-5555-5555-555555555555',10,'wareneingang','66666666-6666-6666-6666-666666666666');

select 'BESTAND nach Wareneingang (erwartet 10)' as pruefung,
       quantity from public.material_stock
 where material_id='55555555-5555-5555-5555-555555555555';

-- (3) Als MONTEUR -------------------------------------------------------------
select set_config('test.uid', '22222222-2222-2222-2222-222222222222', false);

select 'MONTEUR sieht zugewiesenen Vorgang (erwartet 1)' as pruefung, count(*)
  from public.incidents where id='77777777-7777-7777-7777-777777777777';
select 'MONTEUR sieht fremden Vorgang NICHT (erwartet 0)' as pruefung, count(*)
  from public.incidents where id='88888888-8888-8888-8888-888888888888';

-- Entnahme 3 (erlaubt) -> Bestand 7
insert into public.inventory_movements
  (material_id, quantity, movement_type, source_location_id, incident_id)
  values ('55555555-5555-5555-5555-555555555555',3,'entnahme_vorgang',
          '66666666-6666-6666-6666-666666666666','77777777-7777-7777-7777-777777777777');
select 'BESTAND nach Entnahme 3 (erwartet 7)' as pruefung, quantity
  from public.material_stock
 where material_id='55555555-5555-5555-5555-555555555555'
   and location_id='66666666-6666-6666-6666-666666666666';

-- Erlaubter Statuswechsel + Zustandsbewertung
update public.incidents set status='vor_ort', condition_rating='geringfuegig_beschaedigt'
 where id='77777777-7777-7777-7777-777777777777';
select 'STATUS nach Monteur-Update (erwartet vor_ort)' as pruefung, status
  from public.incidents where id='77777777-7777-7777-7777-777777777777';

-- (4) NEGATIVTESTS (muessen blockiert werden) --------------------------------
do $$ begin
  insert into public.inventory_movements
    (material_id, quantity, movement_type, source_location_id, incident_id)
    values ('55555555-5555-5555-5555-555555555555',100,'entnahme_vorgang',
            '66666666-6666-6666-6666-666666666666','77777777-7777-7777-7777-777777777777');
  raise notice 'FEHLER: negativer Bestand wurde NICHT blockiert';
exception when others then
  raise notice 'OK  negativer Bestand blockiert (%)', sqlerrm;
end $$;

do $$ begin
  insert into public.incidents (construction_stage_id, vzg_line_number, km_from)
    values ('33333333-3333-3333-3333-333333333333','9999',1);
  raise notice 'FEHLER: Monteur konnte Vorgang anlegen';
exception when others then
  raise notice 'OK  Monteur-Vorgangsanlage blockiert (%)', sqlerrm;
end $$;

do $$ begin
  update public.incidents set status='abgeschlossen'
   where id='77777777-7777-7777-7777-777777777777';
  raise notice 'FEHLER: Monteur konnte administrativ abschliessen';
exception when others then
  raise notice 'OK  Monteur-Statusschutz greift (%)', sqlerrm;
end $$;

-- (5) Auswertung als Service --------------------------------------------------
reset role;
select set_config('test.uid', '', false);
select 'STATUS-CHRONIK Eintraege Vorgang (erwartet >=2)' as pruefung, count(*)
  from public.incident_status_history
 where incident_id='77777777-7777-7777-7777-777777777777';
select 'AUDIT-Ereignisse gesamt (erwartet > 0)' as pruefung, count(*)
  from public.audit_events;

-- (6) AP2: Priorität ----------------------------------------------------------
select 'AP2 Priorität Default (erwartet normal)' as pruefung, priority::text as priority
  from public.incidents where id='77777777-7777-7777-7777-777777777777';
update public.incidents set priority='kritisch'
  where id='77777777-7777-7777-7777-777777777777';
select 'AP2 Priorität gesetzt (erwartet kritisch)' as pruefung, priority::text as priority
  from public.incidents where id='77777777-7777-7777-7777-777777777777';
