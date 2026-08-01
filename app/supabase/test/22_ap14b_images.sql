\set ON_ERROR_STOP on

-- =====================================================================
-- AP14/B - Bilddokumentation unter der Anwendungsrolle app_user mit
-- AKTIVER RLS.
--
-- Erwartet die vollstaendige Kette einschliesslich 0012, 0013, 0014, 0015 und
-- 0016 sowie die Smokes 19_ap14b_platform.sql, 19a_ap14b_grant_reset.sql,
-- 20_ap14b_data.sql und 21_ap14b_masterdata_inventory.sql. Diese Datei ist der
-- neue letzte Eintrag der Kette.
--
-- Verbindliche Eigenschaften dieses Smokes:
--   * Er laeuft HINTER Migration 0016 und misst damit den echten
--     Produktrechtestand des Bildpfades und das Verhalten der bestehenden
--     Policies. Der Rechtestand ist ZWEITEILIG: select (0014:40) und insert
--     (0016) gelten TABELLENWEIT, update (0016) gilt AUSSCHLIESSLICH auf den
--     vier Spalten category, description, deleted_at und deleted_by. Diese
--     Zweiteilung ist tragend und wird in dieser Datei durchgehend
--     auseinandergehalten: die POLICY images_update entscheidet, WELCHE ZEILE
--     geaendert werden darf; das SPALTENRECHT entscheidet, WELCHE SPALTE. Wer
--     die Policy fuer die Spaltenschranke haelt, irrt - sie nennt keine einzige
--     Spalte. Er fuehrt selbst KEIN `grant` und KEIN `revoke` aus, aendert keine
--     Policy und schaltet keinen Trigger ab.
--   * WARUM 0016 in der Kette erst NACH 20_ap14b_data.sql angewendet wird:
--     20_ap14b_data.sql prueft in D14 ausdruecklich NEGATIV, dass app_user KEIN
--     delete auf public.sync_actions besitzt (20_ap14b_data.sql:699). 0016
--     erteilt dieses Recht nicht - die Negativpruefung bleibt also in jeder
--     Reihenfolge gueltig. Die Reihenfolge ist trotzdem einzuhalten, aus
--     demselben Grund wie bei 0015/21: die Kette bleibt so lesbar, jede
--     Rechtematrix steht unmittelbar vor ihrem Smoke, und ein spaeter
--     ergaenztes Recht kann keine bestehende Negativprobe still entwerten.
--     Fall G3 unten haelt den sync_actions-Zustand nach 0016 noch einmal fest.
--   * Die Identitaet wird immer transaktionsgebunden mit
--     set_config('app.user_id', ..., true) gesetzt - genau so, wie
--     withUserTransaction() es tut (app/src/lib/db/index.ts). Jeder `do`-Block
--     ist eine eigene Transaktion, die Identitaet endet mit ihm.
--   * Geprueft wird unter `set role app_user` mit aktiver RLS. Der
--     Eigentuemerkontext dient ausschliesslich den Fixtures und den
--     Gegenproben, die app_user gerade NICHT lesen darf (Audit in B14).
--   * DER OBJEKTSPEICHER WIRD HIER NICHT ANGESPROCHEN. `storage_path` ist fuer
--     die Datenbank ein reiner Textwert; die Werte unten zeigen auf kein Objekt.
--     Der Objektpfad (buildStoragePath), die signierten URLs und die
--     Kompensation eines verwaisten Objekts sind Gegenstand des
--     Node-Integrationstests, NICHT dieses Smokes. Diese Datei ist also kein
--     MinIO-Nachweis und darf nicht als solcher gelesen werden.
--   * Nur synthetische Werte: keine echten Personen, keine echten Dateien,
--     kein Passwort und kein Hashmaterial. Ausdruecklich AUCH KEINE EXIF- oder
--     GPS-Werte: exif_present bleibt beim Spaltendefault false, taken_at,
--     gps_lat, gps_lon, orientation und camera_model bleiben NULL.
--   * Gezaehlt wird ausschliesslich RELATIV ueber eigene Kennungen. Kein Fall
--     zaehlt absolut ueber eine ganze Tabelle, damit die Fixtures der Smokes
--     15-21 unberuehrt bleiben.
--
-- Nebenwirkung, die hier bewusst NICHT geprueft wird: jede Aenderung an
-- public.incident_images loest ueber trg_sync_tasks_images (0011:275-277) die
-- Ableitung der Aufgabe 'no_images' aus. Sie laeuft in einem
-- SECURITY-DEFINER-Weg und ist Gegenstand von 18_ap13_tasks.sql; dieser Smoke
-- macht dazu keine Aussage.
--
-- Kein Aufraeumen am Dateiende - gleiche Begruendung wie in 20_ap14b_data.sql
-- und 21_ap14b_masterdata_inventory.sql: beide Startskripte entfernen die
-- temporaere Testdatenbank danach immer. Alle Kennungen tragen den Praefix
-- 22b00000-, der in keiner anderen Testdatei vorkommt (20_ap14b_data.sql
-- benutzt 20b00000-, 21_ap14b_masterdata_inventory.sql 21b00000-); Namen tragen
-- den Praefix "B22", E-Mail-Adressen enden auf @beispiel.invalid. Deshalb laeuft
-- die Datei in einer frischen Kette wiederholbar, ohne fremde Fixtures zu
-- beruehren.
--
-- Meldungskennungen: B fuer die fachlichen Faelle (B1-B14), G fuer die
-- Rechte- und Negativfaelle (G1-G12). Beide Buchstaben sind in der Kette frei
-- (20 nutzt D/R, 21 nutzt M/N).
-- =====================================================================

reset role;
select set_config('app.user_id', '', false);

-- ---------------------------------------------------------------------
-- Fixtures im Eigentuemerkontext (RLS gilt fuer den Eigentuemer nicht; das ist
-- genau der Grund, weshalb ALLE Pruefungen weiter unten unter
-- `set role app_user` laufen).
--
-- Vier Identitaeten: Admin, Disposition, zugewiesener Monteur, fremder
-- Monteur. Jedes Profil braucht ein Auth-Konto, weil 0012 den Fremdschluessel
-- public.profiles.id auf public.auth_accounts umgehaengt hat.
-- ---------------------------------------------------------------------
-- Das Admin-Konto ...0001 traegt bewusst den Platzhalter
-- '!MIGRATED-ACCOUNT-REQUIRES-RESET!' statt eines Argon2id-artigen Werts.
-- Grund (uebernommen aus 20_ap14b_data.sql:57-71): der Runner startet die
-- Node-Integrationstests in DERSELBEN Datenbank NACH dieser Datei.
-- usableAdminCount() in app/test/integration/ap14b-platform.int.mjs und das
-- Bootstrap-Gate in app/scripts/bootstrap-admin.mjs zaehlen jedes aktive
-- Admin-Profil, dessen password_hash auf '$argon2id$' passt. Ein solcher Wert
-- liesse die Bootstrap-Faelle scheitern, weil sie eine Datenbank ohne
-- anmeldefaehigen Administrator voraussetzen. Der Platzhalter ist projektweit
-- etabliert (0012 fuehrt ihn selbst ein, 19_ap14b_platform.sql toleriert ihn).
-- Dieser Smoke braucht den Hash nicht: die Identitaet wird ueber
-- set_config('app.user_id', ...) gesetzt; von auth_accounts wird nur der
-- Fremdschluessel auf die id gebraucht.
-- Diesen Wert NICHT auf einen '$argon2id$'-Wert zurueckdrehen.
insert into public.auth_accounts (id, email, password_hash, must_change_password)
values
  ('22b00000-0000-0000-0000-000000000001', 'b22.admin@beispiel.invalid', '!MIGRATED-ACCOUNT-REQUIRES-RESET!', false),
  ('22b00000-0000-0000-0000-000000000002', 'b22.dispo@beispiel.invalid', '$argon2id$synthetisch', false),
  ('22b00000-0000-0000-0000-000000000003', 'b22.monteur@beispiel.invalid', '$argon2id$synthetisch', false),
  ('22b00000-0000-0000-0000-000000000004', 'b22.fremd@beispiel.invalid', '$argon2id$synthetisch', false)
on conflict (id) do nothing;

insert into public.profiles (id, full_name, role, is_active)
values
  ('22b00000-0000-0000-0000-000000000001', 'B22 Admin', 'admin', true),
  ('22b00000-0000-0000-0000-000000000002', 'B22 Disposition', 'disponent', true),
  ('22b00000-0000-0000-0000-000000000003', 'B22 Monteur zugewiesen', 'monteur', true),
  ('22b00000-0000-0000-0000-000000000004', 'B22 Monteur fremd', 'monteur', true)
