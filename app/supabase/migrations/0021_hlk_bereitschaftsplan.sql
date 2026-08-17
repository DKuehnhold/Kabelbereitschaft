-- =====================================================================
-- Kabelbereitschaft – AUFTRAG_10 (Migration 0021): Bereitschaftsplan
-- (Einsatzplanung) – wer hat wann je Bauabschnitt Bereitschaft.
--
-- Grundlage: 00-Projektsteuerung/AUFTRAG_10.md, Excel-Blatt "Einsatzplanung"
-- (Matrix Bauabschnitt x Kalendertag mit Mitarbeitern,
-- 99-Anlagen/Bereitschaftsuebersicht_...xlsx) und Entscheidung Dennis
-- (Bereitschaftsplan nach Erfassung + Liste, vor Disponentenansicht).
-- Additiv zu 0001-0020, keine bestehende Definition wird entfernt, keine
-- bestehende Policy geloest oder gelockert.
--
-- FACHLICHE FORM (wortgetreu aus dem Auftrag): EINE Tabelle
-- public.on_call_plan bildet je Zeile GENAU EINE Zuweisung "dieser Techniker
-- hat an diesem Kalendertag fuer diesen Bauabschnitt Bereitschaft" ab. Mehrere
-- Personen je Bauabschnitt/Tag sind ausdruecklich zulaessig (wie in der
-- Excel-Matrix, in der mehrere Namen in derselben Zelle stehen koennen) - die
-- Unique-Bedingung verhindert deshalb nur die exakt DOPPELTE Zuweisung
-- derselben Person am selben Tag/Bauabschnitt, nicht mehrere verschiedene
-- Personen.
--
-- ZUWEISUNGEN WERDEN ENTFERNT, NICHT DEAKTIVIERT - anders als die Kataloge
-- aus 0019: eine Bereitschaftszuweisung ist kein Stammdatensatz mit einer
-- Lebensdauer (wie ein Gewerk oder eine Funktion), sondern ein reiner
-- Planungszustand fuer einen einzelnen Tag. "Diese Person hat an diesem Tag
-- KEINE Bereitschaft mehr" bedeutet fachlich, dass die Zeile nicht mehr
-- existiert - ein is_active-Flag haette hier keine Bedeutung, weil niemand
-- eine inaktive Tageszuweisung jemals wieder aktivieren wollen wuerde. Ein
-- `update` ist aus demselben Grund fachlich nicht noetig: eine Zuweisung wird
-- entweder neu angelegt oder entfernt, nie "umgeschrieben" (ein Wechsel des
-- Technikers an einem Tag/Bauabschnitt ist ein delete + insert, kein Feldwert-
-- wechsel an einer bestehenden Zeile). Deshalb gibt es fuer diese Tabelle
-- WEDER eine update-Policy NOCH ein update-Tabellenrecht - anders als bei den
-- Katalogen aus 0019 (dort select/insert/update, kein delete), hier
-- select/insert/DELETE, KEIN update. Der Audit-Trigger (siehe unten)
-- protokolliert das delete vollstaendig (detail.old traegt die geloeschte
-- Zeile) - eine geloeschte Zuweisung ist damit nicht spurlos, nur nicht mehr
-- Teil des aktuellen Plans.
--
-- IDENTITAETSQUELLE seit 0012/0013: app.current_user_id() statt auth.uid()
-- (siehe ausfuehrliche Begruendung in 0019, Kopfkommentar). created_by/
-- updated_by verweisen bei dieser NEUEN Tabelle auf public.profiles(id), nicht
-- auf das entfernte auth.users (0012, Abschnitt "Alle historischen
-- Fremdschluessel auf auth.users werden umgehaengt").
--
-- FKs NICHT KASKADIEREND (wie construction_stages.default_on_call_number_id
-- und technicians.profile_id, 0007_ap9_master_data.sql, sowie
-- contacts.function_id und incidents.trade_id/caller_contact_id, 0019/0020):
-- weder `construction_stage_id` noch `technician_id` tragen eine
-- `on delete`-Klausel, was PostgreSQL implizit als ON DELETE NO ACTION
-- auslegt. Ein Loeschversuch eines Bauabschnitts oder Technikers, der noch in
-- einer Planzeile referenziert wird, wird damit abgewiesen statt die
-- Planzeile stillschweigend zu entfernen oder ihren Verweis auf NULL zu
-- setzen.
--
-- RLS: select fuer jeden Angemeldeten (wie jede Stammdatentabelle seit 0019 -
-- ein Monteur muss den Plan lesen koennen, auch wenn er nicht schreiben darf).
-- insert/delete ausschliesslich fuer Staff (is_staff() = admin oder
-- disponent, 0001_init.sql:63-65) - der Monteur sieht den Plan read-only.
-- =====================================================================

set check_function_bodies = off;

-- ---------------------------------------------------------------------
-- 1) Tabelle: public.on_call_plan
-- ---------------------------------------------------------------------
create table if not exists public.on_call_plan (
  id uuid primary key default gen_random_uuid(),
  construction_stage_id uuid not null references public.construction_stages(id),
  plan_date date not null,
  technician_id uuid not null references public.technicians(id),
  created_at timestamptz not null default now(),
  created_by uuid default app.current_user_id() references public.profiles(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id),
  constraint on_call_plan_stage_date_tech_uq unique (construction_stage_id, plan_date, technician_id)
);

