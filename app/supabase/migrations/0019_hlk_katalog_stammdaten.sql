-- =====================================================================
-- Kabelbereitschaft – AUFTRAG_6 (Migration 0019): pflegbare
-- Stammdaten-Kataloge Gewerk, Funktion, Objektart.
--
-- Grundlage: Entscheidungen Dennis vom 2026-08-16 (PROJEKT_WISSEN.md) und
-- 01-Anforderungen/ANFORDERUNG_DISPO_METADATEN.md. Diese Migration liefert
-- AUSSCHLIESSLICH die drei pflegbaren Kataloge und die optionale
-- Funktions-Verknuepfung an public.contacts. Additiv zu 0001-0018, keine
-- bestehende Definition wird entfernt, keine bestehende Policy geloest oder
-- gelockert. Das Gewerk-Feld AN der Meldung selbst (public.incidents) ist
-- ausdruecklich NICHT Gegenstand dieser Migration - das kommt mit AUFTRAG_7.
--
-- Tabellenform je Katalog, wortgetreu wie im Auftrag benannt: id, label,
-- is_active, Audit-Spalten/Trigger wie im Bestand. Bewusst KEIN code, KEIN
-- sort_order wie bei public.cable_types (0007_ap9_master_data.sql:148-159) -
-- der Auftrag zaehlt die Spalten der neuen Kataloge ausdruecklich mit genau
-- diesen drei fachlichen Feldern auf; cable_types dient nur als STIL-Vorbild
-- (Audit-Trigger, RLS-Formulierung, Grant-Stil), nicht als woertliche
-- Spaltenkopie. Die Sortierung in den Pflegeseiten erfolgt deshalb wie bei
-- den uebrigen namensbasierten Katalogen (technicians, teams, contacts)
-- alphabetisch nach label und nicht ueber eine eigene Sortierspalte.
--
-- IDENTITAETSQUELLE: seit 0012_ap14b_platform_auth.sql:9-29 ist
-- app.current_user_id() die wirksame Identitaetsquelle (STABLE, kein
-- SECURITY DEFINER, app_user besitzt EXECUTE). auth.uid() existiert seit
-- 0013_ap14b_drop_supabase_compat.sql:41-42 (`drop schema if exists auth
-- cascade`) NICHT MEHR - ein woertliches auth.uid() in dieser Migration
-- wuerde mit "schema auth does not exist" abbrechen. Das Laufzeit-Rewrite aus
-- 0012 (Abschnitt "Direkte Policy-Bezuege portieren" u. a.) lief EINMALIG beim
-- Anwenden von 0012 gegen die zu diesem Zeitpunkt vorhandenen Objekte und
-- wird durch spaetere Migrationen nicht erneut ausgeloest - jede hier NEU
-- geschriebene Policy, jeder neue Spalten-Default und jeder neue Trigger
-- verwenden app.current_user_id() deshalb von Hand.
-- public.tg_touch_updated() und public.tg_audit() (0001_init.sql:81-97,
-- 0007_ap9_master_data.sql:181-218) sowie public.is_staff()/is_admin()/
-- current_user_role() (0001_init.sql:52-65) werden UNVERAENDERT
-- wiederverwendet: ihr in der Datenbank installierter Funktionskoerper nutzt
-- dank des Rewrites aus 0012 bereits app.current_user_id(), obwohl ihr
-- Quelltext in 0001/0007 weiterhin auth.uid() zeigt.
--
-- created_by/updated_by verweisen bei NEUEN Tabellen seit 0012 nicht mehr auf
-- das entfernte auth.users, sondern auf public.profiles(id) - siehe
-- 0012_ap14b_platform_auth.sql, Abschnitt "Alle historischen Fremdschluessel
-- auf auth.users werden umgehaengt".
--
-- RLS-Policies exakt nach dem Muster der bestehenden Stammdatentabellen:
-- lesen darf jeder Angemeldete (using (app.current_user_id() is not null),
-- wie cable_types_select vor dem Rewrite `auth.uid() is not null` lautete),
-- schreiben (insert/update/delete auf Policy-Ebene) darf ausschliesslich
-- Staff (is_staff() = admin oder disponent, 0001_init.sql:63-65) - identisch
-- zu cable_types_write. Tabellenrechte fuer app_user sind unten in Abschnitt 5
-- ABSICHTLICH enger als die Policy: KEIN delete (Deaktivierung laeuft ueber
-- is_active, exakt wie bei allen uebrigen Stammdatenkatalogen seit 0015,
-- Abschnitt 3 der Negativpruefung dort).
-- =====================================================================

