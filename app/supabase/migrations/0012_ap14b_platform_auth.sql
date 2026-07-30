-- AP14/B: Zielplattform fuer Identitaet, Sitzungen und RLS.
-- Bestehende Migrationen bleiben unveraendert. Diese Datei ist fuer den
-- Neuaufbau idempotent und setzt eine vollstaendig angewendete 0001-0011-Kette
-- voraus.

create schema if not exists app;
revoke all on schema app from public;

create or replace function app.current_user_id()
returns uuid
language plpgsql
stable
as $$
declare
  value text;
begin
  value := nullif(current_setting('app.user_id', true), '');
  if value is null then
    return null;
  end if;
  return value::uuid;
exception
  when invalid_text_representation then
    return null;
end
$$;
revoke all on function app.current_user_id() from public;
grant usage on schema app to app_user;
grant execute on function app.current_user_id() to app_user;

create table if not exists public.auth_accounts (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  password_hash text not null,
  password_hash_version integer not null default 1 check (password_hash_version > 0),
  must_change_password boolean not null default true,
  is_disabled boolean not null default false,
  failed_attempts integer not null default 0 check (failed_attempts >= 0),
  locked_until timestamptz,
  last_login_at timestamptz,
  -- Zeitpunkt des letzten echten Passwortwechsels (ADR-011 / 2.3).
  -- Traeger des Auditereignisses "Passwort geaendert": nur ein Wechsel bzw. ein
  -- administrativer Reset setzt die Spalte. Sie ist notwendig, weil
  -- `password_hash` sich auch ohne Passwortwechsel aendert - die Anmeldung zieht
  -- einen veralteten Argon2-Parametersatz nach (needsRehash). Ohne diese
  -- getrennte Kennzeichnung waere jede Hash-Erneuerung als Passwortwechsel
  -- auditiert und der Auditsatz damit unbrauchbar.
  password_changed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Pflicht fuer die gemeinsame Triggerfunktion public.tg_touch_updated():
  -- sie setzt updated_at UND updated_by. Ohne diese Spalte scheitert JEDER
  -- UPDATE auf auth_accounts mit 'record "new" has no field "updated_by"' -
  -- und damit die Zaehlung der Fehlversuche, das Zuruecksetzen nach
  -- erfolgreicher Anmeldung und die Hash-Erneuerung.
  -- Fachliche Bedeutung: der zuletzt handelnde Administrator. Bei einer
  -- Selbstaenderung ohne gesetzte Identitaet bleibt der Wert NULL.
  updated_by uuid references public.profiles(id),
  constraint auth_accounts_email_trimmed check (email = btrim(email) and email <> '')
);

-- Wiederholbarkeit: eine bereits ohne diese Spalte angelegte Tabelle wird
-- nachgezogen.
alter table public.auth_accounts
  add column if not exists updated_by uuid references public.profiles(id);
alter table public.auth_accounts
  add column if not exists password_changed_at timestamptz;

create unique index if not exists auth_accounts_email_lower_uidx
  on public.auth_accounts (lower(email));

create table if not exists public.auth_sessions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.auth_accounts(id) on delete cascade,
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  revoked_reason text,
  last_seen_at timestamptz not null default now(),
  created_ip_hash text,
  user_agent_hash text,
  constraint auth_sessions_expiry_after_issue check (expires_at > issued_at),
  constraint auth_sessions_absolute_max check (expires_at <= issued_at + interval '12 hours'),
  constraint auth_sessions_revoke_coherent check (
    (revoked_at is null and revoked_reason is null)
    or (revoked_at is not null and revoked_reason is not null and btrim(revoked_reason) <> '')
  )
);

create index if not exists auth_sessions_account_active_idx
  on public.auth_sessions (account_id, expires_at)
  where revoked_at is null;
create index if not exists auth_sessions_expiry_idx
  on public.auth_sessions (expires_at);

drop trigger if exists trg_touch_auth_accounts on public.auth_accounts;
create trigger trg_touch_auth_accounts
  before update on public.auth_accounts
  for each row execute function public.tg_touch_updated();

revoke all on public.auth_accounts, public.auth_sessions from public, anon, authenticated;
grant select, insert, update, delete on public.auth_accounts, public.auth_sessions to app_user;