create index if not exists idx_on_call_plan_date on public.on_call_plan(plan_date);
create index if not exists idx_on_call_plan_stage on public.on_call_plan(construction_stage_id);
create index if not exists idx_on_call_plan_technician on public.on_call_plan(technician_id);

comment on table public.on_call_plan is
  'AUFTRAG_10: Bereitschaftsplan (Einsatzplanung). Eine Zeile = ein Techniker '
  'hat an einem Kalendertag fuer einen Bauabschnitt Bereitschaft. Mehrere '
  'Personen je Bauabschnitt/Tag sind zulaessig (wie in der Excel-Matrix); die '
  'Unique-Bedingung verhindert nur die doppelte Zuweisung derselben Person. '
  'Zuweisungen werden bei Aenderung ENTFERNT statt deaktiviert - es gibt '
  'bewusst kein is_active und kein update (weder Policy noch Tabellenrecht).';

-- trg_touch_updated bleibt fachlich wirkungslos (kein update-Pfad existiert),
-- wird aber wie bei jeder Bestandstabelle mit updated_at angelegt: sie ist
-- Teil des einheitlichen Musters ("Audit-Spalten/Trigger wie Bestand" laut
-- Auftrag) und macht die Tabelle robust, falls ein spaeterer, heute nicht
-- vorgesehener Korrekturpfad (z. B. eine kuenftige administrative Korrektur)
-- doch einmal ein update braucht.
create or replace trigger trg_touch_on_call_plan before update on public.on_call_plan
  for each row execute function public.tg_touch_updated();
create or replace trigger trg_audit_on_call_plan
  after insert or update or delete on public.on_call_plan
  for each row execute function public.tg_audit();

alter table public.on_call_plan enable row level security;

-- ---------------------------------------------------------------------
-- 2) RLS-Policies: select fuer jeden Angemeldeten, insert/delete fuer Staff.
--    DREI Einzel-Policies statt der ueblichen zwei (select/write "for all")
--    aus 0019: PostgreSQL erlaubt pro Policy genau EIN Kommando, und diese
--    Tabelle braucht insert UND delete, aber ausdruecklich KEIN update - eine
--    "for all"-Policy wuerde update auf Policy-Ebene mit erlauben, selbst wenn
--    dafuer (wie hier gewollt) kein Tabellenrecht vergeben wird.
-- ---------------------------------------------------------------------
do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'on_call_plan' and policyname = 'on_call_plan_select'
  ) then
    create policy on_call_plan_select on public.on_call_plan for select
      using (app.current_user_id() is not null);
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'on_call_plan' and policyname = 'on_call_plan_insert'
  ) then
    create policy on_call_plan_insert on public.on_call_plan for insert
      with check (public.is_staff());
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'on_call_plan' and policyname = 'on_call_plan_delete'
  ) then
    create policy on_call_plan_delete on public.on_call_plan for delete
      using (public.is_staff());
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 3) Grants – ausschliesslich app_user, objektgenau, additiv.
--
-- select/insert/delete – AUSNAHMSWEISE delete (begruendet im Kopfkommentar
-- oben: eine Zuweisungszeile ist keine Historie, sondern Planungszustand; der
-- Audit-Trigger protokolliert das delete vollstaendig). Ausdruecklich KEIN
-- update: fachlich nicht noetig (siehe Kopfkommentar), daher weder
-- Policy-Bedarf noch Grant dafuer. Kein `grant` an public, anon oder
-- authenticated.
-- ---------------------------------------------------------------------
grant select, insert, delete on public.on_call_plan to app_user;

-- ---------------------------------------------------------------------
-- 4) Abschlusspruefungen (fail-closed, Stil aus 0019/0020)
-- ---------------------------------------------------------------------

-- 4a) Tabellenrechte: select/insert/delete vorhanden, update NICHT vorhanden.
do $$
declare
  item record;
  missing text[] := array[]::text[];
