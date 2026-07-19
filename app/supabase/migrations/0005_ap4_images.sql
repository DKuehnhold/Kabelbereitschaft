-- =====================================================================
-- Kabelbereitschaft – AP4 (Migration 0005): Bilddokumentation
-- Additiv, idempotent, ohne Datenverlust.
--   * Bildkategorien additiv erweitern (bestehende 9 bleiben unverändert).
--   * Bildmetadaten ergänzen (width, height, Soft-Delete-Felder).
--   * Bestehende Chronik (incident_notes) um Bildbezug erweitern.
--   * Trigger schreibt Bild-Ereignisse in die vorhandene Chronik
--     (keine parallele Ereignistabelle). Audit läuft weiter über trg_audit_images.
--   * Privaten Storage-Bucket serverseitig absichern (Größe + MIME), guarded.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Bildkategorien additiv erweitern (bestehende Werte unverändert)
--    Reihenfolge migrationssicher; IF NOT EXISTS = idempotent.
-- ---------------------------------------------------------------------
alter type public.image_category add value if not exists 'schaden';
alter type public.image_category add value if not exists 'detail';
alter type public.image_category add value if not exists 'reparatur';
alter type public.image_category add value if not exists 'abschluss';
alter type public.image_category add value if not exists 'material';
alter type public.image_category add value if not exists 'sonstiges';

-- ---------------------------------------------------------------------
-- 2) Bildmetadaten additiv ergänzen (Soft-Delete + Abmessungen)
-- ---------------------------------------------------------------------
alter table public.incident_images
  add column if not exists width       integer,
  add column if not exists height      integer,
  add column if not exists deleted_at  timestamptz,
  add column if not exists deleted_by  uuid references auth.users(id);

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'incident_images_width_pos') then
    alter table public.incident_images
      add constraint incident_images_width_pos check (width is null or width > 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'incident_images_height_pos') then
    alter table public.incident_images
      add constraint incident_images_height_pos check (height is null or height > 0);
  end if;
end $$;

create index if not exists idx_images_incident_active
  on public.incident_images(incident_id) where deleted_at is null;

-- ---------------------------------------------------------------------
-- 3) Chronik erweitern: Bildbezug an bestehende incident_notes anhängen
--    (Wiederverwendung der vorhandenen Chronik statt neuer Ereignistabelle)
-- ---------------------------------------------------------------------
alter table public.incident_notes
  add column if not exists image_id uuid references public.incident_images(id) on delete set null;

-- ---------------------------------------------------------------------
-- 4) Kategorielabel (DE). Nimmt text entgegen, damit die neu ergänzten
--    Enum-Werte nicht in derselben Transaktion referenziert werden müssen
--    (migrationssicher, auch bei transaktionalen Runnern).
-- ---------------------------------------------------------------------
create or replace function public.image_category_label(c text)
returns text language sql immutable as $$
  select case c
    when 'uebersicht' then 'Übersicht'
    when 'zugang' then 'Zugang'
    when 'schadstelle' then 'Schadstelle'
    when 'zustand_vor_arbeit' then 'Zustand vor Arbeit'
    when 'arbeitsausfuehrung' then 'Arbeitsausführung'
    when 'materialeinsatz' then 'Materialeinsatz'
    when 'zustand_nach_arbeit' then 'Zustand nach Arbeit'
    when 'restmangel' then 'Restmangel'
    when 'sonstige_dokumentation' then 'Sonstige Dokumentation'
    when 'schaden' then 'Schaden'
    when 'detail' then 'Detail'
    when 'reparatur' then 'Reparatur'
    when 'abschluss' then 'Abschluss'
    when 'material' then 'Material'
    when 'sonstiges' then 'Sonstiges'
    else c
  end;
$$;

-- ---------------------------------------------------------------------
-- 5) Bild-Ereignisse in die Chronik schreiben (Upload / Kategorie /
--    Beschreibung / Soft-Delete). SECURITY DEFINER, damit die Chronik
--    auch bei restriktiver notes-RLS befüllt wird. Audit bleibt separat
--    über den bestehenden Trigger trg_audit_images.
-- ---------------------------------------------------------------------
create or replace function public.tg_incident_image_event()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into public.incident_notes(incident_id, note_type, body, image_id, created_by)
    values (new.incident_id, 'bild_upload',
            'Bild hochgeladen: ' || coalesce(new.file_name, '(ohne Name)')
              || ' (Kategorie: ' || public.image_category_label(new.category::text) || ')',
            new.id, new.uploaded_by);
  elsif tg_op = 'UPDATE' then
    if new.deleted_at is not null and old.deleted_at is null then
      insert into public.incident_notes(incident_id, note_type, body, image_id, created_by)
      values (new.incident_id, 'bild_geloescht',
              'Bild als gelöscht markiert: ' || coalesce(new.file_name, '(ohne Name)'),
              new.id, coalesce(new.deleted_by, auth.uid()));
    end if;
    if new.category is distinct from old.category then
      insert into public.incident_notes(incident_id, note_type, body, image_id, created_by)
      values (new.incident_id, 'bild_kategorie',
              'Bildkategorie geändert: ' || public.image_category_label(old.category::text)
                || ' → ' || public.image_category_label(new.category::text),
              new.id, auth.uid());
    end if;
    if new.description is distinct from old.description then
      insert into public.incident_notes(incident_id, note_type, body, image_id, created_by)
      values (new.incident_id, 'bild_beschreibung',
              'Bildbeschreibung aktualisiert', new.id, auth.uid());
    end if;
  end if;
  return coalesce(new, old);
end $$;

do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_incident_image_event') then
    create trigger trg_incident_image_event
      after insert or update on public.incident_images
      for each row execute function public.tg_incident_image_event();
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 6) Privaten Bucket serverseitig absichern (Größe 15 MB, nur JPG/PNG).
--    Guarded: Spalten existieren in echtem Supabase-Storage; im lokalen
--    Test-Stub werden sie ergänzt (siehe test/00_stub_auth_storage.sql).
-- ---------------------------------------------------------------------
do $$ begin
  if exists (select 1 from information_schema.columns
             where table_schema='storage' and table_name='buckets' and column_name='file_size_limit') then
    execute $q$ update storage.buckets set file_size_limit = 15728640 where id = 'incident-images' $q$;
  end if;
  if exists (select 1 from information_schema.columns
             where table_schema='storage' and table_name='buckets' and column_name='allowed_mime_types') then
    execute $q$ update storage.buckets set allowed_mime_types = array['image/jpeg','image/png'] where id = 'incident-images' $q$;
  end if;
end $$;
