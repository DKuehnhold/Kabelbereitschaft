\set ON_ERROR_STOP on

-- Endliche Storage-Kompatibilitaet fuer 0002 und 0005.
-- Produktive Bildobjekte liegen nach 0013 ausschliesslich in MinIO.
create schema if not exists storage;

create table if not exists storage.buckets (
  id text primary key,
  name text,
  public boolean not null default false,
  file_size_limit bigint,
  allowed_mime_types text[]
);

create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets(id),
  name text
);

alter table storage.objects enable row level security;

create or replace function storage.foldername(name text)
returns text[]
language sql
immutable
as $$
  select (string_to_array(name, '/'))[
    1:array_length(string_to_array(name, '/'), 1) - 1
  ];
$$;
