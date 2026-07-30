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

-- =====================================================================
-- AP14/B Auth-Basis: die Bedingungen, auf denen der Anwendungscode aufsetzt.
-- Geprueft wird ausschliesslich mit synthetischen Werten. Es kommt kein
-- Passwort und kein echter Hash vor - die Argon2id-Pruefung liegt bewusst in
-- app/test/ap14b-auth.test.mjs, weil sie Anwendungscode und keine
-- Datenbanklogik ist.
-- =====================================================================

-- Vorgaben aus Migration 0012: Pflichtfelder und Eindeutigkeit der Adresse.
do $$
declare
  new_id uuid;
  must_change boolean;
  hash_version integer;
begin
  insert into public.auth_accounts (email, password_hash)
  values ('P10.Konto@Beispiel.invalid', '$argon2id$synthetisch')
  returning id, must_change_password, password_hash_version
  into new_id, must_change, hash_version;

  if not must_change then
    raise exception 'SMOKE P10 FAIL must_change_password ist nicht standardmaessig gesetzt';
  end if;
  if hash_version <> 1 then
    raise exception 'SMOKE P10 FAIL password_hash_version ist nicht 1, sondern %', hash_version;
  end if;

  -- Der eindeutige Index laeuft ueber lower(email): die Adresse darf sich nicht
  -- allein durch Gross-/Kleinschreibung wiederholen.
  begin
    insert into public.auth_accounts (email, password_hash)
    values ('p10.konto@beispiel.invalid', '$argon2id$synthetisch');
    raise exception 'SMOKE P10 FAIL Adresse ist nur mit Gross-/Kleinschreibung eindeutig';
  exception
    when unique_violation then null;
  end;

  -- Fuehrende oder folgende Leerzeichen sind ausgeschlossen.
  begin
    insert into public.auth_accounts (email, password_hash)
    values ('  p10b@beispiel.invalid ', '$argon2id$synthetisch');
    raise exception 'SMOKE P10 FAIL nicht getrimmte Adresse wurde angenommen';
  exception
    when check_violation then null;
  end;

  -- Ein UPDATE muss ueberhaupt moeglich sein. Der gemeinsame Trigger
  -- public.tg_touch_updated() setzt updated_at UND updated_by; fehlt die Spalte
  -- updated_by, scheitert jede Aenderung mit
  -- 'record "new" has no field "updated_by"' - und damit die Zaehlung der
  -- Fehlversuche, das Zuruecksetzen nach erfolgreicher Anmeldung und die
  -- Hash-Erneuerung. Diese Pruefung sichert genau das ab.
  update public.auth_accounts
  set failed_attempts = 1, locked_until = now() + interval '15 minutes'
  where id = new_id;

  update public.auth_accounts
  set failed_attempts = 0, locked_until = null, last_login_at = now(),
      password_hash = '$argon2id$erneuert', password_hash_version = 1
  where id = new_id;

  if not exists (
    select 1 from public.auth_accounts
    where id = new_id and updated_at > created_at - interval '1 second'
  ) then
    raise exception 'SMOKE P10 FAIL updated_at wird beim UPDATE nicht gesetzt';
  end if;

  delete from public.auth_accounts where id = new_id;
  raise notice 'SMOKE P10 OK Kontoregeln, Wechselzwang, Version, Adresseindeutigkeit, Aenderbarkeit';
end
$$;

-- Die Grenzen der Sitzungstabelle muessen die Anwendungswerte tragen.
do $$
declare
  account_id uuid;
begin
  select id into account_id from public.auth_accounts order by created_at limit 1;

  -- 12 Stunden sind genau erlaubt (SESSION_HOURS in auth-service.ts).
  insert into public.auth_sessions (account_id, expires_at)
  values (account_id, now() + interval '12 hours');

  -- Darueber hinaus nicht.
  begin
    insert into public.auth_sessions (account_id, expires_at)
    values (account_id, now() + interval '12 hours 1 minute');
    raise exception 'SMOKE P11 FAIL absolute Sitzungsobergrenze wirkt nicht';
  exception
    when check_violation then null;
  end;

  -- Ein Widerruf ohne Grund ist unzulaessig; revokeSession() setzt immer beides.
  begin
    insert into public.auth_sessions (account_id, expires_at, revoked_at)
    values (account_id, now() + interval '10 minutes', now());
    raise exception 'SMOKE P11 FAIL Widerruf ohne Grund wurde angenommen';
  exception
    when check_violation then null;
  end;

  raise notice 'SMOKE P11 OK Sitzungsgrenzen und Widerrufskohaerenz';