set check_function_bodies = off;

-- ---------------------------------------------------------------------
-- 1) Katalog: Gewerke (public.trades)
--
-- Startwerte laut Auftrag (= Excel-Blatt "Gewerke & Kabeltypen",
-- ANFORDERUNG_DISPO_METADATEN.md:20-21): 50 Hz, LST, TK, OSE, LWL-LST,
-- LWL-TK, Unbekannt.
-- ---------------------------------------------------------------------
create table if not exists public.trades (
  id uuid primary key default gen_random_uuid(),
  label text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid default app.current_user_id() references public.profiles(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id)
);

create or replace trigger trg_touch_trades before update on public.trades
  for each row execute function public.tg_touch_updated();
create or replace trigger trg_audit_trades
  after insert or update or delete on public.trades
  for each row execute function public.tg_audit();

alter table public.trades enable row level security;

-- Einzel-Policy-Guard (Stil aus 0008_ap10_incident_master_data.sql:58-68 und
-- 0006_ap6_sync_idempotency.sql:30-44) statt des Bulk-Loops aus
-- 0007_ap9_master_data.sql: diese Migration fuehrt genau drei neue Tabellen
-- ein, kein Sammel-Array vieler Bestandstabellen.
do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'trades' and policyname = 'trades_select'
  ) then
    create policy trades_select on public.trades for select
      using (app.current_user_id() is not null);
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'trades' and policyname = 'trades_write'
  ) then
    create policy trades_write on public.trades for all
      using (public.is_staff()) with check (public.is_staff());
  end if;
end $$;

-- Seed idempotent ueber die unique-Bedingung auf label - kein separater
-- Existenz-Select noetig, `on conflict` deckt sowohl den Erstlauf als auch
-- einen Reparaturlauf ab.
insert into public.trades (label) values
  ('50 Hz'),
  ('LST'),
  ('TK'),
  ('OSE'),
  ('LWL-LST'),
  ('LWL-TK'),
  ('Unbekannt')
on conflict (label) do nothing;

-- ---------------------------------------------------------------------
-- 2) Katalog: Funktionen des Anrufenden/Ansprechpartners
-- (public.contact_functions)
--
-- Startwerte laut Auftrag: BÜW, LBÜW, örtl. LST.
-- ---------------------------------------------------------------------
create table if not exists public.contact_functions (
  id uuid primary key default gen_random_uuid(),
  label text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid default app.current_user_id() references public.profiles(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id)
);

create or replace trigger trg_touch_contact_functions before update on public.contact_functions
  for each row execute function public.tg_touch_updated();
create or replace trigger trg_audit_contact_functions
  after insert or update or delete on public.contact_functions
  for each row execute function public.tg_audit();

alter table public.contact_functions enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'contact_functions' and policyname = 'contact_functions_select'
  ) then
    create policy contact_functions_select on public.contact_functions for select
      using (app.current_user_id() is not null);
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'contact_functions' and policyname = 'contact_functions_write'
  ) then
    create policy contact_functions_write on public.contact_functions for all
      using (public.is_staff()) with check (public.is_staff());
  end if;
end $$;

insert into public.contact_functions (label) values
  ('BÜW'),
  ('LBÜW'),
  ('örtl. LST')
on conflict (label) do nothing;

-- ---------------------------------------------------------------------
-- 3) Katalog: Objektarten (Anlagen, inkl. LST-Elemente)
-- (public.object_types)
--
-- Startwerte laut Auftrag: BÜ, LSW.
-- ---------------------------------------------------------------------
create table if not exists public.object_types (
  id uuid primary key default gen_random_uuid(),
  label text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid default app.current_user_id() references public.profiles(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id)
);

create or replace trigger trg_touch_object_types before update on public.object_types
  for each row execute function public.tg_touch_updated();
create or replace trigger trg_audit_object_types
  after insert or update or delete on public.object_types
  for each row execute function public.tg_audit();

alter table public.object_types enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'object_types' and policyname = 'object_types_select'
  ) then
    create policy object_types_select on public.object_types for select
      using (app.current_user_id() is not null);
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'object_types' and policyname = 'object_types_write'
  ) then
    create policy object_types_write on public.object_types for all
      using (public.is_staff()) with check (public.is_staff());
  end if;
