\set ON_ERROR_STOP on

-- Endliche Kompatibilitaetsschicht fuer die unveraenderte Historie 0001-0011.
-- Sie wird durch 0012 abgeloest und von 0013 vollstaendig entfernt.
create schema if not exists auth;

create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  raw_user_meta_data jsonb not null default '{}'::jsonb
);

create or replace function auth.uid()
returns uuid
language plpgsql
stable
as $$
declare
  value text;
begin
  value := nullif(current_setting('test.uid', true), '');
  if value is null then
    return null;
  end if;
  return value::uuid;
exception
  when invalid_text_representation then
    return null;
end
$$;