on conflict (id) do nothing;

insert into public.construction_stages (id, code, name)
values ('22b00000-0000-0000-0000-0000000000a1', 'B22', 'B22 Bauabschnitt');

insert into public.vzg_lines (id, line_number, construction_stage_id)
values ('22b00000-0000-0000-0000-0000000000a2', '2221', '22b00000-0000-0000-0000-0000000000a1');

-- Zwei Vorgaenge. Beide tragen eine aufgeloeste VzG-Zuordnung (vzg_line_id
-- gesetzt), damit die abgeleitete Aufgabe historic_vzg nicht entsteht.
--   ...b1 ist dem Monteur ...0003 zugewiesen und traegt alle Bildzeilen.
--   ...b2 hat KEINE Zuweisung und ist damit fuer BEIDE Monteure fremd; er
--         dient der zweiten Gegenprobe in B4.
insert into public.incidents
  (id, construction_stage_id, vzg_line_number, vzg_line_id, km_from, status, description)
values
  ('22b00000-0000-0000-0000-0000000000b1', '22b00000-0000-0000-0000-0000000000a1',
   '2221', '22b00000-0000-0000-0000-0000000000a2', 22.100, 'monteur_zugewiesen',
   'AP14B Bilddokumentation - zugewiesener Vorgang'),
  ('22b00000-0000-0000-0000-0000000000b2', '22b00000-0000-0000-0000-0000000000a1',
   '2221', '22b00000-0000-0000-0000-0000000000a2', 22.200, 'neu',
   'AP14B Bilddokumentation - Vorgang ohne Zuweisung');

insert into public.incident_assignments (incident_id, monteur_id)
values ('22b00000-0000-0000-0000-0000000000b1', '22b00000-0000-0000-0000-000000000003');

-- =====================================================================
-- Ab hier ausschliesslich unter der Anwendungsrolle app_user.
--
-- Grundlage der Zeilensichtbarkeit und der Schreibrechte
-- (0001_init.sql:566-575, von 0012 generisch auf app.current_user_id()
-- umgeschrieben):
--   * images_select using `is_staff() or is_assigned_to_incident(incident_id)`
--   * images_insert with check `is_staff() or is_assigned_to_incident(incident_id)`
--   * images_update using/with check `is_staff() or uploaded_by = app.current_user_id()`
--     Das ist eine reine ZEILENSCHRANKE: die Policy nennt keine einzige Spalte.
--     WELCHE SPALTE geaendert werden darf, entscheidet allein das Spaltenrecht
--     aus 0016 (category, description, deleted_at, deleted_by). Beide Schranken
--     wirken unabhaengig voneinander; die Faelle G6-G11 trennen sie
--     ausdruecklich, indem sie eine Identitaet und eine Zeile waehlen, fuer die
--     die Policy ERFUELLT ist.
--   * images_delete using `is_admin()` - von keinem Anwendungspfad benutzt und
--     nach 0016 ohne Tabellenrecht (Fall G2).
--
-- Kennungen der Bildzeilen:
--   ...c1 Admin (B1), ...c2 Disposition (B2), ...c3 zugewiesener Monteur
--   (B3, danach Lebenszyklus B5-B8). ...c4/...c5/...c6 sind die Kennungen der
--   ABGEWIESENEN Versuche aus B4 und B10; B14 belegt, dass sie keinen
--   Auditsatz hinterlassen haben.
-- =====================================================================
set role app_user;

-- B1: Der Administrator legt einen Bildmetadatensatz an, OHNE `uploaded_by` zu
-- setzen - genau wie insertImageMetadata() in @/lib/image-upload-core. Danach
-- muss `uploaded_by` die transaktionsgebundene Identitaet tragen: der
-- Spaltendefault ist seit 0012 app.current_user_id(). Genau darauf verlaesst
-- sich der Anwendungscode, denn images_insert prueft `uploaded_by` NICHT.
do $$
declare
  v_admin uuid := '22b00000-0000-0000-0000-000000000001';
  v_incident uuid := '22b00000-0000-0000-0000-0000000000b1';
  v_image uuid := '22b00000-0000-0000-0000-0000000000c1';
  v_uploaded_by uuid;
  v_exif boolean;
  v_uploaded_at timestamptz;
begin
  perform set_config('app.user_id', v_admin::text, true);

  insert into public.incident_images
    (id, incident_id, file_name, mime_type, file_size, storage_path, category, description)
  values
    (v_image, v_incident, 'b22-uebersicht.jpg', 'image/jpeg', 12345,
     'synthetisch/22b00000/c1-kein-objekt.jpg', 'uebersicht', 'B22 Uebersicht Admin');

  select uploaded_by, exif_present, uploaded_at
    into v_uploaded_by, v_exif, v_uploaded_at
  from public.incident_images where id = v_image;

  if v_uploaded_by is distinct from v_admin then
    raise exception 'SMOKE B1 FAIL uploaded_by=% statt %',
      coalesce(v_uploaded_by::text, 'NULL'), v_admin;
  end if;
  -- Gegenprobe zu den Metadaten, die dieser Smoke bewusst nicht befuellt.
  if v_exif is distinct from false or v_uploaded_at is null then
    raise exception 'SMOKE B1 FAIL exif_present=% uploaded_at=%',
      v_exif, coalesce(v_uploaded_at::text, 'NULL');
  end if;

  raise notice
    'SMOKE B1 OK Admin legt einen Bildmetadatensatz an, uploaded_by traegt die transaktionsgebundene Identitaet aus dem Spaltendefault';
end
$$;

-- B2: Die Disposition legt einen Datensatz an. Der Fall belegt, dass fuer
-- images_insert `is_staff()` genuegt und nicht `is_admin()` verlangt wird.
do $$
declare
  v_dispo uuid := '22b00000-0000-0000-0000-000000000002';
  v_incident uuid := '22b00000-0000-0000-0000-0000000000b1';
  v_image uuid := '22b00000-0000-0000-0000-0000000000c2';
  v_uploaded_by uuid;
begin
  perform set_config('app.user_id', v_dispo::text, true);

  insert into public.incident_images
    (id, incident_id, file_name, mime_type, file_size, storage_path, category, description)
  values
    (v_image, v_incident, 'b22-zugang.png', 'image/png', 23456,
     'synthetisch/22b00000/c2-kein-objekt.png', 'zugang', 'B22 Zugang Disposition');

  select uploaded_by into v_uploaded_by
  from public.incident_images where id = v_image;
  if v_uploaded_by is distinct from v_dispo then
    raise exception 'SMOKE B2 FAIL uploaded_by=% statt %',
      coalesce(v_uploaded_by::text, 'NULL'), v_dispo;
  end if;

  raise notice 'SMOKE B2 OK Disposition legt einen Bildmetadatensatz an (is_staff genuegt)';
end
$$;

-- B3: Der ZUGEWIESENE Monteur legt einen Datensatz fuer seinen Vorgang an.
-- Traegt in images_insert der Zweig `is_assigned_to_incident(incident_id)`.
-- Diese Zeile ist die Grundlage des Lebenszyklus B5-B8: sie gehoert dem
-- Monteur, deshalb greift dort der Zweig `uploaded_by = app.current_user_id()`
-- von images_update und nicht `is_staff()`.
do $$
declare
  v_monteur uuid := '22b00000-0000-0000-0000-000000000003';
  v_incident uuid := '22b00000-0000-0000-0000-0000000000b1';
  v_image uuid := '22b00000-0000-0000-0000-0000000000c3';
  v_uploaded_by uuid;
  v_category public.image_category;
  v_description text;
begin
  perform set_config('app.user_id', v_monteur::text, true);

  -- description bleibt bewusst NULL, damit B6 eine echte Aenderung ist.
  insert into public.incident_images
    (id, incident_id, file_name, mime_type, file_size, storage_path, category)
  values
    (v_image, v_incident, 'b22-schadstelle.jpg', 'image/jpeg', 34567,
     'synthetisch/22b00000/c3-kein-objekt.jpg', 'uebersicht');

  select uploaded_by, category, description
    into v_uploaded_by, v_category, v_description
  from public.incident_images where id = v_image;

  if v_uploaded_by is distinct from v_monteur
     or v_category is distinct from 'uebersicht'
     or v_description is not null then
    raise exception 'SMOKE B3 FAIL uploaded_by=% category=% description=%',
      coalesce(v_uploaded_by::text, 'NULL'), v_category,
      coalesce(v_description, 'NULL');
  end if;

  raise notice
    'SMOKE B3 OK zugewiesener Monteur legt einen Bildmetadatensatz fuer seinen Vorgang an';
