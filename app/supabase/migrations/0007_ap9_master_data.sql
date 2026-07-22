-- =====================================================================
-- Kabelbereitschaft – AP9 (Migration 0007): Stammdaten & Einstellungen
-- Additiv, idempotent, ohne Datenverlust. Rückwärtskompatibel zu AP1–AP8.
--   * Neues Enum phone_type.
--   * construction_stages additiv erweitert (wus_bst, default_on_call_number_id).
--   * Neue Stammdaten: customers, vzg_lines, contacts, contact_phone_numbers,
--     construction_stage_contacts, technicians, teams, team_members,
--     cable_types (Referenz, geseedet), app_settings (Singleton).
--   * tg_audit feldgenau erweitert (CREATE OR REPLACE, detail.op bleibt erhalten).
--   * updated_at/by- und Audit-Trigger für die neuen Tabellen.
--   * RLS: alle Angemeldeten lesen; Schreiben nur is_staff() (admin+disponent).
--     construction_stages-Schreibrecht von is_admin() auf is_staff() erweitert.
--   * Seeds: 6 Kabelarten (idempotent), app_settings-Singletonzeile.
-- Keine Änderung an 0001–0006. Kein physisches Löschen (fachlich über is_active).
-- =====================================================================

set check_function_bodies = off;

-- ---------------------------------------------------------------------
-- 1) Enum phone_type (idempotent)
-- ---------------------------------------------------------------------
do $$ begin
  if not exists (select 1 from pg_type where typname = 'phone_type') then
    create type public.phone_type as enum ('mobil','festnetz','leitstelle','sonstige');
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 2) construction_stages additiv erweitern
-- ---------------------------------------------------------------------
alter table public.construction_stages
  add column if not exists wus_bst text,
  add column if not exists default_on_call_number_id uuid references public.on_call_numbers(id);

-- ---------------------------------------------------------------------
-- 3) Neue Stammdatentabellen (FK-gerechte Reihenfolge)
-- ---------------------------------------------------------------------

-- 3.1 Kunden
create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  erp_id text unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);
create index if not exists idx_customers_active on public.customers(is_active);

-- 3.2 VzG-Strecken (Nummer exakt 4 Ziffern; eindeutig je Bauabschnitt)
create table if not exists public.vzg_lines (
  id uuid primary key default gen_random_uuid(),
  line_number text not null,
  description text,
  construction_stage_id uuid not null references public.construction_stages(id),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  constraint vzg_lines_number_format check (line_number ~ '^[0-9]{4}$'),
  constraint vzg_lines_stage_number_uq unique (construction_stage_id, line_number)
);
create index if not exists idx_vzg_lines_stage on public.vzg_lines(construction_stage_id, is_active);

-- 3.3 Ansprechpartner (Kunde)
create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id),
  name text not null,
  function text,
  email text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);
create index if not exists idx_contacts_customer on public.contacts(customer_id, is_active);

-- 3.4 Telefonnummern je Ansprechpartner (mehrere; typisiert)
create table if not exists public.contact_phone_numbers (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.contacts(id) on delete cascade,
  phone text not null,
  phone_type public.phone_type not null default 'sonstige',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  constraint contact_phone_not_empty check (length(btrim(phone)) > 0),
  constraint contact_phone_sort_nonneg check (sort_order >= 0)
);
create index if not exists idx_contact_phones_contact on public.contact_phone_numbers(contact_id, sort_order);

-- 3.5 Zuordnung Ansprechpartner <-> Bauabschnitt (M:N, eigene id + Unique-Paar)
create table if not exists public.construction_stage_contacts (
  id uuid primary key default gen_random_uuid(),
  construction_stage_id uuid not null references public.construction_stages(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete cascade,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users(id),
  constraint csc_stage_contact_uq unique (construction_stage_id, contact_id)
);
create index if not exists idx_csc_contact on public.construction_stage_contacts(contact_id);

-- 3.6 Monteure (Stammdaten; profile_id optional, spätere SSO-Verknüpfung)
create table if not exists public.technicians (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text not null,
  profile_id uuid references public.profiles(id),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  constraint technicians_profile_uq unique (profile_id)
);
create index if not exists idx_technicians_active on public.technicians(is_active);

-- 3.7 Teams
create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);
create index if not exists idx_teams_active on public.teams(is_active);

