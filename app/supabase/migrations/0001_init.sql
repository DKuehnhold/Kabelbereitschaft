-- =====================================================================
-- Kabelbereitschaft – Kernschema (Migration 0001)
-- PostgreSQL / Supabase. UUID-PKs, Enums, Constraints, Indizes,
-- Trigger (Audit, Status-Chronik, Bestandsschutz), Row Level Security.
-- =====================================================================

create extension if not exists pgcrypto;

-- Vorwaertsreferenzen in SQL-Funktionen zulassen (Tabellen folgen weiter unten).
set check_function_bodies = off;

-- ---------------------------------------------------------------------
-- 1) Enums
-- ---------------------------------------------------------------------
create type public.user_role as enum ('admin', 'disponent', 'monteur');

create type public.incident_status as enum (
  'neu','monteur_zugewiesen','einsatz_angenommen','anfahrt','vor_ort',
  'zustandsaufnahme','in_bearbeitung','warten_auf_material','warten_auf_db',
  'uebergabe_erforderlich','provisorisch_instandgesetzt','technisch_abgeschlossen',
  'dokumentation_vollstaendig','durch_disposition_geprueft','abgeschlossen',
  'storniert','fehlalarm'
);

create type public.condition_rating as enum (
  'keine_beschaedigung','geringfuegig_beschaedigt','funktionsfaehig_mit_einschraenkung',
  'provisorisch_instandgesetzt','nicht_betriebsbereit','sofortiger_handlungsbedarf',
  'weitere_pruefung_erforderlich'
);

create type public.image_category as enum (
  'uebersicht','zugang','schadstelle','zustand_vor_arbeit','arbeitsausfuehrung',
  'materialeinsatz','zustand_nach_arbeit','restmangel','sonstige_dokumentation'
);

create type public.storage_location_type as enum (
  'zentrallager','fahrzeuglager','baustellenlager','materialcontainer','temporaeres_lager'
);

create type public.movement_type as enum (
  'wareneingang','entnahme_vorgang','rueckgabe','umbuchung',
  'korrektur','verlust','beschaedigung','verbrauch'
);

create type public.location_correction_status as enum (
  'vorgeschlagen','akzeptiert','abgelehnt'
);

-- ---------------------------------------------------------------------
-- 2) Hilfsfunktionen (SECURITY DEFINER, umgehen RLS zur Rollenpruefung)
-- ---------------------------------------------------------------------
create or replace function public.current_user_role()
returns public.user_role
language sql stable security definer set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public
as $$ select coalesce(public.current_user_role() = 'admin', false); $$;

create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public
as $$ select coalesce(public.current_user_role() in ('admin','disponent'), false); $$;

create or replace function public.is_assigned_to_incident(p_incident uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.incident_assignments a
    where a.incident_id = p_incident
      and a.monteur_id = auth.uid()
      and a.is_active
  );
$$;

-- ---------------------------------------------------------------------
-- 3) Generische Trigger-Funktionen
-- ---------------------------------------------------------------------
create or replace function public.tg_touch_updated()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end $$;

create or replace function public.tg_audit()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  v_id := coalesce((to_jsonb(new)->>'id')::uuid, (to_jsonb(old)->>'id')::uuid);
  insert into public.audit_events(entity, entity_id, action, actor, detail)
  values (tg_table_name, v_id, tg_op, auth.uid(), jsonb_build_object('op', tg_op));
  return coalesce(new, old);
end $$;

-- ---------------------------------------------------------------------
-- 4) Stammdaten & Profile
-- ---------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role public.user_role not null default 'monteur',
  phone text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

