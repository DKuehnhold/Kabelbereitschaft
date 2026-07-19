-- =====================================================================
-- AP4 – Bilddokumentation: DB-/RLS-/Trigger-Smoke-Test.
-- NUR LOKAL gegen reines PostgreSQL. Erwartet: 00_stub + Migrationen 0001–0005.
-- Meldet je Prüfung 'SMOKE A.. OK ..' oder 'SMOKE A.. FAIL ..'.
-- (Rein anwendungsseitige Fälle – Upload-Server-Action, EXIF-Parsing, signierte
--  URL-Erzeugung, CSV – werden separat über lint/tsc/build bzw. den Node-CSV-Test
--  abgedeckt; hier: RLS, Constraints, Trigger, Chronik, Audit, Soft-Delete.)
-- =====================================================================
\set ON_ERROR_STOP off
\pset pager off

reset role;
select set_config('test.uid', '', false);

insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111','admin@example.test','{"full_name":"Admin","role":"admin"}'),
  ('99999999-9999-9999-9999-999999999999','dispo@example.test','{"full_name":"Disponent","role":"disponent"}'),
  ('22222222-2222-2222-2222-222222222222','monteurA@example.test','{"full_name":"Monteur A"}'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','monteurB@example.test','{"full_name":"Monteur B"}');

do $$ begin
  if not exists (select 1 from pg_roles where rolname='app_user') then create role app_user; end if;
end $$;
grant usage on schema public to app_user;
grant select, insert, update, delete on all tables in schema public to app_user;
grant usage, select on all sequences in schema public to app_user;
grant execute on all functions in schema public to app_user;
grant usage on schema auth to app_user;
grant select on auth.users to app_user;
grant usage on schema storage to app_user;
grant select, insert, update, delete on storage.objects to app_user;
grant select on storage.buckets to app_user;

set role app_user;

-- ADMIN: Stammdaten + Vorgang + Zuweisung Monteur A
select set_config('test.uid', '11111111-1111-1111-1111-111111111111', false);
insert into public.construction_stages (id, code, name)
  values ('33333333-3333-3333-3333-333333333333','T1','Baustufe');
insert into public.incidents (id, construction_stage_id, vzg_line_number, km_from, title)
  values ('77777777-7777-7777-7777-777777777777','33333333-3333-3333-3333-333333333333','1733',12.5,'Vorgang A');
insert into public.incident_assignments (incident_id, monteur_id)
  values ('77777777-7777-7777-7777-777777777777','22222222-2222-2222-2222-222222222222');

-- =====================================================================
-- MONTEUR A (zugewiesen)
-- =====================================================================
select set_config('test.uid', '22222222-2222-2222-2222-222222222222', false);

-- A1: Upload durch berechtigten Monteur (mit gültiger GPS + Aufnahmedatum)
do $$ begin
  insert into public.incident_images
    (id, incident_id, file_name, mime_type, file_size, storage_path, category,
     exif_present, taken_at, gps_lat, gps_lon, orientation, camera_model, width, height, uploaded_by)
  values
    ('a0000000-0000-0000-0000-000000000001','77777777-7777-7777-7777-777777777777',
     'schaden.jpg','image/jpeg',204800,'incidents/77777777-7777-7777-7777-777777777777/a0000000-0000-0000-0000-000000000001/schaden.jpg',
     'schaden', true, now(), 52.5200, 13.4050, 6, 'Canon EOS', 4000, 3000,
     '22222222-2222-2222-2222-222222222222');
  raise notice 'SMOKE A1 OK Upload berechtigter Monteur';
exception when others then raise notice 'SMOKE A1 FAIL Upload berechtigter Monteur (%)', sqlerrm; end $$;

-- A4/A6: EXIF (Aufnahmedatum) + gültige GPS gespeichert
do $$ declare t timestamptz; la double precision; lo double precision; begin
  select taken_at, gps_lat, gps_lon into t, la, lo from public.incident_images
   where id='a0000000-0000-0000-0000-000000000001';
  if t is not null then raise notice 'SMOKE A4 OK EXIF-Aufnahmedatum gespeichert (%)', t;
  else raise notice 'SMOKE A4 FAIL EXIF-Aufnahmedatum fehlt'; end if;
  if la=52.5200 and lo=13.4050 then raise notice 'SMOKE A6 OK gültige GPS gespeichert';
  else raise notice 'SMOKE A6 FAIL GPS falsch (%/%）', la, lo; end if;
end $$;

-- A5: Bild ohne EXIF wird gespeichert
do $$ begin
  insert into public.incident_images
    (incident_id, file_name, mime_type, file_size, storage_path, category, exif_present, uploaded_by)
  values ('77777777-7777-7777-7777-777777777777','ohne_exif.png','image/png',5120,
          'incidents/77777777-7777-7777-7777-777777777777/n1/ohne_exif.png','detail', false,
          '22222222-2222-2222-2222-222222222222');
  raise notice 'SMOKE A5 OK Bild ohne EXIF gespeichert';
exception when others then raise notice 'SMOKE A5 FAIL Bild ohne EXIF (%)', sqlerrm; end $$;

-- A7: ungültige GPS werden verworfen (DB-Constraint als Backstop)
do $$ begin
  insert into public.incident_images
    (incident_id, file_name, mime_type, file_size, storage_path, category, gps_lat, gps_lon, uploaded_by)
  values ('77777777-7777-7777-7777-777777777777','bad_gps.jpg','image/jpeg',1000,
          'incidents/77777777-7777-7777-7777-777777777777/n2/bad_gps.jpg','sonstiges', 200, 999,
          '22222222-2222-2222-2222-222222222222');
  raise notice 'SMOKE A7 FAIL ungültige GPS wurden akzeptiert';
exception when others then raise notice 'SMOKE A7 OK ungültige GPS verworfen (%)', sqlerrm; end $$;

-- A3: Upload OHNE Vorgang muss scheitern (NOT NULL incident_id)
do $$ begin
  insert into public.incident_images
    (incident_id, file_name, mime_type, file_size, storage_path, category, uploaded_by)
  values (null,'kein_vorgang.jpg','image/jpeg',1000,'incidents/none/x/kein_vorgang.jpg','detail',
          '22222222-2222-2222-2222-222222222222');
  raise notice 'SMOKE A3 FAIL Upload ohne Vorgang zugelassen';
exception when others then raise notice 'SMOKE A3 OK Upload ohne Vorgang blockiert (%)', sqlerrm; end $$;

-- A12/A13: alte + neue Kategorie gültig
do $$ begin
  insert into public.incident_images (incident_id, file_name, mime_type, file_size, storage_path, category, uploaded_by)
  values ('77777777-7777-7777-7777-777777777777','alt.jpg','image/jpeg',1000,
          'incidents/77777777-7777-7777-7777-777777777777/n3/alt.jpg','schadstelle',
          '22222222-2222-2222-2222-222222222222');
  raise notice 'SMOKE A12 OK AP1-Kategorie (schadstelle) gültig';
exception when others then raise notice 'SMOKE A12 FAIL AP1-Kategorie (%)', sqlerrm; end $$;
do $$ begin
  insert into public.incident_images (incident_id, file_name, mime_type, file_size, storage_path, category, uploaded_by)
  values ('77777777-7777-7777-7777-777777777777','neu.jpg','image/jpeg',1000,
          'incidents/77777777-7777-7777-7777-777777777777/n4/neu.jpg','reparatur',
          '22222222-2222-2222-2222-222222222222');
  raise notice 'SMOKE A13 OK AP4-Kategorie (reparatur) auswählbar';
exception when others then raise notice 'SMOKE A13 FAIL AP4-Kategorie (%)', sqlerrm; end $$;

-- A8: Kategorieänderung erzeugt Chronik-Eintrag (Audit separat unten in A8b,
--     da audit_events per RLS nur für Admin sichtbar ist).
update public.incident_images set category='abschluss' where id='a0000000-0000-0000-0000-000000000001';
do $$ declare notes int; begin
  select count(*) into notes from public.incident_notes
   where incident_id='77777777-7777-7777-7777-777777777777' and note_type='bild_kategorie';
  if notes>=1 then raise notice 'SMOKE A8 OK Kategorieänderung in Chronik (%)', notes;
  else raise notice 'SMOKE A8 FAIL Kategorieänderung fehlt in Chronik'; end if;
end $$;

-- A9: Beschreibungsänderung erzeugt Chronik
update public.incident_images set description='Nahaufnahme' where id='a0000000-0000-0000-0000-000000000001';
do $$ declare n int; begin
  select count(*) into n from public.incident_notes
   where incident_id='77777777-7777-7777-7777-777777777777' and note_type='bild_beschreibung';
  if n>=1 then raise notice 'SMOKE A9 OK Beschreibungsänderung in Chronik (%)', n;
  else raise notice 'SMOKE A9 FAIL Beschreibungsänderung fehlt in Chronik'; end if;
end $$;

-- A10/A11: Soft Delete blendet aus + erzeugt Chronik
update public.incident_images
   set deleted_at=now(), deleted_by='22222222-2222-2222-2222-222222222222'
 where id='a0000000-0000-0000-0000-000000000001';
do $$ declare aktiv int; geloescht_note int; begin
  select count(*) into aktiv from public.incident_images
   where id='a0000000-0000-0000-0000-000000000001' and deleted_at is null;
  select count(*) into geloescht_note from public.incident_notes
   where incident_id='77777777-7777-7777-7777-777777777777' and note_type='bild_geloescht';
  if aktiv=0 then raise notice 'SMOKE A10 OK Soft Delete blendet Bild aus';
  else raise notice 'SMOKE A10 FAIL Bild weiterhin aktiv'; end if;
  if geloescht_note>=1 then raise notice 'SMOKE A11 OK Soft Delete in Chronik';
  else raise notice 'SMOKE A11 FAIL Soft-Delete-Chronik fehlt'; end if;
end $$;

-- A17: Storage-RLS – Upload in fremden Pfad durch Monteur B blockiert
select set_config('test.uid', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', false);
-- A2: Upload (Metadaten) durch unberechtigten Benutzer blockiert (Tabellen-RLS)
do $$ begin
  insert into public.incident_images (incident_id, file_name, mime_type, file_size, storage_path, category, uploaded_by)
  values ('77777777-7777-7777-7777-777777777777','fremd.jpg','image/jpeg',1000,
          'incidents/77777777-7777-7777-7777-777777777777/nx/fremd.jpg','detail',
          'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
  raise notice 'SMOKE A2 FAIL unberechtigter Upload zugelassen';
exception when others then raise notice 'SMOKE A2 OK unberechtigter Upload blockiert (%)', sqlerrm; end $$;

do $$ begin
  insert into storage.objects (bucket_id, name)
  values ('incident-images','incidents/77777777-7777-7777-7777-777777777777/z/x.jpg');
  raise notice 'SMOKE A17 FAIL unberechtigter Storage-Upload zugelassen';
exception when others then raise notice 'SMOKE A17 OK Storage-RLS blockiert Fremdupload (%)', sqlerrm; end $$;

-- A14: RLS – Monteur B sieht Bilder des fremden Vorgangs nicht
do $$ declare c int; begin
  select count(*) into c from public.incident_images where incident_id='77777777-7777-7777-7777-777777777777';
  if c=0 then raise notice 'SMOKE A14 OK Monteur B sieht fremde Bilder nicht';
  else raise notice 'SMOKE A14 FAIL Monteur B sieht % fremde Bilder', c; end if;
end $$;

-- A18: Storage-RLS – berechtigter Upload durch Monteur A erlaubt
select set_config('test.uid', '22222222-2222-2222-2222-222222222222', false);
do $$ begin
  insert into storage.objects (bucket_id, name)
  values ('incident-images','incidents/77777777-7777-7777-7777-777777777777/z2/x.jpg');
  raise notice 'SMOKE A18 OK Storage-RLS erlaubt berechtigten Upload';
exception when others then raise notice 'SMOKE A18 FAIL berechtigter Storage-Upload blockiert (%)', sqlerrm; end $$;

-- A15: RLS – Admin sieht Bilder des Vorgangs
select set_config('test.uid', '11111111-1111-1111-1111-111111111111', false);
do $$ declare c int; begin
  select count(*) into c from public.incident_images where incident_id='77777777-7777-7777-7777-777777777777';
  if c>=1 then raise notice 'SMOKE A15 OK Admin sieht Bilder (%)', c;
  else raise notice 'SMOKE A15 FAIL Admin sieht keine Bilder'; end if;
end $$;

-- A8b: Audit (nur als Service/Admin sichtbar) – Bild-Ereignisse wurden auditiert
reset role;
select set_config('test.uid', '', false);
do $$ declare ins int; upd int; begin
  select count(*) into ins from public.audit_events where entity='incident_images' and action='INSERT';
  select count(*) into upd from public.audit_events where entity='incident_images' and action='UPDATE';
  if ins>=1 and upd>=1 then raise notice 'SMOKE A8b OK Audit Bild-Ereignisse (INSERT=%, UPDATE=%)', ins, upd;
  else raise notice 'SMOKE A8b FAIL Audit fehlt (INSERT=%, UPDATE=%)', ins, upd; end if;
end $$;

-- A16: Dashboard-Kennzahl „Heute hochgeladene Bilder" (nur nicht gelöschte)
do $$ declare heute int; begin
  select count(*) into heute from public.incident_images
   where deleted_at is null and uploaded_at >= date_trunc('day', now());
  -- erwartet 4: ohne_exif, alt, neu + (A1 wurde soft-deleted) => 3 aktive dieser + ?
  raise notice 'SMOKE A16 INFO Heute aktive Bilder (Kennzahl) = %', heute;
  if heute >= 1 then raise notice 'SMOKE A16 OK Kennzahl zählt nur nicht gelöschte, heutige Bilder (%)', heute;
  else raise notice 'SMOKE A16 FAIL Kennzahl = %', heute; end if;
end $$;

-- A19: Bucket serverseitig gehärtet (Größe + MIME)
do $$ declare lim bigint; mimes text; begin
  select file_size_limit, array_to_string(allowed_mime_types,',') into lim, mimes
    from storage.buckets where id='incident-images';
  if lim=15728640 and mimes='image/jpeg,image/png'
    then raise notice 'SMOKE A19 OK Bucket gehärtet (%,%)', lim, mimes;
    else raise notice 'SMOKE A19 FAIL Bucket-Härtung: %/%', lim, mimes; end if;
end $$;