end
$$;

-- B4: NEGATIV fremder Monteur - der Insert wird abgewiesen.
--
-- Der fremde Monteur ...0004 ist kein Staff und keinem der beiden Vorgaenge
-- zugewiesen; images_insert ist damit fuer beide unerfuellt. Erwartet wird
-- jeweils SQLSTATE 42501 (insufficient_privilege) aus der Policy - NICHT aus
-- dem Tabellenrecht: das insert-Recht besitzt app_user nach 0016 fuer ALLE
-- Identitaeten, denn es ist dieselbe Datenbankrolle. Danach darf keine der
-- beiden Kennungen vorhanden sein.
do $$
declare
  v_fremd uuid := '22b00000-0000-0000-0000-000000000004';
  v_incident_assigned uuid := '22b00000-0000-0000-0000-0000000000b1';
  v_incident_open uuid := '22b00000-0000-0000-0000-0000000000b2';
  v_attempt_a uuid := '22b00000-0000-0000-0000-0000000000c4';
  v_attempt_b uuid := '22b00000-0000-0000-0000-0000000000c5';
  v_wrong text[] := array[]::text[];
  v_rows integer;
begin
  perform set_config('app.user_id', v_fremd::text, true);

  begin
    insert into public.incident_images
      (id, incident_id, file_name, mime_type, file_size, storage_path, category)
    values
      (v_attempt_a, v_incident_assigned, 'b22-fremdversuch-b1.jpg', 'image/jpeg', 4567,
       'synthetisch/22b00000/c4-kein-objekt.jpg', 'sonstige_dokumentation');
    v_wrong := array_append(v_wrong, 'zugewiesener Vorgang');
  exception
    -- insufficient_privilege ist genau SQLSTATE 42501.
    when insufficient_privilege then null;
  end;

  begin
    insert into public.incident_images
      (id, incident_id, file_name, mime_type, file_size, storage_path, category)
    values
      (v_attempt_b, v_incident_open, 'b22-fremdversuch-b2.jpg', 'image/jpeg', 5678,
       'synthetisch/22b00000/c5-kein-objekt.jpg', 'sonstige_dokumentation');
    v_wrong := array_append(v_wrong, 'Vorgang ohne Zuweisung');
  exception
    when insufficient_privilege then null;
  end;

  if array_length(v_wrong, 1) is not null then
    raise exception 'SMOKE B4 FAIL fremder Monteur darf schreiben: %',
      array_to_string(v_wrong, ' | ');
  end if;

  -- Gegenprobe mit einer STAFF-Identitaet in derselben Transaktion: unter der
  -- Identitaet des fremden Monteurs waere die Zaehlung wertlos, weil
  -- images_select ihm ohnehin keine Zeile zeigt (B9). Die Disposition sieht
  -- jede Zeile beider Vorgaenge - und es darf keine der beiden abgewiesenen
  -- Kennungen geben.
  perform set_config('app.user_id', '22b00000-0000-0000-0000-000000000002', true);
  select count(*) into v_rows
  from public.incident_images where id in (v_attempt_a, v_attempt_b);
  if v_rows <> 0 then
    raise exception 'SMOKE B4 FAIL % abgewiesene Zeile(n) trotzdem vorhanden', v_rows;
  end if;

  raise notice
    'SMOKE B4 OK beide Insertversuche des fremden Monteurs enden mit 42501 (images_insert)';
end
$$;

-- B5: Kategorie aendern - genau UPDATE_IMAGE_CATEGORY_SQL aus
-- @/lib/image-actions, einschliesslich `and deleted_at is null`. Ausgewertet
-- wird die Zahl der betroffenen Zeilen: exakt eine. Genau diese Auswertung
-- unterscheidet in der Anwendung den echten Erfolg vom stillen Nichtstun.
do $$
declare
  v_monteur uuid := '22b00000-0000-0000-0000-000000000003';
  v_image uuid := '22b00000-0000-0000-0000-0000000000c3';
  v_rows integer;
  v_category public.image_category;
begin
  perform set_config('app.user_id', v_monteur::text, true);

  update public.incident_images
     set category = 'schadstelle'::public.image_category
   where id = v_image and deleted_at is null;
  get diagnostics v_rows = row_count;

  select category into v_category from public.incident_images where id = v_image;

  if v_rows <> 1 then
    raise exception 'SMOKE B5 FAIL % betroffene Zeile(n) statt genau einer', v_rows;
  end if;
  if v_category is distinct from 'schadstelle' then
    raise exception 'SMOKE B5 FAIL category=% statt schadstelle', v_category;
  end if;

  raise notice 'SMOKE B5 OK Kategoriewechsel betrifft genau eine Zeile und wirkt';
end
$$;

-- B6: Beschreibung aendern - genau UPDATE_IMAGE_DESCRIPTION_SQL aus
-- @/lib/image-actions. Der Ausgangswert ist NULL (B3), die Aenderung ist damit
-- eine echte (`is distinct from`) und loest den Chronikeintrag in B12 (Chronik) aus.
do $$
declare
  v_monteur uuid := '22b00000-0000-0000-0000-000000000003';
  v_image uuid := '22b00000-0000-0000-0000-0000000000c3';
  v_rows integer;
  v_description text;
begin
  perform set_config('app.user_id', v_monteur::text, true);

  update public.incident_images
     set description = 'B22 Beschreibung durch den Monteur'
   where id = v_image and deleted_at is null;
  get diagnostics v_rows = row_count;

  select description into v_description from public.incident_images where id = v_image;

  if v_rows <> 1 then
    raise exception 'SMOKE B6 FAIL % betroffene Zeile(n) statt genau einer', v_rows;
  end if;
  if v_description is distinct from 'B22 Beschreibung durch den Monteur' then
    raise exception 'SMOKE B6 FAIL description=%', coalesce(v_description, 'NULL');
  end if;

  raise notice 'SMOKE B6 OK Beschreibungswechsel betrifft genau eine Zeile und wirkt';
end
$$;

-- B7: SOFT-DELETE - genau SOFT_DELETE_IMAGE_SQL aus @/lib/image-actions:
-- `deleted_at = now()` (DATENBANKZEIT) und `deleted_by = $2`. `deleted_by` hat
-- KEINEN Spaltendefault (0005_ap4_images.sql:30) und wird deshalb - anders als
-- `uploaded_by` in B1 - ausdruecklich mitgegeben.
--
-- Entscheidend ist die Gegenprobe: die Zeile bleibt PHYSISCH vorhanden. Gezaehlt
-- wird deshalb OHNE `deleted_at`-Filter.
do $$
declare
  v_monteur uuid := '22b00000-0000-0000-0000-000000000003';
  v_image uuid := '22b00000-0000-0000-0000-0000000000c3';
  v_rows integer;
  v_deleted_at timestamptz;
  v_deleted_by uuid;
  v_physical integer;
begin
  perform set_config('app.user_id', v_monteur::text, true);

  update public.incident_images
     set deleted_at = now(), deleted_by = v_monteur
   where id = v_image and deleted_at is null;
  get diagnostics v_rows = row_count;
  if v_rows <> 1 then
    raise exception 'SMOKE B7 FAIL % betroffene Zeile(n) statt genau einer', v_rows;
  end if;

  select deleted_at, deleted_by into v_deleted_at, v_deleted_by
  from public.incident_images where id = v_image;
  if v_deleted_at is null or v_deleted_by is distinct from v_monteur then
    raise exception 'SMOKE B7 FAIL deleted_at=% deleted_by=%',
      coalesce(v_deleted_at::text, 'NULL'), coalesce(v_deleted_by::text, 'NULL');
  end if;

  -- OHNE deleted_at-Filter: der Soft-Delete ist eine Markierung, keine
  -- Entfernung.
  select count(*) into v_physical from public.incident_images where id = v_image;
  if v_physical <> 1 then
    raise exception 'SMOKE B7 FAIL Zeile physisch % mal vorhanden statt genau einmal', v_physical;
  end if;

  raise notice
    'SMOKE B7 OK Soft-Delete setzt deleted_at und deleted_by, die Zeile bleibt physisch vorhanden';