-- Mindestrecht fuer die Sitzungsauswertung: die Anwendung muss Rolle,
-- Anzeigename und Aktivstatus des eigenen Profils lesen koennen (ADR-011 / 2.2,
-- Schritt 4). Ohne dieses Tabellenrecht liefert die Auswertung unter der nicht
-- privilegierten Rolle app_user keine Zeile und niemand koennte sich anmelden.
--
-- Es wird ausschliesslich das TABELLENRECHT erteilt. Die Zeilensichtbarkeit
-- bleibt unveraendert bei der Policy `profiles_select`
-- (`id = app.current_user_id() or is_staff()`); kein Policy-Inhalt wird
-- gelockert. Die vollstaendige Rechtematrix fuer die uebrigen Fachtabellen
-- gehoert zur Migration der Datenmodule und ist hier bewusst nicht enthalten.
grant select on public.profiles to app_user;

-- Auditierung des Sitzungswiderrufs (ADR-011 / 2.2: "Jeder Widerruf erzeugt
-- einen Auditeintrag").
--
-- Warum als Trigger und nicht in der Anwendung:
--   * public.audit_events besitzt bewusst KEINE Insert-Policy - geschrieben
--     wird ausschliesslich ueber SECURITY-DEFINER-Trigger (Entscheidung aus
--     0001). Ein direkter Insert der Anwendung wuerde unter app_user an RLS
--     scheitern.
--   * Der Trigger kann nicht vergessen werden: jeder Weg, der revoked_at
--     setzt, erzeugt den Eintrag.
--
-- Warum ein eigener Trigger und nicht public.tg_audit: tg_audit protokolliert
-- jede Aenderung. auth_sessions wird pro Sitzung bis zu einmal pro Minute mit
-- last_seen_at fortgeschrieben; das ergaebe eine Auditflut ohne Aussagewert.
-- Ausgeloest wird deshalb ausschliesslich der Uebergang NULL -> gesetzt.
--
-- detail enthaelt ausschliesslich technische Merkmale. Kein Passwort, kein
-- Hash, kein Token und keine Kopfzeile.
create or replace function public.tg_audit_auth_session_revoked()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if old.revoked_at is null and new.revoked_at is not null then
    insert into public.audit_events (entity, entity_id, action, detail, actor)
    values (
      'auth_sessions',
      new.id,
      'revoke',
      jsonb_build_object(
        'reason', new.revoked_reason,
        'account_id', new.account_id,
        'expires_at', new.expires_at
      ),
      app.current_user_id()
    );
  end if;
  return new;
end $$;
revoke all on function public.tg_audit_auth_session_revoked() from public, anon, authenticated;

drop trigger if exists trg_audit_auth_session_revoked on public.auth_sessions;
create trigger trg_audit_auth_session_revoked
  after update on public.auth_sessions
  for each row execute function public.tg_audit_auth_session_revoked();

-- Auditierung des Passwortwechsels (ADR-011 / 2.3: auditiert werden die
-- Ereignisse "Reset durch Administrator" und "Passwort geaendert" mit Zeitpunkt,
-- handelndem und betroffenem Konto).
--
-- Ausgeloest wird ausschliesslich die Aenderung von password_changed_at. Ein
-- Trigger auf password_hash waere falsch: die Anmeldung erneuert den Hash, wenn
-- der Argon2-Parametersatz veraltet ist (needsRehash), und das ist kein
-- Passwortwechsel.
--
-- detail enthaelt ausschliesslich technische Merkmale. Kein Passwort, kein Hash.
create or replace function public.tg_audit_auth_password_changed()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.password_changed_at is not null
     and new.password_changed_at is distinct from old.password_changed_at then
    insert into public.audit_events (entity, entity_id, action, detail, actor)
    values (
      'auth_accounts',
      new.id,
      'password_changed',
      jsonb_build_object(
        'account_id', new.id,
        'changed_at', new.password_changed_at,
        'password_hash_version', new.password_hash_version,
        'must_change_password', new.must_change_password
      ),
      app.current_user_id()
    );
  end if;
  return new;
end $$;
revoke all on function public.tg_audit_auth_password_changed() from public, anon, authenticated;

drop trigger if exists trg_audit_auth_password_changed on public.auth_accounts;
create trigger trg_audit_auth_password_changed
  after update on public.auth_accounts
  for each row execute function public.tg_audit_auth_password_changed();

-- Synthetische Konten aus der endlichen Kompatibilitaetsschicht uebernehmen.
-- Der Marker ist absichtlich kein gueltiger Argon2-Hash; diese Konten koennen
-- sich erst nach einem administrativen Passwort-Reset anmelden.
insert into public.auth_accounts (id, email, password_hash, must_change_password)
select
  u.id,
  lower(btrim(u.email)),
  '!MIGRATED-ACCOUNT-REQUIRES-RESET!',
  true
from auth.users u
where u.email is not null and btrim(u.email) <> ''
on conflict (id) do nothing;

do $$
declare
  missing_profiles integer;
begin
  select count(*)
  into missing_profiles
  from public.profiles p
  left join public.auth_accounts a on a.id = p.id
  where a.id is null;

  if missing_profiles <> 0 then
    raise exception
      'AP14/B: % Profil(e) besitzen kein uebernommenes Auth-Konto',
      missing_profiles;
  end if;
end
$$;

-- Alle historischen Fremdschluessel auf auth.users werden ohne Datenverlust
-- umgehaengt: profiles.id traegt das Konto, fachliche Actor-Spalten tragen
-- weiterhin die Profil-ID.
do $$
declare
  item record;
  definition text;
  target text;
begin
  for item in
    select
      ns.nspname as schema_name,
      rel.relname as table_name,
      con.conname,
      pg_get_constraintdef(con.oid, true) as definition
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace ns on ns.oid = rel.relnamespace
    where con.contype = 'f'
      and con.confrelid = 'auth.users'::regclass
  loop
    target := case
      when item.schema_name = 'public' and item.table_name = 'profiles'
        then 'public.auth_accounts'
      else 'public.profiles'
    end;

    definition := regexp_replace(
      item.definition,
      'REFERENCES[[:space:]]+auth[.]users',
      'REFERENCES ' || target,
      'i'
    );

    execute format(
      'alter table %I.%I drop constraint %I',
      item.schema_name,
      item.table_name,
      item.conname
    );
    execute format(
      'alter table %I.%I add constraint %I %s',
      item.schema_name,
      item.table_name,
      item.conname,
      definition
    );
  end loop;
end
$$;

-- Historische Defaults auf die neue, transaktionsgebundene Identitaet umstellen.
do $$
declare
  item record;
  rewritten text;
begin
  for item in
    select
      ns.nspname as schema_name,
      rel.relname as table_name,
      attr.attname as column_name,
      pg_get_expr(def.adbin, def.adrelid) as expression
    from pg_attrdef def
    join pg_class rel on rel.oid = def.adrelid
    join pg_namespace ns on ns.oid = rel.relnamespace
    join pg_attribute attr
      on attr.attrelid = def.adrelid and attr.attnum = def.adnum
    where ns.nspname = 'public'
      and pg_get_expr(def.adbin, def.adrelid) ilike '%auth.uid()%'
  loop
    rewritten := replace(item.expression, 'auth.uid()', 'app.current_user_id()');
    execute format(
      'alter table %I.%I alter column %I set default %s',
      item.schema_name,
      item.table_name,
      item.column_name,
      rewritten
    );
  end loop;
end
$$;

-- Funktionskoerper einschliesslich Triggerfunktionen portieren. PostgreSQL
-- liefert mit pg_get_functiondef eine vollstaendige CREATE OR REPLACE-Anweisung.
do $$
declare
  item record;
begin
  for item in
    select p.oid, pg_get_functiondef(p.oid) as definition
    from pg_proc p
    join pg_namespace ns on ns.oid = p.pronamespace
    where ns.nspname = 'public'
      and p.prokind in ('f', 'p')
      and pg_get_functiondef(p.oid) ilike '%auth.uid()%'
  loop
    execute replace(item.definition, 'auth.uid()', 'app.current_user_id()');
  end loop;
end
$$;

-- Direkte Policy-Bezuege portieren, ohne Rollen oder Befehlsart zu aendern.
do $$
declare
  item record;
  statement text;
begin
  for item in
    select schemaname, tablename, policyname, qual, with_check
    from pg_policies
    where schemaname = 'public'
      and (
        coalesce(qual, '') ilike '%auth.uid()%'
        or coalesce(with_check, '') ilike '%auth.uid()%'
      )
  loop
    statement := format(
      'alter policy %I on %I.%I',
      item.policyname,
      item.schemaname,
      item.tablename
    );
    if item.qual is not null then
      statement := statement || ' using (' ||
        replace(item.qual, 'auth.uid()', 'app.current_user_id()') || ')';
    end if;
    if item.with_check is not null then
      statement := statement || ' with check (' ||
        replace(item.with_check, 'auth.uid()', 'app.current_user_id()') || ')';
    end if;
    execute statement;
  end loop;
end
$$;

-- Harte Abschlusspruefung: ausserhalb der Kompatibilitaetsschicht darf kein
-- aktiver Datenbankausdruck mehr auth.uid() verwenden.
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
    select coalesce(qual, '') || ' ' || coalesce(with_check, '')
    from pg_policies
    where schemaname = 'public'
  ) expressions
  where expression ilike '%auth.uid()%';

  if remaining <> 0 then
    raise exception 'AP14/B: % aktive auth.uid()-Referenz(en) verbleiben', remaining;
  end if;
end
$$;