begin
  for item in
    select * from (values
      ('public.on_call_plan', 'select'),
      ('public.on_call_plan', 'insert'),
      ('public.on_call_plan', 'delete')
    ) as t(object_name, privilege)
  loop
    if not has_table_privilege('app_user', item.object_name, item.privilege) then
      missing := array_append(missing, item.object_name || ' ' || item.privilege);
    end if;
  end loop;

  if array_length(missing, 1) is not null then
    raise exception
      'AUFTRAG_10/0021: app_user fehlt/fehlen die Tabellenrecht(e): %',
      array_to_string(missing, ', ');
  end if;
end
$$;

do $$
begin
  if has_table_privilege('app_user', 'public.on_call_plan', 'update') then
    raise exception
      'AUFTRAG_10/0021: app_user besitzt entgegen dem Auftrag ein update-Tabellenrecht auf public.on_call_plan';
  end if;
end
$$;

-- 4b) RLS aktiv, genau drei Policies (select/insert/delete).
do $$
declare
  v_rls boolean;
  v_policies integer;
begin
  select c.relrowsecurity into v_rls
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relname = 'on_call_plan';

  if v_rls is distinct from true then
    raise exception 'AUFTRAG_10/0021: RLS ist auf public.on_call_plan nicht aktiv';
  end if;

  select count(*) into v_policies
  from pg_policies
  where schemaname = 'public' and tablename = 'on_call_plan';

  if v_policies <> 3 then
    raise exception
      'AUFTRAG_10/0021: public.on_call_plan traegt % statt 3 Policies (select/insert/delete)',
      v_policies;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'on_call_plan'
      and policyname = 'on_call_plan_select' and cmd = 'SELECT'
  ) then
    raise exception 'AUFTRAG_10/0021: on_call_plan_select fehlt oder ist nicht auf SELECT beschraenkt';
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'on_call_plan'
      and policyname = 'on_call_plan_insert' and cmd = 'INSERT'
  ) then
    raise exception 'AUFTRAG_10/0021: on_call_plan_insert fehlt oder ist nicht auf INSERT beschraenkt';
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'on_call_plan'
      and policyname = 'on_call_plan_delete' and cmd = 'DELETE'
  ) then
    raise exception 'AUFTRAG_10/0021: on_call_plan_delete fehlt oder ist nicht auf DELETE beschraenkt';
  end if;
end
$$;

-- 4c) Fremdschluesselpruefung: construction_stage_id und technician_id sind
--     NICHT kaskadierend (confdeltype 'a' = NO ACTION bzw. 'r' = RESTRICT;
--     kaskadierend waere 'c').
do $$
declare
  v_confdeltype "char";
begin
  select con.confdeltype into v_confdeltype
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_namespace ns on ns.oid = rel.relnamespace
  join pg_attribute att on att.attrelid = con.conrelid and att.attnum = any(con.conkey)
  where ns.nspname = 'public' and rel.relname = 'on_call_plan'
    and con.contype = 'f' and att.attname = 'construction_stage_id';

  if v_confdeltype is null then
    raise exception 'AUFTRAG_10/0021: kein Fremdschluessel auf on_call_plan.construction_stage_id gefunden';
  end if;
  if v_confdeltype = 'c' then
    raise exception
      'AUFTRAG_10/0021: on_call_plan.construction_stage_id ist entgegen dem Auftrag kaskadierend (ON DELETE CASCADE)';
  end if;
end
$$;

do $$
declare
  v_confdeltype "char";
begin
  select con.confdeltype into v_confdeltype
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_namespace ns on ns.oid = rel.relnamespace
  join pg_attribute att on att.attrelid = con.conrelid and att.attnum = any(con.conkey)
  where ns.nspname = 'public' and rel.relname = 'on_call_plan'
    and con.contype = 'f' and att.attname = 'technician_id';

  if v_confdeltype is null then
    raise exception 'AUFTRAG_10/0021: kein Fremdschluessel auf on_call_plan.technician_id gefunden';
  end if;
  if v_confdeltype = 'c' then
    raise exception
      'AUFTRAG_10/0021: on_call_plan.technician_id ist entgegen dem Auftrag kaskadierend (ON DELETE CASCADE)';
  end if;
end
$$;

-- 4d) Unique-Bedingung (construction_stage_id, plan_date, technician_id)
--     tatsaechlich vorhanden.
do $$
declare
  v_count integer;
begin
  select count(*) into v_count
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_namespace ns on ns.oid = rel.relnamespace
  where ns.nspname = 'public' and rel.relname = 'on_call_plan'
    and con.conname = 'on_call_plan_stage_date_tech_uq' and con.contype = 'u';

  if v_count <> 1 then
    raise exception
      'AUFTRAG_10/0021: die Unique-Bedingung on_call_plan_stage_date_tech_uq fehlt auf public.on_call_plan';
  end if;
end
$$;

-- =====================================================================
-- Ende Migration 0021
-- =====================================================================
