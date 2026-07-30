-- AP14/B: endliche Kompatibilitaetsschicht entfernen.

do $$
declare
  remaining integer;
begin
  select count(*)
  into remaining
  from (
    select pg_get_functiondef(p.oid) as expression
    from pg_proc p
    join pg_namespace ns on ns.oid = p.pronamespace
    where ns.nspname = 'public' and p.prokind in ('f', 'p')
    union all
    select pg_get_expr(def.adbin, def.adrelid)
    from pg_attrdef def
    join pg_class rel on rel.oid = def.adrelid
    join pg_namespace ns on ns.oid = rel.relnamespace
    where ns.nspname = 'public'
    union all
    select pg_get_constraintdef(con.oid, true)
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace ns on ns.oid = rel.relnamespace
    where ns.nspname = 'public'
    union all
    select coalesce(qual, '') || ' ' || coalesce(with_check, '')
    from pg_policies
    where schemaname = 'public'
  ) expressions
  where expression ~* '(auth[.]|storage[.])';

  if remaining <> 0 then
    raise exception
      'AP14/B: Kompatibilitaet kann nicht entfernt werden; % externe Referenz(en) verbleiben',
      remaining;
  end if;
end
$$;

drop schema if exists storage cascade;
drop schema if exists auth cascade;
drop function if exists public.handle_new_user();

do $$
begin
  if to_regnamespace('auth') is not null or to_regnamespace('storage') is not null then
    raise exception 'AP14/B: auth/storage wurden nicht vollstaendig entfernt';
  end if;
end
$$;
