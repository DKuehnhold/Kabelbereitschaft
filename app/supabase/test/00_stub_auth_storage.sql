-- NUR FUER LOKALEN TEST gegen ein reines PostgreSQL.
-- In Supabase NICHT ausfuehren (auth/storage existieren dort bereits).
create schema if not exists auth;
create schema if not exists storage;

create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  raw_user_meta_data jsonb default '{}'::jsonb
);

-- auth.uid() liest die per SET gesetzte Test-UID.
create or replace function auth.uid() returns uuid
language sql stable as $$
  select nullif(current_setting('test.uid', true), '')::uuid;
$$;

create table if not exists storage.buckets (
  id text primary key, name text, public boolean default false
);
-- Näher an echtem Supabase-Storage (für AP4-Bucket-Härtung im lokalen Test):
alter table storage.buckets add column if not exists file_size_limit bigint;
alter table storage.buckets add column if not exists allowed_mime_types text[];
create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets(id),
  name text
);
alter table storage.objects enable row level security;

-- Nachbildung von storage.foldername(name) -> text[] der Ordnersegmente.
create or replace function storage.foldername(name text) returns text[]
language sql immutable as $$
  select (string_to_array(name, '/'))[1:array_length(string_to_array(name,'/'),1)-1];
$$;
