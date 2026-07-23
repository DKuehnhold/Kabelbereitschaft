-- =====================================================================
-- Kabelbereitschaft – AP10 (Migration 0008): Stammdaten in der Vorgangserfassung
-- Additiv, idempotent, ohne Datenverlust. Rückwärtskompatibel zu AP1–AP9.
--   * incidents: neue Referenzen customer_id, vzg_line_id (nullable, FK).
--   * NOT-NULL auf incidents.km_from und incidents.vzg_line_number gelöst
--     (Legacyfelder bleiben erhalten; vzg_line_number = Snapshot).
--   * Neue Positionstabelle incident_cable_positions (Kabelart je Position)
--     gemäß Architektur V1.0 (kein incidents.cable_type_id).
--   * Transaktionale RPCs create_incident_ap10 / update_incident_ap10
--     (SECURITY INVOKER -> RLS bleibt maßgeblich; keine Service-Role-Umgehung).
--   * Backfill vzg_line_id (eindeutige Treffer) + customer_id (Standardkunde).
--   * RLS/Touch/Audit über die vorhandenen Mechanismen.
-- Keine Änderung an 0001–0007. Kein Löschen von Spalten/Daten.
-- =====================================================================

set check_function_bodies = off;

-- ---------------------------------------------------------------------
-- 1) incidents: neue Referenzen + NOT-NULL-Lockerung der Legacyfelder
-- ---------------------------------------------------------------------
alter table public.incidents
  add column if not exists customer_id uuid references public.customers(id),
  add column if not exists vzg_line_id uuid references public.vzg_lines(id);

alter table public.incidents alter column km_from drop not null;
alter table public.incidents alter column vzg_line_number drop not null;

create index if not exists idx_incidents_customer on public.incidents(customer_id);
create index if not exists idx_incidents_vzg_line on public.incidents(vzg_line_id);

-- ---------------------------------------------------------------------
-- 2) Kabelpositionen (Kabelart je Position; Erweiterung auf n Positionen möglich)
-- ---------------------------------------------------------------------
create table if not exists public.incident_cable_positions (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null references public.incidents(id) on delete cascade,
  cable_type_id uuid not null references public.cable_types(id),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  constraint incident_cable_positions_sort_nonneg check (sort_order >= 0),
  constraint incident_cable_positions_order_uq unique (incident_id, sort_order)
);
create index if not exists idx_cable_positions_incident on public.incident_cable_positions(incident_id);
create index if not exists idx_cable_positions_cable_type on public.incident_cable_positions(cable_type_id);

create or replace trigger trg_touch_cable_positions before update on public.incident_cable_positions
  for each row execute function public.tg_touch_updated();
create or replace trigger trg_audit_cable_positions
  after insert or update or delete on public.incident_cable_positions
  for each row execute function public.tg_audit();

alter table public.incident_cable_positions enable row level security;

-- RLS: Zugriff folgt dem zugehörigen Vorgang (Staff oder zugewiesener Monteur).
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='incident_cable_positions' and policyname='cable_positions_select') then
    create policy cable_positions_select on public.incident_cable_positions for select
      using (public.is_staff() or public.is_assigned_to_incident(incident_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='incident_cable_positions' and policyname='cable_positions_write') then
    create policy cable_positions_write on public.incident_cable_positions for all
      using (public.is_staff() or public.is_assigned_to_incident(incident_id))
      with check (public.is_staff() or public.is_assigned_to_incident(incident_id));
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 3) Transaktionale RPCs (SECURITY INVOKER: RLS/Trigger bleiben maßgeblich)
--    VzG-Snapshot (vzg_line_number) wird serverseitig aus vzg_lines gesetzt.
-- ---------------------------------------------------------------------
create or replace function public.create_incident_ap10(
  p_customer_id uuid,
  p_construction_stage_id uuid,
  p_vzg_line_id uuid,
  p_on_call_number_id uuid,
  p_priority public.incident_priority,
  p_description text,
  p_operating_point text,
  p_track text,
  p_direction text,
  p_object_type text,
  p_object_designation text,
  p_location_description text,
  p_external_reference text,
  p_km_from numeric,
  p_km_to numeric,
  p_caller_name text,
  p_caller_contact text,
  p_internal_note text,
  p_cable_type_id uuid
) returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_id uuid;
  v_vzg_number text;
  v_vzg_stage uuid;