create table public.construction_stages (
  id uuid primary key default gen_random_uuid(),
  code text unique,
  name text not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

create table public.on_call_numbers (
  id uuid primary key default gen_random_uuid(),
  number text not null unique,
  label text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

create table public.materials (
  id uuid primary key default gen_random_uuid(),
  material_no text unique,
  name text not null,
  category text,
  manufacturer text,
  unit text not null default 'Stk',
  min_stock numeric(12,3) check (min_stock is null or min_stock >= 0),
  purchase_price numeric(12,2) check (purchase_price is null or purchase_price >= 0),
  note text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

create table public.storage_locations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  location_type public.storage_location_type not null,
  address text,
  gps_lat double precision check (gps_lat is null or gps_lat between -90 and 90),
  gps_lon double precision check (gps_lon is null or gps_lon between -180 and 180),
  responsible_person text,
  note text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

-- ---------------------------------------------------------------------
-- 5) Vorgaenge
-- ---------------------------------------------------------------------
create table public.incidents (
  id uuid primary key default gen_random_uuid(),
  incident_no bigint generated always as identity,
  status public.incident_status not null default 'neu',
  condition_rating public.condition_rating,
  -- Bereitschaftsanruf
  on_call_number_id uuid references public.on_call_numbers(id),
  call_received_at timestamptz,
  call_taken_by uuid references public.profiles(id),
  caller_name text,
  caller_contact text,
  -- Standort (bahnfachlich) – Pflicht/Kernfelder
  construction_stage_id uuid not null references public.construction_stages(id),
  vzg_line_number text not null,
  km_from numeric(7,3) not null check (km_from >= 0),
  km_to numeric(7,3) check (km_to is null or km_to >= 0),
  operating_point text,
  track text,
  direction text,
  object_type text,
  object_designation text,
  location_description text,
  external_reference text,
  -- Inhalt
  title text,
  description text,
  -- Abschluss
  closed_at timestamptz,
  closed_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  constraint incidents_km_order check (km_to is null or km_to >= km_from)
);
create index idx_incidents_status on public.incidents(status);
create index idx_incidents_stage on public.incidents(construction_stage_id);
create index idx_incidents_created_at on public.incidents(created_at);
create index idx_incidents_vzg on public.incidents(vzg_line_number);

create table public.incident_assignments (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null references public.incidents(id) on delete cascade,
  monteur_id uuid not null references public.profiles(id),
  assigned_by uuid default auth.uid() references public.profiles(id),
  assigned_at timestamptz not null default now(),
  unassigned_at timestamptz,
  is_active boolean not null default true
);
create unique index uq_assignment_active
  on public.incident_assignments(incident_id, monteur_id) where is_active;
create index idx_assignment_monteur on public.incident_assignments(monteur_id);

create table public.incident_status_history (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null references public.incidents(id) on delete cascade,
  old_status public.incident_status,
  new_status public.incident_status not null,
  note text,
  changed_by uuid default auth.uid() references auth.users(id),
  changed_at timestamptz not null default now()
);
create index idx_status_history_incident on public.incident_status_history(incident_id);

create table public.incident_notes (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null references public.incidents(id) on delete cascade,
  note_type text not null default 'allgemein',
  body text not null,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users(id)
);
create index idx_notes_incident on public.incident_notes(incident_id);

create table public.incident_images (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null references public.incidents(id) on delete cascade,
  file_name text not null,
  mime_type text not null,
  file_size bigint not null check (file_size > 0),
  storage_path text not null,
  category public.image_category not null default 'sonstige_dokumentation',
  description text,
  file_hash text,
  exif_present boolean not null default false,
  taken_at timestamptz,
  gps_lat double precision check (gps_lat is null or gps_lat between -90 and 90),
  gps_lon double precision check (gps_lon is null or gps_lon between -180 and 180),
  orientation smallint,
  camera_model text,
  uploaded_by uuid default auth.uid() references auth.users(id),
  uploaded_at timestamptz not null default now()
);
create index idx_images_incident on public.incident_images(incident_id);

create table public.incident_location_corrections (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null references public.incidents(id) on delete cascade,
  gps_lat double precision check (gps_lat is null or gps_lat between -90 and 90),
  gps_lon double precision check (gps_lon is null or gps_lon between -180 and 180),
  description text,
  status public.location_correction_status not null default 'vorgeschlagen',
  proposed_by uuid default auth.uid() references public.profiles(id),
  proposed_at timestamptz not null default now(),
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz
);
create index idx_loc_corr_incident on public.incident_location_corrections(incident_id);

-- ---------------------------------------------------------------------
-- 6) Materialbewegungen + Bestand (Bestand nur als Ableitung)
-- ---------------------------------------------------------------------
create table public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  material_id uuid not null references public.materials(id),
  quantity numeric(12,3) not null check (quantity > 0),
  unit text not null default 'Stk',
  movement_type public.movement_type not null,
  source_location_id uuid references public.storage_locations(id),
  target_location_id uuid references public.storage_locations(id),
  incident_id uuid references public.incidents(id),
  note text,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users(id),
  constraint mv_locations_present
    check (source_location_id is not null or target_location_id is not null),
  constraint mv_umbuchung
    check (movement_type <> 'umbuchung'
           or (source_location_id is not null and target_location_id is not null
               and source_location_id <> target_location_id)),
  constraint mv_entnahme
    check (movement_type <> 'entnahme_vorgang'
           or (source_location_id is not null and incident_id is not null))
);
create index idx_movements_material on public.inventory_movements(material_id);
create index idx_movements_incident on public.inventory_movements(incident_id);
create index idx_movements_source on public.inventory_movements(source_location_id);
create index idx_movements_target on public.inventory_movements(target_location_id);

