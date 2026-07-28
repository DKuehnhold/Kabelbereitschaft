\set ON_ERROR_STOP on

do $$
declare
  account_id uuid;
  current_id uuid;
  role_flags record;
  fk_target text;
  stale_refs integer;
begin
  if to_regnamespace('auth') is not null or to_regnamespace('storage') is not null then
    raise exception 'SMOKE P1 FAIL auth/storage-Kompatibilitaet verblieben';
  end if;
  raise notice 'SMOKE P1 OK auth/storage vollstaendig entfernt';

  if to_regclass('public.auth_accounts') is null
     or to_regclass('public.auth_sessions') is null then
    raise exception 'SMOKE P2 FAIL Auth-Zieltabellen fehlen';
  end if;
  raise notice 'SMOKE P2 OK Auth-Zieltabellen vorhanden';

  perform set_config('app.user_id', 'ungueltig', true);
  if app.current_user_id() is not null then
    raise exception 'SMOKE P3 FAIL ungueltige Identitaet ergibt nicht NULL';
  end if;
  raise notice 'SMOKE P3 OK fehlende/ungueltige Identitaet wird verweigert';

  select rolsuper, rolbypassrls
  into role_flags
  from pg_roles
  where rolname = 'app_user';
  if role_flags.rolsuper or role_flags.rolbypassrls then
    raise exception 'SMOKE P4 FAIL app_user ist privilegiert';
  end if;
  raise notice 'SMOKE P4 OK app_user ohne SUPERUSER/BYPASSRLS';

  select p.id
  into account_id
  from public.profiles p
  join public.auth_accounts a on a.id = p.id
  order by p.created_at
  limit 1;
  if account_id is null then
    raise exception 'SMOKE P5 FAIL kein portiertes Konto/Profil vorhanden';
  end if;

  perform set_config('app.user_id', account_id::text, true);
  current_id := app.current_user_id();
  if current_id is distinct from account_id then
    raise exception 'SMOKE P5 FAIL SET LOCAL Identitaet nicht lesbar';
  end if;
  raise notice 'SMOKE P5 OK transaktionsgebundene Identitaet lesbar';

  select nsp.nspname || '.' || rel.relname
  into fk_target
  from pg_constraint con
  join pg_class src on src.oid = con.conrelid
  join pg_namespace src_ns on src_ns.oid = src.relnamespace
  join pg_class rel on rel.oid = con.confrelid
  join pg_namespace nsp on nsp.oid = rel.relnamespace
  where src_ns.nspname = 'public'
    and src.relname = 'profiles'
    and con.contype = 'f'
    and con.conkey = array[
      (select attnum from pg_attribute
       where attrelid = src.oid and attname = 'id')
    ]::smallint[]
  limit 1;
  if fk_target is distinct from 'public.auth_accounts' then
    raise exception 'SMOKE P6 FAIL profiles.id zeigt auf %', fk_target;
  end if;
  raise notice 'SMOKE P6 OK Konto/Profil-Beziehung korrekt';

  select count(*)
  into stale_refs
  from (
    select pg_get_functiondef(p.oid) as expression
    from pg_proc p
    join pg_namespace ns on ns.oid = p.pronamespace
    where ns.nspname = 'public' and p.prokind in ('f', 'p')
    union all
    select pg_get_expr(d.adbin, d.adrelid)
    from pg_attrdef d
    join pg_class c on c.oid = d.adrelid
    join pg_namespace ns on ns.oid = c.relnamespace
    where ns.nspname = 'public'
    union all
    select coalesce(qual, '') || ' ' || coalesce(with_check, '')
    from pg_policies
    where schemaname = 'public'
  ) expressions
  where expression ~* '(auth[.]uid|storage[.])';
  if stale_refs <> 0 then
    raise exception 'SMOKE P7 FAIL % alte aktive Referenzen', stale_refs;
  end if;
  raise notice 'SMOKE P7 OK keine aktive Supabase-DB-Referenz';
end
$$;
-- SET LOCAL darf nach Transaktionsende nicht auf derselben Verbindung bleiben.
begin;
select set_config(
  'app.user_id',
  (select id::text from public.profiles order by created_at limit 1),
  true
);
do $$
begin
  if app.current_user_id() is null then
    raise exception 'SMOKE P8 FAIL Identitaet innerhalb Transaktion fehlt';
  end if;
end
$$;
commit;

do $$
begin
  if app.current_user_id() is not null then
    raise exception 'SMOKE P8 FAIL Identitaet ist aus Transaktion ausgetreten';
  end if;
  raise notice 'SMOKE P8 OK SET LOCAL tritt nicht aus Transaktion aus';
end
$$;

-- Sitzung ist nur ohne Widerruf und vor Ablauf gueltig.
do $$
declare
  account_id uuid;
  session_id uuid;
  valid_count integer;
begin
  select id into account_id from public.auth_accounts order by created_at limit 1;
  insert into public.auth_sessions (account_id, expires_at)
  values (account_id, now() + interval '10 minutes')
  returning id into session_id;

  select count(*) into valid_count
  from public.auth_sessions
  where id = session_id and revoked_at is null and expires_at > now();
  if valid_count <> 1 then
    raise exception 'SMOKE P9 FAIL neue Sitzung ungueltig';
  end if;

  update public.auth_sessions
  set revoked_at = now(), revoked_reason = 'smoke'
  where id = session_id;

  select count(*) into valid_count
  from public.auth_sessions
  where id = session_id and revoked_at is null and expires_at > now();
  if valid_count <> 0 then
    raise exception 'SMOKE P9 FAIL Widerruf unwirksam';
  end if;
  raise notice 'SMOKE P9 OK serverseitiger Sitzungswiderruf wirksam';
end
$$;