end $$;

insert into public.object_types (label) values
  ('BÜ'),
  ('LSW')
on conflict (label) do nothing;

-- ---------------------------------------------------------------------
-- 4) contacts.function_id - Funktion am Ansprechpartner
--
-- Nullable, FK auf den neuen Funktionen-Katalog, `on delete` NICHT
-- kaskadierend: ohne explizite `on delete`-Klausel erzwingt PostgreSQL
-- ON DELETE NO ACTION (dasselbe Muster wie
-- construction_stages.default_on_call_number_id,
-- 0007_ap9_master_data.sql:165, und technicians.profile_id,
-- 0007_ap9_master_data.sql:115 - beide nullable FK ohne on-delete-Klausel).
-- Ein spaeteres Loeschen einer Funktion aus dem Eigentuemerkontext waere damit
-- abgewiesen, solange ein Ansprechpartner sie noch traegt; ueber die
-- Anwendungsrolle app_user ist ein delete auf public.contact_functions
-- ohnehin nicht moeglich (Abschnitt 5 unten) - die Deaktivierung laeuft
-- fachlich ausschliesslich ueber is_active.
--
-- Idempotenz im Stil von 0018 Abschnitt 1 (`add column if not exists`):
-- anders als 0018 Abschnitt 1 (dort NOT NULL DEFAULT false mit Backfill-
-- Pflicht bei einem VORLAUF-Fund) ist diese Spalte nullable OHNE Default -
-- ein VORLAUF-Fund mit exakt diesem Zieltyp waere bereits im Zielzustand, ein
-- uebersprungenes `add column if not exists` haette hier also keine der
-- Nebenwirkungen, die 0018 zu den Schritten 1c-1e zwingen. Ein einzelner
-- guarded `add column if not exists` genuegt.
-- Bestehendes Freitextfeld contacts."function" (0007_ap9_master_data.sql:73)
-- bleibt UNVERAENDERT bestehen - diese Migration ergaenzt eine zweite,
-- unabhaengige Spalte und ersetzt die bestehende nicht.
alter table public.contacts
  add column if not exists function_id uuid references public.contact_functions(id);

comment on column public.contacts.function_id is
  'AUFTRAG_6: optionale Verknuepfung auf den pflegbaren Funktionen-Katalog '
  '(public.contact_functions). Ergaenzt das bestehende Freitextfeld '
  '"function" und ersetzt es nicht.';

-- ---------------------------------------------------------------------
-- 5) Grants - ausschliesslich app_user, objektgenau, additiv
--
-- select/insert/update wie bei jedem uebrigen Stammdatenkatalog seit 0015;
-- ausdruecklich KEIN delete - Deaktivierung laeuft ueber is_active (0015,
-- Abschnitt 3 der dortigen Negativpruefung, hier identisch fortgeschrieben).
-- Kein `grant` an public, anon oder authenticated.
-- ---------------------------------------------------------------------
grant select, insert, update on public.trades to app_user;
grant select, insert, update on public.contact_functions to app_user;
grant select, insert, update on public.object_types to app_user;

-- ---------------------------------------------------------------------
-- 6) Abschlusspruefung (fail-closed, Stil aus 0014/0015)
--
-- Positiv: jedes oben erteilte Recht muss tatsaechlich vorhanden sein.
-- Negativ: delete darf app_user auf keiner der drei neuen Tabellen besitzen -
-- auch nicht mittelbar ueber eine Gruppenrolle, denn has_table_privilege
-- beruecksichtigt die Rollenmitgliedschaft.
-- ---------------------------------------------------------------------
do $$
declare
  item record;
  missing text[] := array[]::text[];
begin
  for item in
    select * from (values
      ('public.trades', 'select'),
      ('public.trades', 'insert'),
      ('public.trades', 'update'),
      ('public.contact_functions', 'select'),
      ('public.contact_functions', 'insert'),
      ('public.contact_functions', 'update'),
      ('public.object_types', 'select'),
      ('public.object_types', 'insert'),
      ('public.object_types', 'update')
    ) as t(object_name, privilege)
  loop
    if not has_table_privilege('app_user', item.object_name, item.privilege) then
      missing := array_append(missing, item.object_name || ' ' || item.privilege);
    end if;
  end loop;

  if array_length(missing, 1) is not null then
    raise exception
      'AUFTRAG_6/0019: app_user fehlt/fehlen die Tabellenrecht(e): %',
      array_to_string(missing, ', ');
  end if;