-- 3.8 Teammitglieder (M:N, eigene id + Unique-Paar; Mehrfachmitgliedschaft)
create table if not exists public.team_members (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  technician_id uuid not null references public.technicians(id) on delete cascade,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users(id),
  constraint team_members_team_tech_uq unique (team_id, technician_id)
);
create index if not exists idx_team_members_tech on public.team_members(technician_id);

-- 3.9 Kabelarten (Referenztabelle; keine Hardcodierung)
create table if not exists public.cable_types (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

-- 3.10 App-Einstellungen (echte Singleton-Tabelle)
create table if not exists public.app_settings (
  id smallint primary key default 1,
  default_customer_id uuid references public.customers(id),
  default_on_call_number_id uuid references public.on_call_numbers(id),
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  constraint app_settings_singleton check (id = 1)
);

-- ---------------------------------------------------------------------
-- 4) tg_audit feldgenau erweitern (rückwärtskompatibel: detail.op bleibt)
--    UPDATE  -> detail.changes = { feld: { old, new }, ... }
--    INSERT  -> detail.new     = <Datensatz>
--    DELETE  -> detail.old     = <Datensatz>
--    (updated_at/updated_by werden im Diff bewusst ausgeblendet: sie werden
--     vom BEFORE-Touch-Trigger bei jedem UPDATE gesetzt und wären nur Rauschen.)
-- ---------------------------------------------------------------------
create or replace function public.tg_audit()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_old jsonb := case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) else null end;
  v_new jsonb := case when tg_op in ('UPDATE','INSERT') then to_jsonb(new) else null end;
  v_id_txt text;
  v_id uuid;
  v_detail jsonb := jsonb_build_object('op', tg_op);
  v_changes jsonb := '{}'::jsonb;
  k text;
begin
  -- Datensatz-ID defensiv ermitteln: nur echte UUIDs übernehmen, sonst NULL
  -- (z. B. app_settings.id ist smallint). Der Datensatz bleibt in detail erhalten.
  v_id_txt := coalesce(v_new->>'id', v_old->>'id');
  v_id := case
            when v_id_txt ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
            then v_id_txt::uuid
            else null
          end;
  if tg_op = 'UPDATE' then
    for k in select jsonb_object_keys(v_new) loop
      if k in ('updated_at','updated_by') then
        continue;
      end if;
      if (v_new->k) is distinct from (v_old->k) then
        v_changes := v_changes || jsonb_build_object(k, jsonb_build_object('old', v_old->k, 'new', v_new->k));
      end if;
    end loop;
    v_detail := v_detail || jsonb_build_object('changes', v_changes);
  elsif tg_op = 'INSERT' then
    v_detail := v_detail || jsonb_build_object('new', v_new);
  elsif tg_op = 'DELETE' then
    v_detail := v_detail || jsonb_build_object('old', v_old);
  end if;
  insert into public.audit_events(entity, entity_id, action, actor, detail)
  values (tg_table_name, v_id, tg_op, auth.uid(), v_detail);
  return coalesce(new, old);
end $$;

-- ---------------------------------------------------------------------
-- 5) updated_at/by-Trigger für neue Tabellen (mit updated_at)
-- ---------------------------------------------------------------------
create or replace trigger trg_touch_customers before update on public.customers
  for each row execute function public.tg_touch_updated();
create or replace trigger trg_touch_vzg_lines before update on public.vzg_lines
  for each row execute function public.tg_touch_updated();
create or replace trigger trg_touch_contacts before update on public.contacts
  for each row execute function public.tg_touch_updated();
create or replace trigger trg_touch_contact_phones before update on public.contact_phone_numbers
  for each row execute function public.tg_touch_updated();
create or replace trigger trg_touch_technicians before update on public.technicians
  for each row execute function public.tg_touch_updated();
create or replace trigger trg_touch_teams before update on public.teams
  for each row execute function public.tg_touch_updated();
