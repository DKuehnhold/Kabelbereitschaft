-- =====================================================================
-- AP12 – Smoke-Test (Vorgangsdetail, Kontakte, Kabelpositionen, On-Call)
-- Erwartet: 00_stub_auth_storage.sql + Migrationen 0001–0010.
-- =====================================================================
\set ON_ERROR_STOP off
\pset pager off

reset role;
select set_config('test.uid', '', false);

insert into auth.users (id, email, raw_user_meta_data) values
  ('e1000000-0000-0000-0000-000000000001','admin12@t','{"full_name":"Admin12","role":"admin"}'),
  ('e1000000-0000-0000-0000-000000000002','dispo12@t','{"full_name":"Dispo12","role":"disponent"}'),
  ('e1000000-0000-0000-0000-000000000003','monteur12@t','{"full_name":"Monteur12"}'),
  ('e1000000-0000-0000-0000-000000000004','fremd12@t','{"full_name":"Fremd12"}')
on conflict (id) do nothing;

do $$ begin if not exists (select 1 from pg_roles where rolname='app_user') then create role app_user; end if; end $$;
grant usage on schema public to app_user;
grant select, insert, update, delete on all tables in schema public to app_user;
grant usage, select on all sequences in schema public to app_user;
grant execute on function public.create_incident_ap12(
  uuid,uuid,uuid,uuid,public.incident_priority,text,text,text,text,text,text,text,text,numeric,numeric,text,text,text,uuid,uuid,jsonb
) to app_user;
grant execute on function public.update_incident_ap12(
  uuid,uuid,uuid,uuid,uuid,public.incident_priority,text,text,text,text,text,text,text,text,numeric,numeric,text,text,text,uuid,uuid,jsonb
) to app_user;
grant execute on function public.get_assigned_incident_contact(uuid) to app_user;
grant usage on schema auth to app_user;
grant select on auth.users to app_user;

insert into public.customers(id,name) values ('e2000000-0000-0000-0000-000000000001','Kunde 12');
insert into public.construction_stages(id,code,name) values ('e3000000-0000-0000-0000-000000000001','B12','Bauabschnitt 12');
insert into public.vzg_lines(id,line_number,construction_stage_id)
values ('e4000000-0000-0000-0000-000000000001','1812','e3000000-0000-0000-0000-000000000001');
insert into public.contacts(id,customer_id,name,function)
values ('e5000000-0000-0000-0000-000000000001','e2000000-0000-0000-0000-000000000001','Kontakt Alt','Bauleiter');
insert into public.contact_phone_numbers(id,contact_id,phone,phone_type)
values ('e6000000-0000-0000-0000-000000000001','e5000000-0000-0000-0000-000000000001','+49 111 222','mobil');

set role app_user;
select set_config('test.uid', 'e1000000-0000-0000-0000-000000000001', false);

-- D1: Anlage mit zwei vollständigen Positionen und Kontakt-Snapshot.
do $$ declare v_id uuid; v_count int; v_name text; begin
  v_id := public.create_incident_ap12(
    'e2000000-0000-0000-0000-000000000001','e3000000-0000-0000-0000-000000000001',
    'e4000000-0000-0000-0000-000000000001',null,'hoch','AP12 Detail',
    null,null,null,null,null,null,null,null,null,null,null,null,
    'e5000000-0000-0000-0000-000000000001','e6000000-0000-0000-0000-000000000001',
    jsonb_build_array(
      jsonb_build_object('cable_type_id',(select id from cable_types where code='lst'),'quantity_value',2,'quantity_unit','piece','condition_code','ready'),
      jsonb_build_object('cable_type_id',(select id from cable_types where code='tk'),'quantity_value',12.5,'quantity_unit','meter','condition_code','restricted')
    )
  );
  select count(*) into v_count from incident_cable_positions where incident_id=v_id;
  select contact_name_snapshot into v_name from incidents where id=v_id;
  if v_count=2 and v_name='Kontakt Alt' then
    raise notice 'SMOKE D1 OK zwei Positionen und Kontakt-Snapshot';
  else raise notice 'SMOKE D1 FAIL positions=% snapshot=%',v_count,v_name; end if;
end $$;

-- D2: Snapshot bleibt nach Stammdatenänderung unverändert.
update public.contacts set name='Kontakt Neu' where id='e5000000-0000-0000-0000-000000000001';
do $$ declare v_name text; begin
  select contact_name_snapshot into v_name from incidents where description='AP12 Detail';
  if v_name='Kontakt Alt' then raise notice 'SMOKE D2 OK Snapshot historisch stabil';
  else raise notice 'SMOKE D2 FAIL snapshot=%',v_name; end if;
end $$;

-- D3: Teil-NULL, Dezimal-Stück und ungültiger Zustand werden abgelehnt.
do $$ declare v_id uuid; begin
  select id into v_id from incidents where description='AP12 Detail';
  insert into incident_cable_positions(incident_id,cable_type_id,sort_order,quantity_value,quantity_unit,condition_code)
  values(v_id,(select id from cable_types where code='lwl'),8,1,null,'ready');
  raise notice 'SMOKE D3a FAIL Teil-NULL zugelassen';
exception when check_violation then raise notice 'SMOKE D3a OK Teil-NULL blockiert'; end $$;
do $$ declare v_id uuid; begin
  select id into v_id from incidents where description='AP12 Detail';
  insert into incident_cable_positions(incident_id,cable_type_id,sort_order,quantity_value,quantity_unit,condition_code)
  values(v_id,(select id from cable_types where code='lwl'),8,1.5,'piece','ready');
  raise notice 'SMOKE D3b FAIL Dezimal-Stück zugelassen';