end
$$;

-- B8: Nach dem Soft-Delete betrifft ein erneutes `update ... and deleted_at is
-- null` NULL Zeilen. Genau dieser Fall wird in der Anwendung jetzt als Ablehnung
-- gemeldet (CHANGE_NOT_APPLIED) statt als stiller Erfolg. Die Kategorie aus B5
-- bleibt dabei unveraendert.
do $$
declare
  v_monteur uuid := '22b00000-0000-0000-0000-000000000003';
  v_image uuid := '22b00000-0000-0000-0000-0000000000c3';
  v_rows integer;
  v_category public.image_category;
begin
  perform set_config('app.user_id', v_monteur::text, true);

  update public.incident_images
     set category = 'zustand_nach_arbeit'::public.image_category
   where id = v_image and deleted_at is null;
  get diagnostics v_rows = row_count;

  select category into v_category from public.incident_images where id = v_image;

  if v_rows <> 0 then
    raise exception
      'SMOKE B8 FAIL Aenderung an der geloeschten Zeile betrifft % Zeile(n) statt 0', v_rows;
  end if;
  if v_category is distinct from 'schadstelle' then
    raise exception 'SMOKE B8 FAIL category=% statt unveraendert schadstelle', v_category;
  end if;

  raise notice
    'SMOKE B8 OK Aenderung an einer soft-geloeschten Zeile betrifft null Zeilen (Ablehnung statt stillem Erfolg)';
end
$$;

-- B9: ZEILENSICHTBARKEIT - der fremde Monteur sieht die Bilder des fremden
-- Vorgangs NICHT, obwohl die Zeilen existieren.
--
-- Die Existenz wird in derselben Transaktion mit einer Staff-Identitaet belegt
-- (Muster aus 21_ap14b_masterdata_inventory.sql, Fall N4): drei Zeilen aus
-- B1-B3, eine davon soft-geloescht. Gezaehlt wird OHNE deleted_at-Filter, denn
-- images_select kennt keinen solchen Filter - er steht ausschliesslich in den
-- Abfragen der Anwendung.
do $$
declare
  v_dispo uuid := '22b00000-0000-0000-0000-000000000002';
  v_fremd uuid := '22b00000-0000-0000-0000-000000000004';
  v_incident uuid := '22b00000-0000-0000-0000-0000000000b1';
  v_staff integer;
  v_other integer;
begin
  perform set_config('app.user_id', v_dispo::text, true);
  select count(*) into v_staff
  from public.incident_images where incident_id = v_incident;

  perform set_config('app.user_id', v_fremd::text, true);
  select count(*) into v_other
  from public.incident_images where incident_id = v_incident;

  if v_staff <> 3 then
    raise exception 'SMOKE B9 FAIL Disposition sieht % Bildzeile(n) statt 3', v_staff;
  end if;
  if v_other <> 0 then
    raise exception 'SMOKE B9 FAIL fremder Monteur sieht % Bildzeile(n) statt 0', v_other;
  end if;

  raise notice
    'SMOKE B9 OK Disposition sieht drei Bildzeilen, der fremde Monteur keine (images_select)';
end
$$;

-- B10: OHNE IDENTITAET bleibt alles zu (fail-closed).
--
-- Ohne app.user_id liefert app.current_user_id() NULL (0012:9-26). Damit ist
-- kein Zweig der Bildpolicies erfuellbar: is_staff() ist `coalesce(..., false)`
-- - also false, nicht NULL -, und is_assigned_to_incident() vergleicht
-- monteur_id mit NULL und liefert deshalb ebenfalls false. Lesen ergibt keine
-- Zeile, der Insert wird mit 42501 abgewiesen.
do $$
declare
  v_incident uuid := '22b00000-0000-0000-0000-0000000000b1';
  v_attempt uuid := '22b00000-0000-0000-0000-0000000000c6';
  v_rows integer;
begin
  perform set_config('app.user_id', '', true);

  select count(*) into v_rows
  from public.incident_images where incident_id = v_incident;
  if v_rows <> 0 then
    raise exception 'SMOKE B10 FAIL ohne Identitaet sind % Bildzeile(n) sichtbar', v_rows;
  end if;

  begin
    insert into public.incident_images
      (id, incident_id, file_name, mime_type, file_size, storage_path, category)
    values
      (v_attempt, v_incident, 'b22-ohne-identitaet.jpg', 'image/jpeg', 6789,
       'synthetisch/22b00000/c6-kein-objekt.jpg', 'sonstige_dokumentation');
    raise exception 'SMOKE B10 FAIL ohne Identitaet wurde ein Bildmetadatensatz angelegt';
  exception
    when insufficient_privilege then null;
  end;

  raise notice
    'SMOKE B10 OK ohne Identitaet keine Zeile und kein Insert (app.current_user_id() ist NULL, alle Bildpolicies verweigern)';
end
$$;

-- B11: TAGESZAEHLUNG - die Form von TODAYS_IMAGE_COUNT_SQL
-- (@/lib/images-server): `count(*) where deleted_at is null and uploaded_at >=
-- <Grenze>`.
--
-- Zwei Abweichungen von der Anwendungsabfrage, beide bewusst:
--   * Eingeschraenkt auf die eigenen Vorgaenge. Die Anwendungsabfrage zaehlt
--     ueber die ganze Tabelle; dieser Smoke zaehlt ausschliesslich relativ, wie
--     20 und 21 es ebenfalls tun, damit fremde Fixtures das Ergebnis nicht
--     verschieben. Gemessen wird die WIRKUNG DES PRAEDIKATS, nicht die
--     Gesamtzahl.
--   * Die Grenze kommt hier aus der Datenbank (`date_trunc('day', now())`). In
--     der Anwendung wird sie bewusst im Node-Prozess berechnet und als Parameter
--     uebergeben (Zeitzonenentscheidung, siehe images-server.ts) - fuer die
--     Wirkung des Praedikats ist das gleichwertig.
--
-- Erwartet: drei Zeilen insgesamt (B1-B3), davon eine soft-geloescht (B7), also
-- zwei gezaehlte. Mit einer Grenze in der Zukunft keine.
do $$
declare
  v_dispo uuid := '22b00000-0000-0000-0000-000000000002';
  v_a uuid := '22b00000-0000-0000-0000-0000000000b1';
  v_b uuid := '22b00000-0000-0000-0000-0000000000b2';
  v_today integer;
  v_including_deleted integer;
  v_tomorrow integer;
begin
  perform set_config('app.user_id', v_dispo::text, true);

  select count(*) into v_today
  from public.incident_images
  where incident_id in (v_a, v_b)
    and deleted_at is null
    and uploaded_at >= date_trunc('day', now());

  select count(*) into v_including_deleted
  from public.incident_images
  where incident_id in (v_a, v_b)
    and uploaded_at >= date_trunc('day', now());

  select count(*) into v_tomorrow
  from public.incident_images
  where incident_id in (v_a, v_b)
    and deleted_at is null
    and uploaded_at >= date_trunc('day', now()) + interval '1 day';

  if v_today <> 2 then
    raise exception 'SMOKE B11 FAIL Tageszaehlung=% statt 2', v_today;
  end if;
  if v_including_deleted <> 3 then
    raise exception
      'SMOKE B11 FAIL ohne deleted_at-Filter=% statt 3 - der Filter waere wirkungslos',
      v_including_deleted;
  end if;
  if v_tomorrow <> 0 then
    raise exception 'SMOKE B11 FAIL Zaehlung ab morgen=% statt 0', v_tomorrow;
  end if;

  raise notice
    'SMOKE B11 OK Tageszaehlung zaehlt 2 von 3 Zeilen (soft-geloeschte ausgenommen), ab morgen keine';
end
$$;

-- ---------------------------------------------------------------------
-- B12: CHRONIK - die Bildereignisse stehen in public.incident_notes.
--
-- Geschrieben werden sie ausschliesslich vom SECURITY-DEFINER-Trigger
-- public.tg_incident_image_event() ueber trg_incident_image_event
-- (0005_ap4_images.sql:118-124); die Anwendung schreibt keine dieser Zeilen.
-- Erwartet werden fuer die Bildzeile ...c3 genau vier Eintraege: 'bild_upload'
-- (B3), 'bild_kategorie' (B5), 'bild_beschreibung' (B6) und 'bild_geloescht'
-- (B7). B8 hat keine Zeile getroffen und darf deshalb keinen fuenften Eintrag
-- erzeugt haben.
--
-- Gelesen wird mit einer Staff-Identitaet: notes_select fordert `is_staff() or
-- is_assigned_to_incident(incident_id)` (0001), und das Tabellenrecht stammt
-- aus 0014:63.
-- ---------------------------------------------------------------------
do $$
declare
  v_dispo uuid := '22b00000-0000-0000-0000-000000000002';
  v_image uuid := '22b00000-0000-0000-0000-0000000000c3';
  v_total integer;
  v_upload integer;
  v_category integer;
  v_description integer;
  v_deleted integer;