end
$$;

do $$
declare
  item record;
  unexpected text[] := array[]::text[];
begin
  for item in
    select * from (values
      ('public.trades', 'delete'),
      ('public.contact_functions', 'delete'),
      ('public.object_types', 'delete')
    ) as t(object_name, privilege)
  loop
    if has_table_privilege('app_user', item.object_name, item.privilege) then
      unexpected := array_append(unexpected, item.object_name || ' ' || item.privilege);
    end if;
  end loop;

  if array_length(unexpected, 1) is not null then
    raise exception
      'AUFTRAG_6/0019: app_user besitzt unerwartete Tabellenrecht(e): %',
      array_to_string(unexpected, ', ');
  end if;
end
$$;

-- Katalogpruefung: RLS aktiv auf allen drei neuen Tabellen, je zwei Policies
-- (select, write) vorhanden. Ohne diese Pruefung waere ein vergessenes
-- `enable row level security` oder ein durch einen fehlgeschlagenen Guard
-- ausgebliebenes `create policy` erst zur Laufzeit sichtbar.
do $$
declare
  item record;
  bad text[] := array[]::text[];
  v_rls boolean;
  v_policies integer;
begin
  for item in
    select * from (values
      ('trades'),
      ('contact_functions'),
      ('object_types')
    ) as t(table_name)
  loop
    select c.relrowsecurity into v_rls
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = item.table_name;

    if v_rls is distinct from true then
      bad := array_append(bad, item.table_name || ' (RLS nicht aktiv)');
    end if;

    select count(*) into v_policies
    from pg_policies
    where schemaname = 'public' and tablename = item.table_name;

    if v_policies <> 2 then
      bad := array_append(bad, item.table_name || format(' (%s statt 2 Policies)', v_policies));
    end if;
  end loop;

  if array_length(bad, 1) is not null then
    raise exception
      'AUFTRAG_6/0019: RLS-/Policy-Zustand fehlerhaft: %', array_to_string(bad, ', ');
  end if;
end
$$;

-- Seed-Pruefung: mindestens die im Auftrag genannten Startwerte bestehen.
-- `>=` statt `=`, damit ein spaeter durch die Dispo ergaenzter Wert die
-- Migration nicht kuenftig scheitern laesst.
do $$
declare
  v_trades integer;
  v_functions integer;
  v_objects integer;
begin
  select count(*) into v_trades from public.trades
   where label in ('50 Hz','LST','TK','OSE','LWL-LST','LWL-TK','Unbekannt');
  select count(*) into v_functions from public.contact_functions
   where label in ('BÜW','LBÜW','örtl. LST');
  select count(*) into v_objects from public.object_types
   where label in ('BÜ','LSW');

  if v_trades <> 7 then
    raise exception 'AUFTRAG_6/0019: % von 7 Gewerke-Startwerten vorhanden', v_trades;
  end if;
  if v_functions <> 3 then
    raise exception 'AUFTRAG_6/0019: % von 3 Funktionen-Startwerten vorhanden', v_functions;
  end if;
  if v_objects <> 2 then
    raise exception 'AUFTRAG_6/0019: % von 2 Objektarten-Startwerten vorhanden', v_objects;
  end if;
end
$$;

-- Fremdschluesselpruefung: contacts.function_id ist NICHT kaskadierend
-- (confdeltype 'a' = NO ACTION bzw. 'r' = RESTRICT; kaskadierend waere 'c').
do $$
declare
  v_confdeltype "char";
begin
  select con.confdeltype into v_confdeltype
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_namespace ns on ns.oid = rel.relnamespace
  join pg_attribute att on att.attrelid = con.conrelid and att.attnum = any(con.conkey)
  where ns.nspname = 'public' and rel.relname = 'contacts'
    and con.contype = 'f' and att.attname = 'function_id';

  if v_confdeltype is null then
    raise exception 'AUFTRAG_6/0019: kein Fremdschluessel auf contacts.function_id gefunden';
  end if;
  if v_confdeltype = 'c' then
    raise exception 'AUFTRAG_6/0019: contacts.function_id ist entgegen dem Auftrag kaskadierend (ON DELETE CASCADE)';
  end if;
end
$$;

-- =====================================================================
-- Ende Migration 0019
-- =====================================================================