end
$$;

-- Genau die Bedingung, mit der validateSession() jeden geschuetzten Request
-- prueft: Sitzung gueltig, Konto aktiv, Profil aktiv.
do $$
declare
  account_a uuid := 'a9000000-0000-0000-0000-00000000000a';
  account_b uuid := 'a9000000-0000-0000-0000-00000000000b';
  session_valid uuid;
  session_expired uuid;
  session_revoked uuid;
  session_disabled uuid;
  hits integer;
begin
  insert into public.auth_accounts (id, email, password_hash, must_change_password)
  values
    (account_a, 'p12.aktiv@beispiel.invalid', '$argon2id$synthetisch', false),
    (account_b, 'p12.gesperrt@beispiel.invalid', '$argon2id$synthetisch', false);
  insert into public.profiles (id, full_name, role, is_active)
  values
    (account_a, 'P12 Aktiv', 'disponent', true),
    (account_b, 'P12 Inaktiv', 'monteur', false);

  insert into public.auth_sessions (account_id, expires_at)
  values (account_a, now() + interval '30 minutes')
  returning id into session_valid;

  insert into public.auth_sessions (account_id, issued_at, expires_at)
  values (account_a, now() - interval '2 hours', now() - interval '1 hour')
  returning id into session_expired;

  insert into public.auth_sessions (account_id, expires_at, revoked_at, revoked_reason)
  values (account_a, now() + interval '30 minutes', now(), 'smoke')
  returning id into session_revoked;

  insert into public.auth_sessions (account_id, expires_at)
  values (account_b, now() + interval '30 minutes')
  returning id into session_disabled;

  -- E22a: gueltige Sitzung mit aktivem Konto und aktivem Profil.
  select count(*) into hits
  from public.auth_sessions s
  join public.auth_accounts a on a.id = s.account_id
  join public.profiles p on p.id = a.id
  where s.id = session_valid and s.account_id = account_a
    and s.revoked_at is null and s.expires_at > now()
    and not a.is_disabled and p.is_active;
  if hits <> 1 then
    raise exception 'SMOKE P12 FAIL gueltige Sitzung wird nicht erkannt';
  end if;

  -- E22b: falsche Kontozuordnung darf nicht greifen (sub und sid gehoeren zusammen).
  select count(*) into hits
  from public.auth_sessions s
  where s.id = session_valid and s.account_id = account_b;
  if hits <> 0 then
    raise exception 'SMOKE P12 FAIL Sitzung wird fremdem Konto zugeordnet';
  end if;

  -- E22c: abgelaufen, widerrufen und inaktives Profil ergeben je keine Zeile.
  select count(*) into hits
  from public.auth_sessions s
  join public.auth_accounts a on a.id = s.account_id
  join public.profiles p on p.id = a.id
  where s.id in (session_expired, session_revoked, session_disabled)
    and s.revoked_at is null and s.expires_at > now()
    and not a.is_disabled and p.is_active;
  if hits <> 0 then
    raise exception 'SMOKE P12 FAIL ungueltige Sitzung wird akzeptiert (% Treffer)', hits;
  end if;

  -- E22d: deaktiviertes Konto sperrt eine bereits ausgestellte Sitzung sofort.
  update public.auth_accounts set is_disabled = true where id = account_a;
  select count(*) into hits
  from public.auth_sessions s
  join public.auth_accounts a on a.id = s.account_id
  join public.profiles p on p.id = a.id
  where s.id = session_valid
    and s.revoked_at is null and s.expires_at > now()
    and not a.is_disabled and p.is_active;
  if hits <> 0 then
    raise exception 'SMOKE P12 FAIL deaktiviertes Konto behaelt gueltige Sitzung';
  end if;
  update public.auth_accounts set is_disabled = false where id = account_a;

  -- E22e: eine Kontosperre (locked_until) beendet eine laufende Sitzung NICHT.
  -- Andernfalls koennte ein Fremder einen angemeldeten Benutzer allein durch
  -- absichtliche Fehlversuche aus der Anwendung werfen.
  update public.auth_accounts
  set locked_until = now() + interval '15 minutes'
  where id = account_a;
  select count(*) into hits
  from public.auth_sessions s
  join public.auth_accounts a on a.id = s.account_id
  join public.profiles p on p.id = a.id
  where s.id = session_valid
    and s.revoked_at is null and s.expires_at > now()
    and not a.is_disabled and p.is_active;
  if hits <> 1 then
    raise exception 'SMOKE P12 FAIL Anmeldesperre beendet die laufende Sitzung';
  end if;
  update public.auth_accounts set locked_until = null where id = account_a;

  raise notice 'SMOKE P12 OK Sitzungspruefung bei jedem geschuetzten Request';