create or replace trigger trg_touch_cable_types before update on public.cable_types
  for each row execute function public.tg_touch_updated();
create or replace trigger trg_touch_app_settings before update on public.app_settings
  for each row execute function public.tg_touch_updated();

-- ---------------------------------------------------------------------
-- 6) Audit-Trigger für neue Tabellen + construction_stages (bisher nicht auditiert)
-- ---------------------------------------------------------------------
create or replace trigger trg_audit_customers
  after insert or update or delete on public.customers
  for each row execute function public.tg_audit();
create or replace trigger trg_audit_vzg_lines
  after insert or update or delete on public.vzg_lines
  for each row execute function public.tg_audit();
create or replace trigger trg_audit_contacts
  after insert or update or delete on public.contacts
  for each row execute function public.tg_audit();
create or replace trigger trg_audit_contact_phones
  after insert or update or delete on public.contact_phone_numbers
  for each row execute function public.tg_audit();
create or replace trigger trg_audit_csc
  after insert or update or delete on public.construction_stage_contacts
  for each row execute function public.tg_audit();
create or replace trigger trg_audit_technicians
  after insert or update or delete on public.technicians
  for each row execute function public.tg_audit();
create or replace trigger trg_audit_teams
  after insert or update or delete on public.teams
  for each row execute function public.tg_audit();
create or replace trigger trg_audit_team_members
  after insert or update or delete on public.team_members
  for each row execute function public.tg_audit();
create or replace trigger trg_audit_cable_types
  after insert or update or delete on public.cable_types
  for each row execute function public.tg_audit();
create or replace trigger trg_audit_app_settings
  after insert or update or delete on public.app_settings
  for each row execute function public.tg_audit();
create or replace trigger trg_audit_stages
  after insert or update or delete on public.construction_stages
  for each row execute function public.tg_audit();

-- ---------------------------------------------------------------------
-- 7) Row Level Security
-- ---------------------------------------------------------------------
alter table public.customers                    enable row level security;
alter table public.vzg_lines                    enable row level security;
alter table public.contacts                     enable row level security;
alter table public.contact_phone_numbers        enable row level security;
alter table public.construction_stage_contacts  enable row level security;
alter table public.technicians                  enable row level security;
alter table public.teams                        enable row level security;
alter table public.team_members                 enable row level security;
alter table public.cable_types                  enable row level security;
alter table public.app_settings                 enable row level security;

-- Alle Angemeldeten lesen; Schreiben nur is_staff() (admin + disponent).
do $$
declare
  t text;
  ap9_tables text[] := array[
    'customers','vzg_lines','contacts','contact_phone_numbers',
    'construction_stage_contacts','technicians','teams','team_members',
    'cable_types','app_settings'
  ];
begin
  foreach t in array ap9_tables loop
    if not exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = t and policyname = t || '_select'
    ) then
      execute format(
        'create policy %I on public.%I for select using (auth.uid() is not null)',
        t || '_select', t
      );
    end if;
    if not exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = t and policyname = t || '_write'
    ) then
      execute format(
        'create policy %I on public.%I for all using (public.is_staff()) with check (public.is_staff())',
        t || '_write', t
      );
    end if;
  end loop;
end $$;

-- construction_stages: Schreibrecht von is_admin() auf is_staff() erweitern.
do $$ begin
  if exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'construction_stages' and policyname = 'stages_write'
  ) then
    drop policy stages_write on public.construction_stages;
  end if;
  create policy stages_write on public.construction_stages for all
    using (public.is_staff()) with check (public.is_staff());
end $$;

-- ---------------------------------------------------------------------
-- 8) Seeds (idempotent)
-- ---------------------------------------------------------------------
insert into public.cable_types (code, name, sort_order) values
  ('50hz','50 Hz',1),
  ('ola','OLA',2),
  ('lst','LST',3),
  ('tk','TK',4),
  ('lwl','LWL',5),
  ('unbekannt','Unbekannt',99)
on conflict (code) do nothing;

-- Genau eine Einstellungszeile; Standardwerte dürfen zunächst NULL sein.
insert into public.app_settings (id) values (1)
on conflict (id) do nothing;