begin
  perform set_config('app.user_id', v_dispo::text, true);

  select
    count(*),
    count(*) filter (where note_type = 'bild_upload'),
    count(*) filter (where note_type = 'bild_kategorie'),
    count(*) filter (where note_type = 'bild_beschreibung'),
    count(*) filter (where note_type = 'bild_geloescht')
  into v_total, v_upload, v_category, v_description, v_deleted
  from public.incident_notes where image_id = v_image;

  if v_upload <> 1 or v_category <> 1 or v_description <> 1 or v_deleted <> 1 then
    raise exception
      'SMOKE B12 FAIL Chronik upload=% kategorie=% beschreibung=% geloescht=%, erwartet je 1',
      v_upload, v_category, v_description, v_deleted;
  end if;
  if v_total <> 4 then
    raise exception 'SMOKE B12 FAIL % Chronikeintrag/-eintraege zur Bildzeile statt 4', v_total;
  end if;

  raise notice
    'SMOKE B12 OK Chronik traegt genau vier Bildereignisse (bild_upload, bild_kategorie, bild_beschreibung, bild_geloescht)';
end
$$;

-- ---------------------------------------------------------------------
-- B14: AUDIT - Gegenprobe im EIGENTUEMERKONTEXT.
--
-- app_user darf public.audit_events NICHT lesen (Fall G4 belegt das). Die
-- Gegenprobe, dass die Auditsaetze wirklich entstehen, ist deshalb nur im
-- Eigentuemerkontext moeglich - genau deshalb steht hier `reset role`.
-- Geschrieben werden sie ausschliesslich vom SECURITY-DEFINER-Trigger
-- public.tg_audit() ueber trg_audit_images (0001_init.sql:464-466); der actor
-- stammt aus app.current_user_id() zum Zeitpunkt der Anweisung.
--
-- Erwartet fuer ...c3: ein INSERT (B3) und drei UPDATE (B5, B6, B7). Fuer
-- ...c1 und ...c2 je ein INSERT mit dem jeweiligen actor. Fuer die abgewiesenen
-- Versuche ...c4, ...c5 und ...c6 KEIN Satz - eine von RLS abgewiesene
-- Anweisung erreicht den AFTER-Trigger nie.
-- ---------------------------------------------------------------------
reset role;

do $$
declare
  v_admin uuid := '22b00000-0000-0000-0000-000000000001';
  v_dispo uuid := '22b00000-0000-0000-0000-000000000002';
  v_monteur uuid := '22b00000-0000-0000-0000-000000000003';
  v_c1 uuid := '22b00000-0000-0000-0000-0000000000c1';
  v_c2 uuid := '22b00000-0000-0000-0000-0000000000c2';
  v_c3 uuid := '22b00000-0000-0000-0000-0000000000c3';
  v_c3_insert integer;
  v_c3_update integer;
  v_actor_c1 uuid;
  v_actor_c2 uuid;
  v_actor_c3 uuid;
  v_rejected integer;
begin
  select
    count(*) filter (where action = 'INSERT'),
    count(*) filter (where action = 'UPDATE')
  into v_c3_insert, v_c3_update
  from public.audit_events
  where entity = 'incident_images' and entity_id = v_c3;

  if v_c3_insert <> 1 or v_c3_update <> 3 then
    raise exception
      'SMOKE B14 FAIL Audit der Bildzeile: % INSERT und % UPDATE, erwartet 1 und 3',
      v_c3_insert, v_c3_update;
  end if;

  select actor into v_actor_c1
  from public.audit_events
  where entity = 'incident_images' and action = 'INSERT' and entity_id = v_c1;
  select actor into v_actor_c2
  from public.audit_events
  where entity = 'incident_images' and action = 'INSERT' and entity_id = v_c2;
  select actor into v_actor_c3
  from public.audit_events
  where entity = 'incident_images' and action = 'INSERT' and entity_id = v_c3;

  if v_actor_c1 is distinct from v_admin
     or v_actor_c2 is distinct from v_dispo
     or v_actor_c3 is distinct from v_monteur then
    raise exception 'SMOKE B14 FAIL actor c1=% c2=% c3=%',
      coalesce(v_actor_c1::text, 'NULL'), coalesce(v_actor_c2::text, 'NULL'),
      coalesce(v_actor_c3::text, 'NULL');
  end if;

  select count(*) into v_rejected
  from public.audit_events
  where entity = 'incident_images'
    and entity_id in ('22b00000-0000-0000-0000-0000000000c4',
                      '22b00000-0000-0000-0000-0000000000c5',
                      '22b00000-0000-0000-0000-0000000000c6');
  if v_rejected <> 0 then
    raise exception
      'SMOKE B14 FAIL abgewiesene Versuche hinterlassen % Auditsatz/-saetze', v_rejected;
  end if;

  raise notice
    'SMOKE B14 OK Audit traegt 1 INSERT und 3 UPDATE zur Bildzeile, actor entspricht der handelnden Identitaet, abgewiesene Versuche ohne Auditsatz';
end
$$;

-- ---------------------------------------------------------------------
-- B13 sowie die Rechtefaelle G1-G12 wieder unter der Anwendungsrolle.
-- ---------------------------------------------------------------------
set role app_user;

-- B13: DEDUP-MARKER des Bild-Uploads (@/lib/image-upload-core,
-- insertDedupMarker).
--
-- Zwei Zusagen in einem Fall:
--   * `actor` wird NICHT gesetzt und traegt danach die transaktionsgebundene
--     Identitaet aus dem Spaltendefault app.current_user_id() (0006:11, von
--     0012 umgeschrieben). Die Identitaet ist nie eine Angabe des Aufrufers -
--     und sie muss stimmen, weil sync_actions_insert genau `actor =
--     app.current_user_id()` fordert.
--   * Dasselbe Paar (actor, client_action_id) ein zweites Mal verletzt
--     sync_actions_actor_client_uniq (0006:20-23) mit SQLSTATE 23505. Genau
--     diese Verletzung wertet die Anwendung unmittelbar an der Anweisung aus und
--     uebersetzt sie in "bereits angewendet".
--
-- Der actor wird VOR dem Doppelversuch gelesen: die Unique-Verletzung bricht die
-- Subtransaktion ab.
do $$
declare
  v_monteur uuid := '22b00000-0000-0000-0000-000000000003';
  v_incident uuid := '22b00000-0000-0000-0000-0000000000b1';
  v_action uuid := '22b00000-0000-0000-0000-0000000000e1';
  v_actor uuid;
  v_state text := null;
  v_reached boolean := false;
  v_rows integer;
begin
  perform set_config('app.user_id', v_monteur::text, true);

  insert into public.sync_actions (client_action_id, kind, incident_id)
  values (v_action, 'image', v_incident);

  select actor into v_actor
  from public.sync_actions where client_action_id = v_action;
  if v_actor is distinct from v_monteur then
    raise exception 'SMOKE B13 FAIL actor=% statt %', coalesce(v_actor::text, 'NULL'), v_monteur;
  end if;

  begin
    insert into public.sync_actions (client_action_id, kind, incident_id)
    values (v_action, 'image', v_incident);
    v_reached := true;
  exception
    -- unique_violation ist genau SQLSTATE 23505.
    when unique_violation then
      v_state := sqlstate;
  end;

  if v_reached then
    raise exception 'SMOKE B13 FAIL derselbe Dedup-Marker wurde ein zweites Mal angenommen';
  end if;
  if v_state is distinct from '23505' then
    raise exception 'SMOKE B13 FAIL erwarteter SQLSTATE 23505, erhalten %',
      coalesce(v_state, 'NULL');
  end if;

  select count(*) into v_rows
  from public.sync_actions where client_action_id = v_action and actor = v_monteur;
  if v_rows <> 1 then
    raise exception 'SMOKE B13 FAIL % Markerzeile(n) statt genau einer', v_rows;
  end if;

  raise notice
    'SMOKE B13 OK Dedup-Marker traegt den actor aus dem Spaltendefault, der zweite Versuch scheitert mit 23505';