end
$$;

-- =====================================================================
-- Ab hier UNTER DER ANWENDUNGSROLLE app_user mit aktiver RLS.
--
-- Das ist der entscheidende Unterschied: als Eigentuemer (postgres) wird RLS
-- umgangen, und die Pruefungen oben wuerden auch dann bestehen, wenn die
-- Anwendung im Betrieb an einer Policy scheitert. Genau diese Faelle sind hier
-- nachzuweisen:
--   * `public.profiles` traegt die Policy `profiles_select` mit
--     `id = app.current_user_id() or is_staff()`. Ein Lesen OHNE gesetzte
--     Identitaet liefert 0 Zeilen - Rolle und Anzeigename waeren nie
--     ermittelbar.
--   * `public.audit_events` besitzt bewusst KEINE Insert-Policy. Ein direkter
--     Insert der Anwendung scheitert; der Auditsatz muss vom
--     SECURITY-DEFINER-Trigger kommen.
-- =====================================================================
set role app_user;

-- E23: Stufe 1 der Sitzungspruefung laeuft ohne Identitaet, Stufe 2 nicht.
do $$
declare
  account_a uuid := 'a9000000-0000-0000-0000-00000000000a';
  session_id uuid;
  hits integer;
begin
  perform set_config('app.user_id', '', true);

  insert into public.auth_sessions (account_id, expires_at)
  values (account_a, now() + interval '30 minutes')
  returning id into session_id;

  -- Stufe 1: auth_accounts und auth_sessions sind rechtegeschuetzt, nicht
  -- RLS-geschuetzt. Sie muessen ohne Identitaet lesbar sein.
  select count(*) into hits
  from public.auth_sessions s
  join public.auth_accounts a on a.id = s.account_id
  where s.id = session_id and s.account_id = account_a
    and s.revoked_at is null and s.expires_at > now()
    and not a.is_disabled;
  if hits <> 1 then
    raise exception 'SMOKE P15 FAIL Stufe 1 ist unter app_user nicht lesbar';
  end if;

  -- Stufe 2 ohne Identitaet: darf keine Zeile liefern.
  select count(*) into hits from public.profiles where id = account_a;
  if hits <> 0 then
    raise exception 'SMOKE P15 FAIL Profil ist ohne Identitaet lesbar (RLS unwirksam)';
  end if;

  -- Stufe 2 mit Identitaet: genau die eigene Zeile.
  perform set_config('app.user_id', account_a::text, true);
  select count(*) into hits
  from public.profiles where id = account_a and is_active;
  if hits <> 1 then
    raise exception 'SMOKE P15 FAIL Profil ist mit gesetzter Identitaet nicht lesbar';
  end if;

  raise notice 'SMOKE P15 OK Stufe 1 ohne, Stufe 2 nur mit Identitaet lesbar';
end
$$;

-- E24: Der Widerruf ist idempotent und wird vom Trigger auditiert.
-- Die Anwendung darf audit_events NICHT selbst beschreiben.
do $$
declare
  account_a uuid := 'a9000000-0000-0000-0000-00000000000a';
  session_id uuid;
  affected integer;
  audit_rows integer;
  actor_id uuid;
  reason text;
  open_sessions integer;