begin
  if p_customer_id is null or p_construction_stage_id is null or p_vzg_line_id is null
     or p_priority is null or p_description is null or btrim(p_description) = ''
     or p_cable_type_id is null then
    raise exception 'Pflichtfelder fehlen.' using errcode = '23514';
  end if;

  select line_number, construction_stage_id into v_vzg_number, v_vzg_stage
    from public.vzg_lines where id = p_vzg_line_id;
  if v_vzg_number is null then
    raise exception 'VzG-Strecke nicht gefunden.' using errcode = '23503';
  end if;
  if v_vzg_stage <> p_construction_stage_id then
    raise exception 'VzG-Strecke gehört nicht zum gewählten Bauabschnitt.' using errcode = '23514';
  end if;

  insert into public.incidents (
    customer_id, construction_stage_id, vzg_line_id, vzg_line_number, on_call_number_id,
    priority, description, operating_point, track, direction, object_type, object_designation,
    location_description, external_reference, km_from, km_to, caller_name, caller_contact,
    internal_note, call_received_at, status
  ) values (
    p_customer_id, p_construction_stage_id, p_vzg_line_id, v_vzg_number, p_on_call_number_id,
    p_priority, p_description, p_operating_point, p_track, p_direction, p_object_type, p_object_designation,
    p_location_description, p_external_reference, p_km_from, p_km_to, p_caller_name, p_caller_contact,
    p_internal_note, now(), 'neu'
  ) returning id into v_id;

  insert into public.incident_cable_positions (incident_id, cable_type_id, sort_order)
  values (v_id, p_cable_type_id, 0);

  return v_id;
end $$;

create or replace function public.update_incident_ap10(
  p_id uuid,
  p_customer_id uuid,
  p_construction_stage_id uuid,
  p_vzg_line_id uuid,
  p_on_call_number_id uuid,
  p_priority public.incident_priority,
  p_description text,
  p_operating_point text,
  p_track text,
  p_direction text,
  p_object_type text,
  p_object_designation text,
  p_location_description text,
  p_external_reference text,
  p_km_from numeric,
  p_km_to numeric,
  p_caller_name text,
  p_caller_contact text,
  p_internal_note text,
  p_cable_type_id uuid
) returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_vzg_number text;
  v_vzg_stage uuid;
  v_pos_id uuid;
begin
  if p_id is null or p_customer_id is null or p_construction_stage_id is null or p_vzg_line_id is null
     or p_priority is null or p_description is null or btrim(p_description) = ''
     or p_cable_type_id is null then
    raise exception 'Pflichtfelder fehlen.' using errcode = '23514';
  end if;

  select line_number, construction_stage_id into v_vzg_number, v_vzg_stage
    from public.vzg_lines where id = p_vzg_line_id;
  if v_vzg_number is null then
    raise exception 'VzG-Strecke nicht gefunden.' using errcode = '23503';
  end if;
  if v_vzg_stage <> p_construction_stage_id then
    raise exception 'VzG-Strecke gehört nicht zum gewählten Bauabschnitt.' using errcode = '23514';
  end if;

  update public.incidents set
    customer_id = p_customer_id,
    construction_stage_id = p_construction_stage_id,
    vzg_line_id = p_vzg_line_id,
    vzg_line_number = v_vzg_number,
    on_call_number_id = p_on_call_number_id,
    priority = p_priority,
    description = p_description,
    operating_point = p_operating_point,
    track = p_track,
    direction = p_direction,
    object_type = p_object_type,
    object_designation = p_object_designation,
    location_description = p_location_description,
    external_reference = p_external_reference,
    km_from = p_km_from,
    km_to = p_km_to,
    caller_name = p_caller_name,
    caller_contact = p_caller_contact,
    internal_note = p_internal_note
  where id = p_id;

  if not found then
    raise exception 'Vorgang nicht gefunden.' using errcode = '23503';
  end if;

  -- Erste Kabelposition (sort_order min) aktualisieren oder anlegen.
  select id into v_pos_id from public.incident_cable_positions
    where incident_id = p_id order by sort_order asc limit 1;
  if v_pos_id is null then
    insert into public.incident_cable_positions (incident_id, cable_type_id, sort_order)
    values (p_id, p_cable_type_id, 0);
  else
    update public.incident_cable_positions set cable_type_id = p_cable_type_id where id = v_pos_id;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 4) Bestandsdatenmigration (nur eindeutige/sichere Übernahmen)
-- ---------------------------------------------------------------------
-- VzG: eindeutig über (construction_stage_id, line_number) – in vzg_lines per
-- UNIQUE(construction_stage_id, line_number) garantiert eindeutig.
update public.incidents i
set vzg_line_id = v.id
from public.vzg_lines v
where i.vzg_line_id is null
  and i.vzg_line_number is not null
  and v.construction_stage_id = i.construction_stage_id
  and v.line_number = i.vzg_line_number;

-- Kunde: Standardkunde nur setzen, wenn in app_settings hinterlegt.
update public.incidents
set customer_id = (select default_customer_id from public.app_settings where id = 1)
where customer_id is null
  and (select default_customer_id from public.app_settings where id = 1) is not null;