-- Aktueller Bestand je Material und Lagerort (Ziel = +, Quelle = -)
create view public.material_stock as
select material_id, location_id, sum(delta) as quantity
from (
  select material_id, target_location_id as location_id, quantity as delta
    from public.inventory_movements where target_location_id is not null
  union all
  select material_id, source_location_id as location_id, -quantity as delta
    from public.inventory_movements where source_location_id is not null
) t
group by material_id, location_id;

-- Hinweis: material_stock ist eine Aggregat-View (Bestandsanzeige) und laeuft
-- bewusst mit den Rechten des Owners, damit ALLE Berechtigten den korrekten
-- Gesamtbestand sehen. Die verbindliche Regel "keine negativen Bestaende" wird
-- durch den SECURITY-DEFINER-Trigger check_inventory_nonnegative() erzwungen,
-- der stets alle Bewegungen auswertet (unabhaengig von RLS).

-- Bestandsschutz: keine negativen Bestaende bei Entnahme aus einem Lagerort
create or replace function public.check_inventory_nonnegative()
returns trigger language plpgsql security definer set search_path = public as $$
declare current_qty numeric;
begin
  if new.source_location_id is not null then
    select coalesce(sum(delta),0) into current_qty from (
      select case
               when target_location_id = new.source_location_id then quantity
               when source_location_id = new.source_location_id then -quantity
               else 0 end as delta
        from public.inventory_movements
       where material_id = new.material_id
         and (target_location_id = new.source_location_id
              or source_location_id = new.source_location_id)
    ) s;
    if current_qty - new.quantity < 0 then
      raise exception
        'Negativer Lagerbestand nicht erlaubt (Material %, Lagerort %, Bestand %, Buchung %).',
        new.material_id, new.source_location_id, current_qty, new.quantity
        using errcode = '23514';
    end if;
  end if;
  return new;
end $$;
create trigger trg_inventory_nonneg
  before insert on public.inventory_movements
  for each row execute function public.check_inventory_nonnegative();

-- ---------------------------------------------------------------------
-- 7) Audit-Ereignisse
-- ---------------------------------------------------------------------
create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  entity text not null,
  entity_id uuid,
  action text not null,
  detail jsonb,
  actor uuid default auth.uid() references auth.users(id),
  created_at timestamptz not null default now()
);
create index idx_audit_entity on public.audit_events(entity, entity_id);

-- ---------------------------------------------------------------------
-- 8) Status-Chronik + Schutz-Trigger
-- ---------------------------------------------------------------------
create or replace function public.tg_incident_status_history()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into public.incident_status_history(incident_id, old_status, new_status, changed_by)
    values (new.id, null, new.status, auth.uid());
  elsif tg_op = 'UPDATE' and new.status is distinct from old.status then
    insert into public.incident_status_history(incident_id, old_status, new_status, changed_by)
    values (new.id, old.status, new.status, auth.uid());
  end if;
  return new;
end $$;
create trigger trg_incident_status
  after insert or update on public.incidents
  for each row execute function public.tg_incident_status_history();