end
$$;

-- G1: RECHTEMATRIX POSITIV - der Bildpfad besitzt select (0014:40) und insert
-- (0016) TABELLENWEIT sowie update (0016) auf den vier Spalten category,
-- description, deleted_at und deleted_by.
--
-- Zwei Funktionen, zwei verschiedene Fragen:
--   * has_table_privilege fragt ausschliesslich nach dem TABELLENRECHT. Bei
--     einem rein spaltenbezogen erteilten update liefert es false - `update`
--     gehoert deshalb nicht mehr in diese Schleife, sondern in die
--     Spaltenschleife darunter (und, als Negativnachweis, in G11).
--   * has_column_privilege fragt je SPALTE. Es liefert auch dann true, wenn das
--     Recht tabellenweit vorliegt; dieser Fall belegt also die
--     VOLLSTAENDIGKEIT der vier Spalten, nicht ihre Begrenzung. Die Begrenzung
--     belegen G6-G11.
-- Beide Funktionen beruecksichtigen die Gruppenmitgliedschaft, decken also auch
-- ein mittelbar ueber authenticated geerbtes Recht auf.
do $$
declare
  privilege text;
  v_column text;
  missing text[] := array[]::text[];
begin
  foreach privilege in array array['select', 'insert']
  loop
    if not has_table_privilege('app_user', 'public.incident_images', privilege) then
      missing := array_append(missing, 'Tabellenrecht ' || privilege);
    end if;
  end loop;

  foreach v_column in array array[
    'category', 'description', 'deleted_at', 'deleted_by'
  ]
  loop
    if not has_column_privilege('app_user', 'public.incident_images', v_column, 'update') then
      missing := array_append(missing, 'update auf Spalte ' || v_column);
    end if;
  end loop;

  if array_length(missing, 1) is not null then
    raise exception 'SMOKE G1 FAIL app_user fehlt/fehlen auf incident_images: %',
      array_to_string(missing, ', ');
  end if;

  raise notice
    'SMOKE G1 OK app_user besitzt select und insert tabellenweit sowie update auf den Spalten category, description, deleted_at und deleted_by';
end
$$;

-- G2: RECHTEMATRIX NEGATIV - kein delete auf public.incident_images.
--
-- Zwei Schranken, die auseinandergehalten werden muessen:
--   * Das fehlende Tabellenrecht ist die TRAGENDE Schranke. Geprueft wird es
--     doppelt: ueber has_table_privilege und ueber einen echten Loeschversuch
--     mit ADMIN-Identitaet, also der Identitaet, fuer die images_delete
--     (is_admin()) erfuellt waere.
--   * Die Policy images_delete besteht unveraendert weiter - dieser Smoke
--     belegt ihre Existenz ausdruecklich, damit niemand sie fuer die Schranke
--     haelt. Geloescht wird trotzdem nichts, und die Zeile ist danach noch da.
do $$
declare
  v_admin uuid := '22b00000-0000-0000-0000-000000000001';
  v_image uuid := '22b00000-0000-0000-0000-0000000000c1';
  v_policies integer;
begin
  perform set_config('app.user_id', v_admin::text, true);

  if has_table_privilege('app_user', 'public.incident_images', 'delete') then
    raise exception 'SMOKE G2 FAIL app_user besitzt delete auf incident_images';
  end if;

  begin
    delete from public.incident_images where id = v_image;
    raise exception 'SMOKE G2 FAIL physisches Loeschen einer Bildzeile wurde zugelassen';
  exception
    when insufficient_privilege then null;
  end;

  select count(*) into v_policies
  from pg_policies
  where schemaname = 'public' and tablename = 'incident_images'
    and policyname = 'images_delete' and cmd = 'DELETE';
  if v_policies <> 1 then
    raise exception
      'SMOKE G2 FAIL erwartet genau eine Policy images_delete auf incident_images, gefunden %',
      v_policies;
  end if;

  if not exists (select 1 from public.incident_images where id = v_image) then
    raise exception 'SMOKE G2 FAIL die Bildzeile ist nach dem Versuch nicht mehr vorhanden';
  end if;

  raise notice
    'SMOKE G2 OK kein delete-Recht, der Loeschversuch endet mit 42501, die Policy images_delete besteht unveraendert weiter';
end
$$;

-- G3: RECHTEMATRIX NEGATIV - kein delete auf public.sync_actions.
--
-- Bestaetigung, dass 0016 daran nichts geaendert hat, und Gegenprobe zu
-- 20_ap14b_data.sql:699 (Fall D14): der Bild-Upload setzt den Marker in
-- derselben Transaktion wie den Metadatensatz und kompensiert nicht.
do $$
declare
  v_monteur uuid := '22b00000-0000-0000-0000-000000000003';
  v_action uuid := '22b00000-0000-0000-0000-0000000000e1';
begin
  perform set_config('app.user_id', v_monteur::text, true);

  if has_table_privilege('app_user', 'public.sync_actions', 'delete') then
    raise exception 'SMOKE G3 FAIL app_user besitzt delete auf sync_actions';
  end if;
  if has_table_privilege('app_user', 'public.sync_actions', 'update') then
    raise exception 'SMOKE G3 FAIL app_user besitzt update auf sync_actions';
  end if;

  begin
    delete from public.sync_actions where client_action_id = v_action and actor = v_monteur;
    raise exception 'SMOKE G3 FAIL Kompensation des Dedup-Markers per DELETE wurde zugelassen';
  exception
    when insufficient_privilege then null;
  end;

  raise notice
    'SMOKE G3 OK app_user besitzt weiterhin kein delete und kein update auf sync_actions';
end
$$;

-- G4: RECHTEMATRIX NEGATIV - der Audit bleibt fuer die Anwendungsrolle
-- vollstaendig unerreichbar, auch mit Admin-Identitaet. Die Schranke ist das
-- fehlende Tabellenrecht (weder 0014 noch 0015 noch 0016 vergibt eines) und
-- nicht die Policy audit_select.
--
-- Geprueft werden die sieben klassischen Tabellenprivilegien. Das seit
-- PostgreSQL 17 zusaetzliche MAINTAIN wird bewusst NICHT geprueft: es erlaubt
-- ausschliesslich Wartungsbefehle und keinen Datenzugriff.
do $$
declare
  v_admin uuid := '22b00000-0000-0000-0000-000000000001';
  privilege text;
  unexpected text[] := array[]::text[];
  v_rows integer;
begin
  perform set_config('app.user_id', v_admin::text, true);

  foreach privilege in array array[
    'select', 'insert', 'update', 'delete', 'truncate', 'references', 'trigger'
  ]
  loop
    if has_table_privilege('app_user', 'public.audit_events', privilege) then
      unexpected := array_append(unexpected, privilege);
    end if;
  end loop;

  if array_length(unexpected, 1) is not null then
    raise exception 'SMOKE G4 FAIL app_user besitzt auf audit_events: %',
      array_to_string(unexpected, ', ');
  end if;

  begin
    select count(*) into v_rows from public.audit_events;
    raise exception 'SMOKE G4 FAIL app_user liest audit_events (% Zeile(n))', v_rows;
  exception
    when insufficient_privilege then null;
  end;

  raise notice
    'SMOKE G4 OK app_user besitzt kein Recht auf audit_events und kann sie auch als Admin-Identitaet nicht lesen';
end
$$;

-- G5: app_user bleibt eine nicht privilegierte Rolle. Ohne diese Gegenprobe
-- waeren alle Faelle oben wertlos - mit SUPERUSER oder BYPASSRLS gilt keine
-- Policy. Muster aus 21_ap14b_masterdata_inventory.sql, Fall N15.
do $$
declare
  v_flags record;
begin
  select rolsuper, rolbypassrls
  into v_flags
  from pg_roles where rolname = 'app_user';

  if not found then
    raise exception 'SMOKE G5 FAIL Rolle app_user fehlt';
  end if;
  if v_flags.rolsuper or v_flags.rolbypassrls then
    raise exception 'SMOKE G5 FAIL app_user ist privilegiert (super=% bypassrls=%)',
      v_flags.rolsuper, v_flags.rolbypassrls;
  end if;

  raise notice 'SMOKE G5 OK app_user ohne SUPERUSER und ohne BYPASSRLS';
end
$$;