begin
  perform set_config('app.user_id', account_a::text, true);

  insert into public.auth_sessions (account_id, expires_at)
  values (account_a, now() + interval '30 minutes')
  returning id into session_id;

  -- Entspricht revokeSession(): nur offene Sitzungen werden widerrufen.
  update public.auth_sessions
  set revoked_at = now(), revoked_reason = 'signout'
  where id = session_id and revoked_at is null;
  get diagnostics affected = row_count;
  if affected <> 1 then
    raise exception 'SMOKE P16 FAIL Widerruf hat % Zeilen getroffen', affected;
  end if;

  -- Zweiter Aufruf: idempotent.
  update public.auth_sessions
  set revoked_at = now(), revoked_reason = 'signout'
  where id = session_id and revoked_at is null;
  get diagnostics affected = row_count;
  if affected <> 0 then
    raise exception 'SMOKE P16 FAIL Widerruf ist nicht idempotent';
  end if;

  -- Der Trigger hat genau einen Auditsatz mit Urheber geschrieben. Gelesen wird
  -- als Eigentuemer, weil audit_events nur fuer Admin lesbar ist.
  reset role;
  select count(*) into audit_rows
  from public.audit_events
  where entity = 'auth_sessions' and entity_id = session_id and action = 'revoke';
  select a.actor, a.detail->>'reason'
  into actor_id, reason
  from public.audit_events a
  where a.entity = 'auth_sessions' and a.entity_id = session_id and a.action = 'revoke'
  limit 1;
  set role app_user;

  if audit_rows <> 1 then
    raise exception 'SMOKE P16 FAIL % Auditeintraege statt genau einem', audit_rows;
  end if;
  if actor_id is distinct from account_a then
    raise exception 'SMOKE P16 FAIL Auditeintrag ohne korrekten Urheber (%)', actor_id;
  end if;
  if reason is distinct from 'signout' then
    raise exception 'SMOKE P16 FAIL Auditgrund ist "%"', reason;
  end if;

  -- Die Anwendung darf audit_events nicht direkt beschreiben.
  begin
    perform set_config('app.user_id', account_a::text, true);
    insert into public.audit_events (entity, entity_id, action, detail, actor)
    values ('auth_sessions', session_id, 'revoke', '{}'::jsonb, account_a);
    raise exception 'SMOKE P16 FAIL app_user darf audit_events direkt beschreiben';
  exception
    when insufficient_privilege then null;
  end;

  -- Entspricht revokeAllSessionsForAccount(): alle offenen Sitzungen des Kontos.
  insert into public.auth_sessions (account_id, expires_at)
  values (account_a, now() + interval '30 minutes'), (account_a, now() + interval '30 minutes');

  update public.auth_sessions
  set revoked_at = now(), revoked_reason = 'password_changed'
  where account_id = account_a and revoked_at is null;
  get diagnostics affected = row_count;
  if affected < 2 then
    raise exception 'SMOKE P16 FAIL Kontoweiter Widerruf traf nur % Sitzung(en)', affected;
  end if;

  select count(*) into open_sessions
  from public.auth_sessions
  where account_id = account_a and revoked_at is null;
  if open_sessions <> 0 then
    raise exception 'SMOKE P16 FAIL % Sitzung(en) bleiben nach dem Kontowiderruf offen', open_sessions;
  end if;

  reset role;
  select count(*) into audit_rows
  from public.audit_events
  where entity = 'auth_sessions' and action = 'revoke'
    and detail->>'reason' = 'password_changed';
  set role app_user;
  if audit_rows <> affected then
    raise exception 'SMOKE P16 FAIL % Auditeintraege fuer % Widerrufe', audit_rows, affected;
  end if;

  raise notice 'SMOKE P16 OK Widerruf idempotent, triggerauditiert, kontoweit wirksam';
end
$$;

-- E26: Der Passwortwechsel ist auditiert - und NUR der Passwortwechsel.
--
-- Gegenstand ist die Trennung von "Passwort geaendert" und "Hash erneuert":
-- die Anmeldung zieht einen veralteten Argon2-Parametersatz nach (needsRehash)
-- und aendert dabei password_hash, ohne dass ein Passwortwechsel stattfindet.
-- Ausgeloest wird der Auditsatz deshalb ausschliesslich von
-- password_changed_at. Geschrieben wird auch hier vom SECURITY-DEFINER-Trigger;
-- audit_events hat bewusst keine Insert-Policy.
do $$
declare
  account_a uuid := 'a9000000-0000-0000-0000-00000000000a';
  audit_rows integer;
  actor_id uuid;
  detail_text text;
  changed_at timestamptz;