-- Monteure duerfen nur eingeschraenkt aendern (Feld-/Statusschutz).
-- auth.uid() IS NULL = Service-/Serverkontext (vertraut).
create or replace function public.tg_incident_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or public.is_staff() then
    return new;
  end if;
  if new.status in ('durch_disposition_geprueft','abgeschlossen','storniert') then
    raise exception 'Monteure duerfen diesen Status nicht setzen.' using errcode = '42501';
  end if;
  if (new.closed_at is distinct from old.closed_at)
     or (new.closed_by is distinct from old.closed_by) then
    raise exception 'Monteure duerfen den Vorgang nicht administrativ abschliessen.' using errcode = '42501';
  end if;
  if (new.construction_stage_id is distinct from old.construction_stage_id)
     or (new.vzg_line_number is distinct from old.vzg_line_number)
     or (new.on_call_number_id is distinct from old.on_call_number_id)
     or (new.call_received_at is distinct from old.call_received_at) then
    raise exception 'Monteure duerfen Stammfelder des Vorgangs nicht aendern.' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger trg_incident_guard
  before update on public.incidents
  for each row execute function public.tg_incident_guard();

-- Rolle/Aktivstatus nur durch Admin (oder Service-Kontext).
create or replace function public.tg_protect_profile()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or public.is_admin() then
    return new;
  end if;
  if (new.role is distinct from old.role)
     or (new.is_active is distinct from old.is_active) then
    raise exception 'Nur Administratoren duerfen Rolle oder Aktivstatus aendern.' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger trg_protect_profile
  before update on public.profiles
  for each row execute function public.tg_protect_profile();

-- ---------------------------------------------------------------------
-- 9) updated_at/by-Trigger fuer Stammtabellen
-- ---------------------------------------------------------------------
create trigger trg_touch_profiles before update on public.profiles
  for each row execute function public.tg_touch_updated();
create trigger trg_touch_stages before update on public.construction_stages
  for each row execute function public.tg_touch_updated();
create trigger trg_touch_oncall before update on public.on_call_numbers
  for each row execute function public.tg_touch_updated();
create trigger trg_touch_materials before update on public.materials
  for each row execute function public.tg_touch_updated();
create trigger trg_touch_locations before update on public.storage_locations
  for each row execute function public.tg_touch_updated();
create trigger trg_touch_incidents before update on public.incidents
  for each row execute function public.tg_touch_updated();

-- ---------------------------------------------------------------------
-- 10) Audit-Trigger fuer Kern-Bewegungsdaten
-- ---------------------------------------------------------------------
create trigger trg_audit_incidents
  after insert or update or delete on public.incidents
  for each row execute function public.tg_audit();
create trigger trg_audit_assignments
  after insert or update or delete on public.incident_assignments
  for each row execute function public.tg_audit();
create trigger trg_audit_movements
  after insert or delete on public.inventory_movements
  for each row execute function public.tg_audit();
create trigger trg_audit_images
  after insert or update or delete on public.incident_images
  for each row execute function public.tg_audit();
create trigger trg_audit_loc_corr
  after insert or update on public.incident_location_corrections
  for each row execute function public.tg_audit();

-- ---------------------------------------------------------------------
-- 11) Neuer Auth-Benutzer -> Profil anlegen
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles(id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    coalesce((new.raw_user_meta_data->>'role')::public.user_role, 'monteur')
  )
  on conflict (id) do nothing;
  return new;
end $$;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =====================================================================
-- 12) Row Level Security
-- =====================================================================
alter table public.profiles enable row level security;
alter table public.construction_stages enable row level security;
alter table public.on_call_numbers enable row level security;
alter table public.materials enable row level security;
alter table public.storage_locations enable row level security;
alter table public.incidents enable row level security;
alter table public.incident_assignments enable row level security;
alter table public.incident_status_history enable row level security;
alter table public.incident_notes enable row level security;
alter table public.incident_images enable row level security;
alter table public.incident_location_corrections enable row level security;
alter table public.inventory_movements enable row level security;
alter table public.audit_events enable row level security;

