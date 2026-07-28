\set ON_ERROR_STOP on

-- Rollen-Grundlage fuer eine leere PostgreSQL-18-Instanz.
-- app_user ist eine NOLOGIN-Gruppenrolle. Der konkrete Login wird auf dem
-- Zielserver angelegt und erbt app_user; dadurch steht kein Passwort im Repo.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'app_user') then
    create role app_user nologin nosuperuser nocreatedb nocreaterole
      inherit nobypassrls;
  end if;
end
$$;

grant authenticated to app_user;