-- =====================================================================
-- G6-G12: DIE SPALTENSCHRANKE des update auf public.incident_images.
--
-- WARUM DIESE FAELLE ERST HIER STEHEN:
--   Sie setzen ECHTE UPDATE-Anweisungen ab, die abgewiesen werden. Eine
--   abgewiesene Anweisung erreicht weder den Chroniktrigger noch den
--   AFTER-Trigger des Audits, hinterlaesst also keine Zeile - genau das darf
--   aber erst gelten, NACHDEM B12 (Chronik: vier Eintraege zu ...c3) und B14
--   (Audit: 1 INSERT und 3 UPDATE zu ...c3) ihre festen Zahlen gemessen haben.
--   Deshalb stehen sie hinter beiden. Wer sie nach vorne zieht, macht die
--   Zaehlungen von B12 und B14 von einer Annahme abhaengig statt von einer
--   Messung.
--
-- WARUM ADMIN-IDENTITAET UND DIE BILDZEILE ...c1:
--   images_update fordert `is_staff() or uploaded_by = app.current_user_id()`.
--   Der Administrator ...0001 ist Staff UND der Uploader von ...c1 (B1); die
--   Zeile ist vorhanden (G2 hat sie nicht loeschen koennen) und nicht
--   soft-geloescht - der Soft-Delete aus B7 traf ausschliesslich ...c3. Fuer
--   diese Identitaet und diese Zeile ist die POLICY also ERFUELLT. Jede
--   Abweisung unten kann deshalb nur aus dem fehlenden SPALTENRECHT stammen und
--   aus nichts anderem. Dieselbe Trennung von Policy und Recht wie in G2.
--
-- Jeder Fall prueft doppelt: die Anweisung muss mit SQLSTATE 42501
-- (insufficient_privilege) enden, UND der Wert der Zielzeile muss danach
-- unveraendert sein. Ohne die zweite Haelfte bliebe offen, ob die Anweisung
-- vielleicht teilweise gewirkt hat.
-- =====================================================================

-- G6: NEGATIV storage_path - der Umgehungsweg, dessentwegen 0016 das update
-- ueberhaupt spaltenbezogen erteilt.
--
-- Waere storage_path aenderbar, koennte diese Identitaet den Objektschluessel
-- IHRER EIGENEN Bildzeile auf den eines FREMDEN Bildes setzen. Die Galerie
-- signiert den Wert unveraendert (@/lib/images-server:159,
-- createImageSignedUrl(r.storage_path)); das Ergebnis waere eine gueltige URL
-- auf ein Objekt, das die Zeilen-RLS dieser Identitaet nie gezeigt haette.
-- Der Zielwert ist deshalb bewusst der Pfad der fremden Bildzeile ...c3 aus B3.
--
-- REICHWEITE DIESES FALLES - ehrlich abgegrenzt: er belegt ausschliesslich den
-- UPDATE-Weg. Ueber ein INSERT ist storage_path weiterhin frei setzbar, denn
-- das insert-Recht gilt tabellenweit (Fall G12) - es muss tabellenweit gelten,
-- weil der Uploadpfad diese Spalte schreibt. Dort ist die Schranke keine
-- Datenbankschranke, sondern die Anwendung selbst (buildStoragePath(),
-- ausfuehrlich begruendet im Kopf von 0016_ap14b_image_grants.sql).
do $$
declare
  v_admin uuid := '22b00000-0000-0000-0000-000000000001';
  v_image uuid := '22b00000-0000-0000-0000-0000000000c1';
  v_before text;
  v_after text;
begin
  perform set_config('app.user_id', v_admin::text, true);

  select storage_path into v_before
  from public.incident_images where id = v_image and deleted_at is null;
  if v_before is null then
    raise exception
      'SMOKE G6 FAIL Zielzeile ...c1 fehlt, ist soft-geloescht oder nicht sichtbar - der Fall waere nicht aussagekraeftig';
  end if;

  begin
    update public.incident_images
       set storage_path = 'synthetisch/22b00000/c3-kein-objekt.jpg'
     where id = v_image and deleted_at is null;
    raise exception 'SMOKE G6 FAIL storage_path wurde geaendert';
  exception
    -- insufficient_privilege ist genau SQLSTATE 42501.
    when insufficient_privilege then null;
  end;

  select storage_path into v_after from public.incident_images where id = v_image;
  if v_after is distinct from v_before then
    raise exception 'SMOKE G6 FAIL storage_path=% statt unveraendert %',
      coalesce(v_after, 'NULL'), v_before;
  end if;

  raise notice
    'SMOKE G6 OK storage_path ist fuer app_user nicht aenderbar (42501 trotz erfuellter Policy), der Wert bleibt unveraendert';
end
$$;

-- G7: NEGATIV uploaded_by - die Urheberschaft einer Bildzeile ist nicht
-- faelschbar. Sie entsteht ausschliesslich aus dem Spaltendefault
-- app.current_user_id() beim Insert (B1) und bleibt danach fest.
do $$
declare
  v_admin uuid := '22b00000-0000-0000-0000-000000000001';
  v_fremd uuid := '22b00000-0000-0000-0000-000000000004';
  v_image uuid := '22b00000-0000-0000-0000-0000000000c1';
  v_before uuid;
  v_after uuid;
begin
  perform set_config('app.user_id', v_admin::text, true);

  select uploaded_by into v_before
  from public.incident_images where id = v_image and deleted_at is null;
  if v_before is distinct from v_admin then
    raise exception 'SMOKE G7 FAIL Ausgangswert uploaded_by=% statt %',
      coalesce(v_before::text, 'NULL'), v_admin;
  end if;

  begin
    update public.incident_images
       set uploaded_by = v_fremd
     where id = v_image and deleted_at is null;
    raise exception 'SMOKE G7 FAIL uploaded_by wurde geaendert';
  exception
    when insufficient_privilege then null;
  end;

  select uploaded_by into v_after from public.incident_images where id = v_image;
  if v_after is distinct from v_before then
    raise exception 'SMOKE G7 FAIL uploaded_by=% statt unveraendert %',
      coalesce(v_after::text, 'NULL'), v_before;
  end if;

  raise notice
    'SMOKE G7 OK uploaded_by ist fuer app_user nicht aenderbar, die Urheberschaft bleibt unveraendert';
end
$$;

-- G8: NEGATIV incident_id - eine Bildzeile laesst sich nicht an einen anderen
-- Vorgang umhaengen. Waere sie es, koennte ein Bild in einen Vorgang wandern,
-- den images_select einer ganz anderen Personengruppe zeigt.
-- Der Zielwert ...b2 ist der Vorgang OHNE Zuweisung aus den Fixtures.
do $$
declare
  v_admin uuid := '22b00000-0000-0000-0000-000000000001';
  v_image uuid := '22b00000-0000-0000-0000-0000000000c1';
  v_target_incident uuid := '22b00000-0000-0000-0000-0000000000b2';
  v_before uuid;
  v_after uuid;
begin
  perform set_config('app.user_id', v_admin::text, true);

  select incident_id into v_before
  from public.incident_images where id = v_image and deleted_at is null;
  if v_before is null then
    raise exception 'SMOKE G8 FAIL Zielzeile ...c1 fehlt oder ist nicht sichtbar';
  end if;

  begin
    update public.incident_images
       set incident_id = v_target_incident
     where id = v_image and deleted_at is null;
    raise exception 'SMOKE G8 FAIL incident_id wurde geaendert';
  exception
    when insufficient_privilege then null;
  end;

  select incident_id into v_after from public.incident_images where id = v_image;
  if v_after is distinct from v_before then
    raise exception 'SMOKE G8 FAIL incident_id=% statt unveraendert %',
      coalesce(v_after::text, 'NULL'), v_before;
  end if;

  raise notice
    'SMOKE G8 OK incident_id ist fuer app_user nicht aenderbar, die Bildzeile bleibt an ihrem Vorgang';
end
$$;

-- G9: NEGATIV GEMISCHTE ANWEISUNG - eine erlaubte und eine verbotene Spalte in
-- EINEM update.
--
-- Der Fall belegt, dass eine Teilberechtigung die Anweisung nicht teilweise
-- durchlaesst: sie wird als GANZE abgewiesen. Waere es anders, koennte der
-- verbotene Teil im Windschatten des erlaubten mitlaufen. Die Gegenprobe prueft
-- deshalb ausdruecklich AUCH die erlaubte Spalte category.
do $$
declare
  v_admin uuid := '22b00000-0000-0000-0000-000000000001';
  v_image uuid := '22b00000-0000-0000-0000-0000000000c1';
  v_category_before public.image_category;
  v_category_after public.image_category;
  v_path_before text;
  v_path_after text;