begin
  perform set_config('app.user_id', account_a::text, true);

  -- Ausgangslage: Uebergangspasswort mit Wechselzwang.
  update public.auth_accounts
  set password_hash = '$argon2id$uebergang',
      must_change_password = true,
      password_changed_at = null
  where id = account_a;

  -- 1) Hash-Erneuerung beim Login: password_hash aendert sich, es ist KEIN
  --    Passwortwechsel und darf deshalb keinen Auditsatz erzeugen.
  update public.auth_accounts
  set password_hash = '$argon2id$erneuert', password_hash_version = 1,
      last_login_at = now()
  where id = account_a;

  reset role;
  select count(*) into audit_rows
  from public.audit_events
  where entity = 'auth_accounts' and entity_id = account_a
    and action = 'password_changed';
  set role app_user;
  if audit_rows <> 0 then
    raise exception 'SMOKE P18 FAIL Hash-Erneuerung erzeugt % Passwortwechsel-Auditsatz/-saetze', audit_rows;
  end if;

  -- 2) Echter Passwortwechsel: genau ein Auditsatz mit Urheber und Konto.
  update public.auth_accounts
  set password_hash = '$argon2id$gewechselt',
      password_hash_version = 1,
      must_change_password = false,
      password_changed_at = now(),
      failed_attempts = 0,
      locked_until = null
  where id = account_a
  returning password_changed_at into changed_at;
  if changed_at is null then
    raise exception 'SMOKE P18 FAIL password_changed_at wurde nicht gesetzt';
  end if;

  reset role;
  select count(*) into audit_rows
  from public.audit_events
  where entity = 'auth_accounts' and entity_id = account_a
    and action = 'password_changed';
  select a.actor, a.detail::text
  into actor_id, detail_text
  from public.audit_events a
  where a.entity = 'auth_accounts' and a.entity_id = account_a
    and a.action = 'password_changed'
  limit 1;
  set role app_user;

  if audit_rows <> 1 then
    raise exception 'SMOKE P18 FAIL % Auditeintraege statt genau einem', audit_rows;
  end if;
  if actor_id is distinct from account_a then
    raise exception 'SMOKE P18 FAIL Auditeintrag ohne korrekten Urheber (%)', actor_id;
  end if;
  -- Kein Hash und kein Klartext im Auditsatz.
  if detail_text like '%argon2%' or detail_text like '%password_hash"%' then
    raise exception 'SMOKE P18 FAIL Auditdetail enthaelt Hashmaterial';
  end if;

  -- 3) Der Wechselzwang ist aufgehoben und die Version nachgezogen.
  if exists (
    select 1 from public.auth_accounts
    where id = account_a and (must_change_password or password_hash_version <> 1)
  ) then
    raise exception 'SMOKE P18 FAIL Wechselzwang oder Version nach dem Wechsel falsch';
  end if;

  -- 4) Eine weitere Aenderung ohne neuen Zeitpunkt erzeugt keinen zweiten Satz.
  update public.auth_accounts set failed_attempts = 1 where id = account_a;
  reset role;
  select count(*) into audit_rows
  from public.audit_events
  where entity = 'auth_accounts' and entity_id = account_a
    and action = 'password_changed';
  set role app_user;
  if audit_rows <> 1 then
    raise exception 'SMOKE P18 FAIL % Auditeintraege nach unbeteiligter Aenderung', audit_rows;
  end if;
  update public.auth_accounts set failed_attempts = 0 where id = account_a;

  raise notice 'SMOKE P18 OK Passwortwechsel auditiert, Hash-Erneuerung nicht';
end
$$;

-- E27: Der Passwortwechsel widerruft ALLE Sitzungen des Kontos, atomar mit der
-- Aenderung des Hashes. Genau der Ablauf aus changeOwnPassword().
do $$
declare
  account_a uuid := 'a9000000-0000-0000-0000-00000000000a';
  open_sessions integer;
  revoked_rows integer;
begin
  perform set_config('app.user_id', account_a::text, true);

  insert into public.auth_sessions (account_id, expires_at)
  values (account_a, now() + interval '30 minutes'),
         (account_a, now() + interval '30 minutes'),
         (account_a, now() + interval '30 minutes');

  update public.auth_accounts
  set password_hash = '$argon2id$erneut-gewechselt',
      must_change_password = false,
      password_changed_at = now()
  where id = account_a;

  update public.auth_sessions
  set revoked_at = now(), revoked_reason = 'password_changed'
  where account_id = account_a and revoked_at is null;
  get diagnostics revoked_rows = row_count;
  if revoked_rows < 3 then
    raise exception 'SMOKE P19 FAIL nur % Sitzung(en) widerrufen', revoked_rows;
  end if;

  select count(*) into open_sessions
  from public.auth_sessions
  where account_id = account_a and revoked_at is null;
  if open_sessions <> 0 then
    raise exception 'SMOKE P19 FAIL % Sitzung(en) bleiben nach dem Wechsel offen', open_sessions;
  end if;

  raise notice 'SMOKE P19 OK Passwortwechsel beendet alle Sitzungen des Kontos';