exception when check_violation then raise notice 'SMOKE D3b OK Dezimal-Stück blockiert'; end $$;
do $$ declare v_id uuid; begin
  select id into v_id from incidents where description='AP12 Detail';
  insert into incident_cable_positions(incident_id,cable_type_id,sort_order,quantity_value,quantity_unit,condition_code)
  values(v_id,(select id from cable_types where code='lwl'),8,1,'piece','unknown');
  raise notice 'SMOKE D3c FAIL Zustand zugelassen';
exception when check_violation then raise notice 'SMOKE D3c OK Zustand blockiert'; end $$;

-- D4: Historische unveränderte NULL-Position bleibt zulässig; eine fachliche
-- Änderung derselben Position ohne Qualifizierung wird abgelehnt.
do $$ declare v_inc uuid := gen_random_uuid(); v_pos uuid; begin
  insert into incidents(id,customer_id,construction_stage_id,vzg_line_id,vzg_line_number,description)
  values(v_inc,'e2000000-0000-0000-0000-000000000001','e3000000-0000-0000-0000-000000000001',
         'e4000000-0000-0000-0000-000000000001','1812','Historisch AP12');
  insert into incident_cable_positions(incident_id,cable_type_id,sort_order)
  values(v_inc,(select id from cable_types where code='lst'),0) returning id into v_pos;
  perform public.update_incident_ap12(
    v_inc,'e2000000-0000-0000-0000-000000000001','e3000000-0000-0000-0000-000000000001',
    'e4000000-0000-0000-0000-000000000001',null,'normal','Historisch AP12',
    null,null,null,null,null,null,null,null,null,null,null,null,null,null,
    jsonb_build_array(jsonb_build_object('id',v_pos,'cable_type_id',(select id from cable_types where code='lst')))
  );
  raise notice 'SMOKE D4a OK unveränderte historische NULL-Position';
  begin
    perform public.update_incident_ap12(
      v_inc,'e2000000-0000-0000-0000-000000000001','e3000000-0000-0000-0000-000000000001',
      'e4000000-0000-0000-0000-000000000001',null,'normal','Historisch AP12',
      null,null,null,null,null,null,null,null,null,null,null,null,null,null,
      jsonb_build_array(jsonb_build_object('id',v_pos,'cable_type_id',(select id from cable_types where code='tk')))
    );
    raise notice 'SMOKE D4b FAIL geänderte NULL-Position zugelassen';
  exception when others then raise notice 'SMOKE D4b OK geänderte NULL-Position blockiert'; end;
end $$;

-- D5: AP10 ist für Anwendungsrollen entzogen.
do $$ declare a boolean; b boolean; begin
  select has_function_privilege('authenticated',
    'public.create_incident_ap10(uuid,uuid,uuid,uuid,public.incident_priority,text,text,text,text,text,text,text,text,numeric,numeric,text,text,text,uuid)',
    'EXECUTE') into a;
  select has_function_privilege('authenticated',
    'public.update_incident_ap10(uuid,uuid,uuid,uuid,uuid,public.incident_priority,text,text,text,text,text,text,text,text,numeric,numeric,text,text,text,uuid)',
    'EXECUTE') into b;
  if not a and not b then raise notice 'SMOKE D5 OK AP10-Ausführung entzogen';
  else raise notice 'SMOKE D5 FAIL create=% update=%',a,b; end if;
end $$;

-- D6: Monteur-Projektion nur für zugewiesenen Vorgang; keine Kontaktliste.
reset role;
do $$ declare v_id uuid; begin
  select id into v_id from incidents where description='AP12 Detail';
  insert into incident_assignments(incident_id,monteur_id)
  values(v_id,'e1000000-0000-0000-0000-000000000003');
end $$;
set role app_user;
select set_config('test.uid', 'e1000000-0000-0000-0000-000000000003', false);
do $$ declare n int; c int; begin
  select count(*) into n from get_assigned_incident_contact((select id from incidents where description='AP12 Detail'));
  select count(*) into c from contacts;
  if n=1 and c=0 then raise notice 'SMOKE D6a OK Projektion ja, Kontaktliste nein';
  else raise notice 'SMOKE D6a FAIL projection=% contacts=%',n,c; end if;
end $$;
select set_config('test.uid', 'e1000000-0000-0000-0000-000000000004', false);
do $$ declare n int; begin
  select count(*) into n from get_assigned_incident_contact((select id from incidents where description='AP12 Detail'));
  if n=0 then raise notice 'SMOKE D6b OK fremder Monteur ohne Projektion';
  else raise notice 'SMOKE D6b FAIL projection=%',n; end if;
end $$;

-- D7: On-Call CRUD nur Staff.
select set_config('test.uid', 'e1000000-0000-0000-0000-000000000002', false);
do $$ declare v_id uuid; begin
  insert into on_call_numbers(number,label) values('+49 999','AP12') returning id into v_id;
  update on_call_numbers set label='AP12 geändert' where id=v_id;
  if exists(select 1 from on_call_numbers where id=v_id and label='AP12 geändert')
    then raise notice 'SMOKE D7a OK Staff CRUD'; else raise notice 'SMOKE D7a FAIL'; end if;
end $$;
select set_config('test.uid', 'e1000000-0000-0000-0000-000000000003', false);
do $$ begin
  insert into on_call_numbers(number,label) values('+49 998','unzulässig');
  raise notice 'SMOKE D7b FAIL Monteur konnte On-Call schreiben';
exception when others then raise notice 'SMOKE D7b OK Monteur-Schreibzugriff blockiert'; end $$;

reset role;
select set_config('test.uid', '', false);
select 'AP12 SMOKE FERTIG' as info;