-- profiles
create policy profiles_select on public.profiles for select
  using (id = auth.uid() or public.is_staff());
create policy profiles_insert on public.profiles for insert
  with check (public.is_admin());
create policy profiles_update on public.profiles for update
  using (public.is_admin() or id = auth.uid())
  with check (public.is_admin() or id = auth.uid());
create policy profiles_delete on public.profiles for delete
  using (public.is_admin());

-- Stammdaten: alle Angemeldeten lesen, nur Admin schreiben
create policy stages_select on public.construction_stages for select
  using (auth.uid() is not null);
create policy stages_write on public.construction_stages for all
  using (public.is_admin()) with check (public.is_admin());

create policy oncall_select on public.on_call_numbers for select
  using (auth.uid() is not null);
create policy oncall_write on public.on_call_numbers for all
  using (public.is_admin()) with check (public.is_admin());

create policy materials_select on public.materials for select
  using (auth.uid() is not null);
create policy materials_write on public.materials for all
  using (public.is_admin()) with check (public.is_admin());

create policy locations_select on public.storage_locations for select
  using (auth.uid() is not null);
create policy locations_write on public.storage_locations for all
  using (public.is_admin()) with check (public.is_admin());

-- incidents
create policy incidents_select on public.incidents for select
  using (public.is_staff() or public.is_assigned_to_incident(id));
create policy incidents_insert on public.incidents for insert
  with check (public.is_staff());
create policy incidents_update on public.incidents for update
  using (public.is_staff() or public.is_assigned_to_incident(id))
  with check (public.is_staff() or public.is_assigned_to_incident(id));
create policy incidents_delete on public.incidents for delete
  using (public.is_admin());

-- assignments
create policy assignments_select on public.incident_assignments for select
  using (public.is_staff() or monteur_id = auth.uid());
create policy assignments_write on public.incident_assignments for all
  using (public.is_staff()) with check (public.is_staff());

-- status history: nur lesen (Schreiben ausschliesslich per Definer-Trigger)
create policy status_history_select on public.incident_status_history for select
  using (public.is_staff() or public.is_assigned_to_incident(incident_id));

-- notes: anhaengbar durch Berechtigte, kein Update/Delete
create policy notes_select on public.incident_notes for select
  using (public.is_staff() or public.is_assigned_to_incident(incident_id));
create policy notes_insert on public.incident_notes for insert
  with check (public.is_staff() or public.is_assigned_to_incident(incident_id));

-- images
create policy images_select on public.incident_images for select
  using (public.is_staff() or public.is_assigned_to_incident(incident_id));
create policy images_insert on public.incident_images for insert
  with check (public.is_staff() or public.is_assigned_to_incident(incident_id));
create policy images_update on public.incident_images for update
  using (public.is_staff() or uploaded_by = auth.uid())
  with check (public.is_staff() or uploaded_by = auth.uid());
create policy images_delete on public.incident_images for delete
  using (public.is_admin());

-- Standortkorrekturen
create policy loc_corr_select on public.incident_location_corrections for select
  using (public.is_staff() or public.is_assigned_to_incident(incident_id));
create policy loc_corr_insert on public.incident_location_corrections for insert
  with check (public.is_staff() or public.is_assigned_to_incident(incident_id));
create policy loc_corr_update on public.incident_location_corrections for update
  using (public.is_staff()) with check (public.is_staff());
create policy loc_corr_delete on public.incident_location_corrections for delete
  using (public.is_admin());

-- Materialbewegungen: unveraenderbares Journal (kein Update/Delete)
create policy movements_select on public.inventory_movements for select
  using (
    public.is_staff()
    or created_by = auth.uid()
    or (incident_id is not null and public.is_assigned_to_incident(incident_id))
  );
create policy movements_insert on public.inventory_movements for insert
  with check (
    public.is_staff()
    or (
      movement_type in ('entnahme_vorgang','rueckgabe')
      and incident_id is not null
      and public.is_assigned_to_incident(incident_id)
    )
  );

-- audit_events: nur Admin lesen (Schreiben nur per Definer-Trigger)
create policy audit_select on public.audit_events for select
  using (public.is_admin());