end
$$;

-- E25: app_user besitzt keinen Weg, die Identitaet dauerhaft zu setzen.
do $$
declare
  leftover uuid;
begin
  perform set_config('app.user_id', 'a9000000-0000-0000-0000-00000000000a', true);
  leftover := app.current_user_id();
  if leftover is null then
    raise exception 'SMOKE P17 FAIL Identitaet ist innerhalb der Transaktion nicht gesetzt';
  end if;
  raise notice 'SMOKE P17 OK transaktionslokale Identitaet auch unter app_user wirksam';
end
$$;

reset role;

-- Nach dem Rollenwechsel zurueck in den Eigentuemerkontext: die Identitaet aus
-- den obigen Bloecken darf die folgenden Pruefungen nicht beeinflussen.
select set_config('app.user_id', '', false);

-- Der Widerruf schreibt genau einen Auditeintrag und ist wiederholbar
-- (Gegenprobe im Eigentuemerkontext, damit ein Ausfall der Rollenumschaltung
-- oben nicht unbemerkt bleibt).
do $$
declare
  audit_rows integer;
begin
  select count(*) into audit_rows
  from public.audit_events
  where entity = 'auth_sessions' and action = 'revoke';
  if audit_rows < 4 then
    raise exception 'SMOKE P13 FAIL nur % Widerrufs-Auditeintraege vorhanden', audit_rows;
  end if;
  raise notice 'SMOKE P13 OK Widerrufe sind vollstaendig auditiert (%)', audit_rows;
end
$$;

-- Passwortdaten duerfen niemals im Klartext oder im Audit erscheinen.
do $$
declare
  leaks integer;
begin
  select count(*) into leaks
  from public.audit_events
  where entity in ('auth_sessions', 'auth_accounts')
    and (detail ? 'password' or detail ? 'password_hash' or detail ? 'token');
  if leaks <> 0 then
    raise exception 'SMOKE P14 FAIL % Auditeintrag/-eintraege mit Passwort- oder Tokenfeld', leaks;
  end if;

  -- Auch kein Hashmaterial im Auditdetail des Passwortwechsels.
  select count(*) into leaks
  from public.audit_events
  where entity = 'auth_accounts' and detail::text like '%argon2%';
  if leaks <> 0 then
    raise exception 'SMOKE P14 FAIL % Auditeintrag/-eintraege mit Hashmaterial', leaks;
  end if;

  select count(*) into leaks
  from public.auth_accounts
  where password_hash not like '$argon2id$%'
    and password_hash <> '!MIGRATED-ACCOUNT-REQUIRES-RESET!';
  if leaks <> 0 then
    raise exception 'SMOKE P14 FAIL % Konto/Konten ohne Argon2id-Hash oder Marker', leaks;
  end if;

  raise notice 'SMOKE P14 OK keine Passwort- oder Tokenwerte in Audit und Konten';
end
$$;

-- Aufraeumen: die synthetischen P12-P19-Konten hinterlassen keine Fixture.
delete from public.audit_events
where entity in ('auth_sessions', 'auth_accounts')
  and actor = 'a9000000-0000-0000-0000-00000000000a';
-- Zuerst die Selbstreferenz loesen: die Aenderungen der Bloecke P18/P19 liefen
-- MIT gesetzter Identitaet, deshalb traegt auth_accounts.updated_by jetzt die
-- Profil-ID. Ohne dieses Loesen scheitert das Loeschen des Profils am
-- Fremdschluessel. Der Trigger tg_touch_updated() setzt den Wert aus der
-- aktuellen Identitaet - die ist hier leer, also NULL.
update public.auth_accounts
set updated_by = null
where id in ('a9000000-0000-0000-0000-00000000000a', 'a9000000-0000-0000-0000-00000000000b');
delete from public.profiles
where id in ('a9000000-0000-0000-0000-00000000000a', 'a9000000-0000-0000-0000-00000000000b');
delete from public.auth_accounts
where id in ('a9000000-0000-0000-0000-00000000000a', 'a9000000-0000-0000-0000-00000000000b');