begin
  perform set_config('app.user_id', v_admin::text, true);

  select category, storage_path into v_category_before, v_path_before
  from public.incident_images where id = v_image and deleted_at is null;
  if v_path_before is null then
    raise exception 'SMOKE G9 FAIL Zielzeile ...c1 fehlt oder ist nicht sichtbar';
  end if;

  begin
    -- 'schadstelle' ist ein anderer Wert als der Ausgangswert 'uebersicht' aus
    -- B1; die erlaubte Spalte wuerde sich also wirklich aendern, wenn die
    -- Anweisung teilweise durchginge.
    update public.incident_images
       set category = 'schadstelle'::public.image_category,
           storage_path = 'synthetisch/22b00000/c2-kein-objekt.png'
     where id = v_image and deleted_at is null;
    raise exception
      'SMOKE G9 FAIL gemischte Anweisung mit einer verbotenen Spalte wurde ausgefuehrt';
  exception
    when insufficient_privilege then null;
  end;

  select category, storage_path into v_category_after, v_path_after
  from public.incident_images where id = v_image;

  if v_path_after is distinct from v_path_before then
    raise exception 'SMOKE G9 FAIL storage_path=% statt unveraendert %',
      coalesce(v_path_after, 'NULL'), v_path_before;
  end if;
  if v_category_after is distinct from v_category_before then
    raise exception
      'SMOKE G9 FAIL die erlaubte Spalte category=% statt unveraendert % - die Anweisung ist teilweise durchgelaufen',
      coalesce(v_category_after::text, 'NULL'), coalesce(v_category_before::text, 'NULL');
  end if;

  raise notice
    'SMOKE G9 OK eine gemischte Anweisung wird als Ganze abgewiesen, auch die erlaubte Spalte category bleibt unveraendert';
end
$$;

-- G10: NEGATIV gps_lat - die fuer V1 gesperrten Standortangaben sind fuer
-- app_user nicht schreibbar.
--
-- Gesetzt wird ausschliesslich NULL. Sollte die Anweisung wider Erwarten
-- durchgehen, entstuende dadurch KEIN Standortwert; der Fall schlaegt trotzdem
-- fehl. Ein echter Koordinatenwert haette in dieser Datei nichts zu suchen.
do $$
declare
  v_admin uuid := '22b00000-0000-0000-0000-000000000001';
  v_image uuid := '22b00000-0000-0000-0000-0000000000c1';
  -- gps_lat ist `double precision` (0001_init.sql:259).
  v_after double precision;
begin
  perform set_config('app.user_id', v_admin::text, true);

  begin
    update public.incident_images
       set gps_lat = null
     where id = v_image and deleted_at is null;
    raise exception 'SMOKE G10 FAIL gps_lat wurde geschrieben';
  exception
    when insufficient_privilege then null;
  end;

  -- Gegenprobe: der Ausgangswert ist NULL (die Fixtures setzen keine EXIF- und
  -- keine GPS-Angabe) und muss NULL bleiben.
  select gps_lat into v_after from public.incident_images where id = v_image;
  if v_after is not null then
    raise exception 'SMOKE G10 FAIL gps_lat traegt nach dem Versuch einen Wert';
  end if;

  raise notice
    'SMOKE G10 OK gps_lat ist fuer app_user nicht schreibbar und bleibt leer';
end
$$;

-- G11: NEGATIV VOLLNACHWEIS ueber den Katalog - KEINE weitere Spalte von
-- public.incident_images ist fuer app_user aenderbar, und es gibt kein
-- tabellenweites update.
--
-- Die Spaltenliste wird bewusst NICHT haendisch gefuehrt, sondern aus
-- pg_attribute gelesen: eine spaeter ergaenzte Spalte fiele sonst durch das
-- Raster und waere unbemerkt mitfreigegeben. `attnum > 0` blendet die
-- Systemspalten aus, `not attisdropped` die logisch geloeschten.
--
-- Das tabellenweite Recht wird zusaetzlich mit has_table_privilege geprueft:
-- has_column_privilege wuerde bei einer tabellenweiten Vergabe fuer JEDE Spalte
-- true liefern und damit zwar ebenfalls anschlagen, aber die Ursache nicht
-- benennen. Erst beide Pruefungen zusammen sind eindeutig.
--
-- Gleicher Nachweis wie in der Abschlusspruefung von 0016 - hier gegen die
-- laufende Datenbank am Ende der Kette, also nachdem alle Smokes und alle
-- Migrationen gelaufen sind.
do $$
declare
  item record;
  unexpected text[] := array[]::text[];
begin
  if has_table_privilege('app_user', 'public.incident_images', 'update') then
    raise exception
      'SMOKE G11 FAIL app_user besitzt ein TABELLENWEITES update auf incident_images - die Spaltenbegrenzung ist ausgehebelt';
  end if;

  for item in
    select a.attname::text as column_name
    from pg_attribute a
    where a.attrelid = 'public.incident_images'::regclass
      and a.attnum > 0
      and not a.attisdropped
      and a.attname::text <> all (array[
        'category', 'description', 'deleted_at', 'deleted_by'
      ])
    order by a.attnum
  loop
    if has_column_privilege('app_user', 'public.incident_images', item.column_name, 'update') then
      unexpected := array_append(unexpected, item.column_name);
    end if;
  end loop;

  if array_length(unexpected, 1) is not null then
    raise exception
      'SMOKE G11 FAIL app_user darf unerwartete Spalte(n) von incident_images aendern: %',
      array_to_string(unexpected, ', ');
  end if;

  raise notice
    'SMOKE G11 OK kein tabellenweites update und keine weitere aenderbare Spalte auf incident_images (Katalogabgleich ueber pg_attribute)';
end
$$;

-- G12: GEGENPROBE ZUM insert - die Spaltenbegrenzung des update hat das insert
-- NICHT angetastet.
--
-- insertImageMetadata() (@/lib/image-upload-core) schreibt eine vollstaendige
-- neue Zeile und ueberlaesst uploaded_by und uploaded_at dem Spaltendefault.
-- Waere insert versehentlich ebenfalls spaltenbegrenzt worden, waere der
-- Uploadweg gebrochen. Geprueft wird deshalb das Tabellenrecht UND - wieder
-- katalogbasiert - dass wirklich jede Spalte davon getragen wird.
--
-- EHRLICH DAZUGESAGT: "jede Spalte" schliesst storage_path ein. Eine Identitaet,
-- die SQL an der Anwendung vorbei als app_user absetzt, kann damit eine NEUE
-- Bildzeile mit einem FREMDEN Objektschluessel anlegen - mit derselben Wirkung
-- wie der in G6 geschlossene UPDATE-Weg. Per Rechtevergabe ist das nicht zu
-- verhindern, weil der Uploadpfad die Spalte schreiben muss. Was diesen Weg
-- tatsaechlich begrenzt, ist allein die Anwendungsschranke buildStoragePath()
-- (Kopf von 0016_ap14b_image_grants.sql); sie ist schwaecher als ein
-- Datenbankrecht, und dieser Smoke misst sie NICHT.
do $$
declare
  item record;
  missing text[] := array[]::text[];
begin
  if not has_table_privilege('app_user', 'public.incident_images', 'insert') then
    raise exception 'SMOKE G12 FAIL app_user besitzt kein insert auf incident_images';
  end if;

  for item in
    select a.attname::text as column_name
    from pg_attribute a
    where a.attrelid = 'public.incident_images'::regclass
      and a.attnum > 0
      and not a.attisdropped
    order by a.attnum
  loop
    if not has_column_privilege('app_user', 'public.incident_images', item.column_name, 'insert') then
      missing := array_append(missing, item.column_name);
    end if;
  end loop;

  if array_length(missing, 1) is not null then
    raise exception
      'SMOKE G12 FAIL app_user fehlt das insert-Recht auf Spalte(n) von incident_images: %',
      array_to_string(missing, ', ');
  end if;

  raise notice
    'SMOKE G12 OK insert auf incident_images gilt weiterhin tabellenweit und fuer jede Spalte';
end
$$;

reset role;
select set_config('app.user_id', '', false);

do $$
begin
  raise notice
    'SMOKE BG-ENDE OK AP14B-Bilddokumentation B1-B14 und Rechtematrix G1-G12 (einschliesslich der Spaltenbegrenzung des update) unter app_user mit aktiver RLS belegt';
end
$$;
