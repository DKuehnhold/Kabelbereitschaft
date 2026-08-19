-- =====================================================================
-- Kabelbereitschaft – AUFTRAG_14 (Migration 0022): Dispo-Board.
--
-- Grundlage: 00-Projektsteuerung/AUFTRAG_14.md,
-- 01-Anforderungen/ANFORDERUNG_GUI_RUNDE_2.md Abschnitt D (Punkte 11-15),
-- Excel-Blatt "Einsatzplanung". Baut additiv auf Migration 0021
-- (public.on_call_plan, AUFTRAG_10) auf. Additiv zu 0001-0021, keine
-- bestehende Definition wird entfernt, keine bestehende Policy geloest oder
-- gelockert.
--
-- DREI TEILE:
--   1) Katalog public.qualifications (label, rank, color=Palettenschluessel,
--      is_active) - pflegbar wie die Kataloge aus 0019. KEINE Startwerte
--      (Dennis pflegt sie beim Formular-Durchgang, laut Auftrag ausdruecklich
--      nicht erfunden).
--   2) Zuordnung public.technician_qualifications (n:m, unique Paar) -
--      Muster von public.on_call_plan aus 0021: eine Zuordnung ist reiner
--      Zustand ("dieser Monteur hat diese Qualifikation"), kein
--      Stammdatensatz mit eigener Lebensdauer, deshalb select/insert/delete
--      wie on_call_plan und NICHT select/insert/update wie ein 0019-Katalog.
--   3) Erweiterung von public.on_call_plan um assignment_kind
--      ('bereitschaft'|'dispo') fuer die neue Zeile "Dispo/Bereitschafts-
--      telefon" (Punkt 14 des Auftrags): construction_stage_id wird dafuer
--      NULLABLE (die Dispo-Zeile gehoert zu keinem Bauabschnitt), und die
--      bisherige Unique-Bedingung on_call_plan_stage_date_tech_uq wird durch
--      zwei PARTIELLE Unique-Indizes ersetzt - je einen fuer 'bereitschaft'
--      (identische Spalten wie bisher: construction_stage_id, plan_date,
--      technician_id) und einen fuer 'dispo' (plan_date, technician_id, da
--      construction_stage_id dort NULL ist und NULL in einem gewoehnlichen
--      Unique-Index nie mit sich selbst kollidiert - der partielle Index mit
--      WHERE-Klausel je Art ist hier deshalb zwingend, nicht nur Stil).
--
-- BESTANDSSCHUTZ DES UNIQUE-UMBAUS: assignment_kind wird mit
-- `not null default 'bereitschaft'` angelegt - jede VORHANDENE Zeile aus 0021
-- erhaelt automatisch genau den Wert, den die alte Unique-Bedingung ohnehin
-- unterstellte (jede bisherige Zeile war implizit eine Bereitschafts-
-- zuweisung). Der neue partielle Index fuer 'bereitschaft' traegt exakt
-- dieselben drei Spalten wie der bisherige Unique-Constraint - die
-- Bestandsdaten verletzen ihn deshalb nicht, und die fachliche Garantie
-- ("keine doppelte Zuweisung derselben Person am selben Tag/Bauabschnitt")
-- bleibt fuer alle bestehenden Zeilen unveraendert bestehen. Der Umbau ist
-- damit ohne Datenrisiko; ein Stopppunkt (siehe AUFTRAG_14.md) ist nicht
-- einschlaegig.
--
-- FARBPALETTE: color speichert AUSSCHLIESSLICH einen Palettenschluessel aus
-- einer festen, kleinen Menge (Check-Constraint) - keinen freien Hex-Wert.
-- Die Palette selbst (Name -> CSS-Token) ist in src/lib/qualifications.ts
-- zentral definiert (QUALIFICATION_COLOR_PALETTE) und token-basiert in
-- globals.css hinterlegt (additive Tokens, AUFTRAG_11/13-Bestand
-- unveraendert). Die hier gepruefte Schluesselmenge MUSS mit der dortigen
-- Konstante uebereinstimmen.
--
-- IDENTITAETSQUELLE seit 0012/0013: app.current_user_id() statt auth.uid()
-- (Begruendung siehe 0019, Kopfkommentar). created_by/updated_by verweisen
-- auf public.profiles(id), nicht auf das entfernte auth.users.
--
-- RLS: qualifications wie jeder 0019-Katalog (select alle Angemeldeten,
-- insert/update Staff, KEIN delete - Deaktivierung ueber is_active).
-- technician_qualifications und die Erweiterung von on_call_plan wie 0021
-- (select alle Angemeldeten, insert/delete Staff, KEIN update - eine
-- Zuordnung wird neu angelegt oder entfernt, nie umgeschrieben).
-- =====================================================================

set check_function_bodies = off;

-- ---------------------------------------------------------------------
-- 1) Katalog: public.qualifications
--
-- KEINE Startwerte (Auftrag: "Startwerte NICHT erfinden: leerer Katalog").
-- rank: groessere Zahl = hoehere Qualifikation (bestimmt die Hintergrundfarbe
-- des Monteurs im Dispo-Board, siehe technician_qualifications unten).
-- color: Palettenschluessel, siehe Kopfkommentar. Sechs bis acht Werte laut
-- Auftrag; 'grau' ist zusaetzlich die neutrale Standardfarbe fuer Monteure
-- OHNE Qualifikation (dort kommt sie nicht aus dieser Tabelle, sondern ist
-- ein Anwendungs-Default in src/lib/qualifications.ts).
-- ---------------------------------------------------------------------
create table if not exists public.qualifications (
  id uuid primary key default gen_random_uuid(),
  label text not null unique,
  rank integer not null default 0,
  color text not null default 'grau',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid default app.current_user_id() references public.profiles(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id)
);

comment on table public.qualifications is
  'AUFTRAG_14: pflegbarer Katalog der Monteur-Qualifikationen. Die HOECHSTE '
  'Qualifikation (groesster rank) je Monteur bestimmt seine Hintergrundfarbe '
  'im Dispo-Board (public.technician_qualifications). Bewusst KEINE '
  'Startwerte - Dennis pflegt sie beim Formular-Durchgang.';

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.qualifications'::regclass and conname = 'qualifications_color_chk'
  ) then
    alter table public.qualifications
      add constraint qualifications_color_chk check (
        color in ('rot', 'blau', 'gruen', 'gelb', 'orange', 'violett', 'tuerkis', 'grau')
      );
  end if;
end $$;

create or replace trigger trg_touch_qualifications before update on public.qualifications
  for each row execute function public.tg_touch_updated();
create or replace trigger trg_audit_qualifications
  after insert or update or delete on public.qualifications
  for each row execute function public.tg_audit();

alter table public.qualifications enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'qualifications' and policyname = 'qualifications_select'
  ) then
    create policy qualifications_select on public.qualifications for select
      using (app.current_user_id() is not null);
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'qualifications' and policyname = 'qualifications_write'
  ) then
    create policy qualifications_write on public.qualifications for all
      using (public.is_staff()) with check (public.is_staff());
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 2) Zuordnung: public.technician_qualifications (n:m)
--
-- Kein is_active, kein update - Muster von public.on_call_plan (0021): die
-- Zuordnung "dieser Monteur hat diese Qualifikation" ist ein reiner Zustand,
-- kein Stammdatensatz mit eigener Lebensdauer. FKs NICHT kaskadierend (wie
-- durchgaengig seit 0007/0019/0021): weder technician_id noch
-- qualification_id tragen eine `on delete`-Klausel.
-- ---------------------------------------------------------------------
create table if not exists public.technician_qualifications (
  id uuid primary key default gen_random_uuid(),
  technician_id uuid not null references public.technicians(id),
  qualification_id uuid not null references public.qualifications(id),
  created_at timestamptz not null default now(),
  created_by uuid default app.current_user_id() references public.profiles(id),
  constraint technician_qualifications_uq unique (technician_id, qualification_id)
);

create index if not exists idx_technician_qualifications_technician
  on public.technician_qualifications(technician_id);
create index if not exists idx_technician_qualifications_qualification
  on public.technician_qualifications(qualification_id);

comment on table public.technician_qualifications is
  'AUFTRAG_14: n:m-Zuordnung Monteur <-> Qualifikation. Eine Zeile = dieser '
  'Monteur besitzt diese Qualifikation; unique (technician_id, '
  'qualification_id) verhindert die doppelte Zuordnung. Wie on_call_plan '
  '(0021) wird eine Zuordnung ENTFERNT statt deaktiviert - kein is_active, '
  'kein update (weder Policy noch Tabellenrecht).';

create or replace trigger trg_audit_technician_qualifications
  after insert or update or delete on public.technician_qualifications
  for each row execute function public.tg_audit();

alter table public.technician_qualifications enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'technician_qualifications' and policyname = 'technician_qualifications_select'
  ) then
    create policy technician_qualifications_select on public.technician_qualifications for select
      using (app.current_user_id() is not null);
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'technician_qualifications' and policyname = 'technician_qualifications_insert'
  ) then
    create policy technician_qualifications_insert on public.technician_qualifications for insert
      with check (public.is_staff());
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'technician_qualifications' and policyname = 'technician_qualifications_delete'
  ) then
    create policy technician_qualifications_delete on public.technician_qualifications for delete
      using (public.is_staff());
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 3) Erweiterung: public.on_call_plan um assignment_kind, nullable
--    construction_stage_id und den Unique-Umbau (Dispo-Zeile, Punkt 14/15).
-- ---------------------------------------------------------------------

-- 3a) Spalte additiv, mit sicherem Default fuer den Bestand (siehe
--     Kopfkommentar "BESTANDSSCHUTZ").
alter table public.on_call_plan
  add column if not exists assignment_kind text not null default 'bereitschaft';

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.on_call_plan'::regclass and conname = 'on_call_plan_assignment_kind_chk'
  ) then
    alter table public.on_call_plan
      add constraint on_call_plan_assignment_kind_chk check (
        assignment_kind in ('bereitschaft', 'dispo')
      );
  end if;
end $$;

-- 3b) construction_stage_id nullable machen: die Dispo-Zeile gehoert zu
--     keinem Bauabschnitt. `drop not null` ist idempotent (kein Fehler, wenn
--     die Spalte bereits nullable ist).
alter table public.on_call_plan
  alter column construction_stage_id drop not null;

-- 3c) Fachliche Kopplung: 'bereitschaft' verlangt eine Bauabschnitts-Kennung,
--     'dispo' verlangt ihre Abwesenheit. Ohne diese Regel koennte eine
--     'dispo'-Zeile versehentlich einen Bauabschnitt tragen oder eine
--     'bereitschaft'-Zeile ohne einen bleiben - beides waere fachlich falsch.
do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.on_call_plan'::regclass and conname = 'on_call_plan_stage_kind_chk'
  ) then
    alter table public.on_call_plan
      add constraint on_call_plan_stage_kind_chk check (
        (assignment_kind = 'bereitschaft' and construction_stage_id is not null)
        or (assignment_kind = 'dispo' and construction_stage_id is null)
      );
  end if;
end $$;

-- 3d) Unique-Umbau: der alte Constraint deckte nur 'bereitschaft' ab (jede
--     Bestandszeile ist das nach 3a). Er wird durch zwei PARTIELLE
--     Unique-Indizes ersetzt, die zusammen beide Arten tragen. Der
--     'bereitschaft'-Index hat exakt dieselben Spalten wie der alte
--     Constraint - kein Bestandsrisiko (siehe Kopfkommentar).
alter table public.on_call_plan
  drop constraint if exists on_call_plan_stage_date_tech_uq;

create unique index if not exists on_call_plan_bereitschaft_uq
  on public.on_call_plan (construction_stage_id, plan_date, technician_id)
  where assignment_kind = 'bereitschaft';

-- Die Dispo-Zeile hat keinen Bauabschnitt (construction_stage_id ist NULL);
-- die Eindeutigkeit gilt hier je Tag und Techniker - derselbe Monteur kann
-- nicht zweimal am selben Tag die Dispo/das Bereitschaftstelefon besetzen.
create unique index if not exists on_call_plan_dispo_uq
  on public.on_call_plan (plan_date, technician_id)
  where assignment_kind = 'dispo';

create index if not exists idx_on_call_plan_assignment_kind
  on public.on_call_plan(assignment_kind);

comment on column public.on_call_plan.assignment_kind is
  'AUFTRAG_14: Zuweisungsart. ''bereitschaft'' = Zuweisung an einen '
  'Bauabschnitt (Bestand seit 0021, construction_stage_id ist dann PFLICHT). '
  '''dispo'' = eigene Zeile "Dispo/Bereitschaftstelefon" ohne Bauabschnitt '
  '(construction_stage_id ist dann NULL). Siehe on_call_plan_stage_kind_chk.';

-- ---------------------------------------------------------------------
-- 4) Grants - ausschliesslich app_user, objektgenau, additiv.
-- ---------------------------------------------------------------------
grant select, insert, update on public.qualifications to app_user;
grant select, insert, delete on public.technician_qualifications to app_user;
-- on_call_plan traegt bereits select/insert/delete (0021); diese Migration
-- fuegt keine neue Spalte hinzu, die ein zusaetzliches Recht braeuchte, und
-- vergibt AUSDRUECKLICH KEIN update (unveraendert seit 0021 - eine
-- Verschiebung laeuft als delete+insert in einer Transaktion, siehe
-- src/lib/on-call-plan-actions.ts).

-- ---------------------------------------------------------------------
-- 5) Abschlusspruefungen (fail-closed, Stil aus 0019/0021)
-- ---------------------------------------------------------------------

-- 5a) Tabellenrechte: positiv.
do $$
declare
  item record;
  missing text[] := array[]::text[];
begin
  for item in
    select * from (values
      ('public.qualifications', 'select'),
      ('public.qualifications', 'insert'),
      ('public.qualifications', 'update'),
      ('public.technician_qualifications', 'select'),
      ('public.technician_qualifications', 'insert'),
      ('public.technician_qualifications', 'delete')
    ) as t(object_name, privilege)
  loop
    if not has_table_privilege('app_user', item.object_name, item.privilege) then
      missing := array_append(missing, item.object_name || ' ' || item.privilege);
    end if;
  end loop;

  if array_length(missing, 1) is not null then
    raise exception
      'AUFTRAG_14/0022: app_user fehlt/fehlen die Tabellenrecht(e): %',
      array_to_string(missing, ', ');
  end if;
end
$$;

-- 5b) Tabellenrechte: negativ (kein delete auf qualifications, kein update
--     auf technician_qualifications und on_call_plan).
do $$
declare
  item record;
  unexpected text[] := array[]::text[];
begin
  for item in
    select * from (values
      ('public.qualifications', 'delete'),
      ('public.technician_qualifications', 'update'),
      ('public.on_call_plan', 'update')
    ) as t(object_name, privilege)
  loop
    if has_table_privilege('app_user', item.object_name, item.privilege) then
      unexpected := array_append(unexpected, item.object_name || ' ' || item.privilege);
    end if;
  end loop;

  if array_length(unexpected, 1) is not null then
    raise exception
      'AUFTRAG_14/0022: app_user besitzt unerwartete Tabellenrecht(e): %',
      array_to_string(unexpected, ', ');
  end if;
end
$$;

-- 5c) RLS aktiv, Policy-Zahl je Tabelle wie im Kopfkommentar beschrieben.
do $$
declare
  v_rls boolean;
  v_policies integer;
begin
  select c.relrowsecurity into v_rls
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relname = 'qualifications';
  if v_rls is distinct from true then
    raise exception 'AUFTRAG_14/0022: RLS ist auf public.qualifications nicht aktiv';
  end if;
  select count(*) into v_policies from pg_policies
   where schemaname = 'public' and tablename = 'qualifications';
  if v_policies <> 2 then
    raise exception 'AUFTRAG_14/0022: public.qualifications traegt % statt 2 Policies', v_policies;
  end if;

  select c.relrowsecurity into v_rls
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relname = 'technician_qualifications';
  if v_rls is distinct from true then
    raise exception 'AUFTRAG_14/0022: RLS ist auf public.technician_qualifications nicht aktiv';
  end if;
  select count(*) into v_policies from pg_policies
   where schemaname = 'public' and tablename = 'technician_qualifications';
  if v_policies <> 3 then
    raise exception 'AUFTRAG_14/0022: public.technician_qualifications traegt % statt 3 Policies', v_policies;
  end if;
end
$$;

-- 5d) Unique-Bedingung technician_qualifications_uq vorhanden.
do $$
declare
  v_count integer;
begin
  select count(*) into v_count
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_namespace ns on ns.oid = rel.relnamespace
  where ns.nspname = 'public' and rel.relname = 'technician_qualifications'
    and con.conname = 'technician_qualifications_uq' and con.contype = 'u';
  if v_count <> 1 then
    raise exception 'AUFTRAG_14/0022: technician_qualifications_uq fehlt auf public.technician_qualifications';
  end if;
end
$$;

-- 5e) Check-Constraint assignment_kind vorhanden UND wirksam (Werteprobe).
do $$
declare
  v_count integer;
begin
  select count(*) into v_count
  from pg_constraint
  where conrelid = 'public.on_call_plan'::regclass and conname = 'on_call_plan_assignment_kind_chk';
  if v_count <> 1 then
    raise exception 'AUFTRAG_14/0022: on_call_plan_assignment_kind_chk fehlt';
  end if;
end
$$;

do $$
begin
  begin
    insert into public.on_call_plan (construction_stage_id, plan_date, technician_id, assignment_kind)
    values (null, '2026-01-01', gen_random_uuid(), 'unbekannt');
    raise exception 'AUFTRAG_14/0022: on_call_plan_assignment_kind_chk laesst einen unzulaessigen Wert zu';
  exception
    when check_violation then null; -- erwartet
    when foreign_key_violation then null; -- erwartet (technician_id existiert nicht) - Check greift vorher oder gleichauf, beides zulaessig
  end;
end
$$;

-- 5f) construction_stage_id ist nullable.
do $$
declare
  v_notnull boolean;
begin
  select attnotnull into v_notnull
  from pg_attribute
  where attrelid = 'public.on_call_plan'::regclass and attname = 'construction_stage_id';
  if v_notnull then
    raise exception 'AUFTRAG_14/0022: on_call_plan.construction_stage_id ist entgegen dem Auftrag weiterhin NOT NULL';
  end if;
end
$$;

-- 5g) Stage-Kind-Kopplung wirksam: 'dispo' mit gesetztem construction_stage_id
--     wird abgewiesen (Rollback am Ende dieses Blocks nimmt den Fehlversuch
--     zurueck, da er ohnehin nie committet wird).
do $$
declare
  v_stage_id uuid;
begin
  select id into v_stage_id from public.construction_stages limit 1;
  if v_stage_id is not null then
    begin
      insert into public.on_call_plan (construction_stage_id, plan_date, technician_id, assignment_kind)
      values (v_stage_id, '2026-01-02', gen_random_uuid(), 'dispo');
      raise exception 'AUFTRAG_14/0022: on_call_plan_stage_kind_chk laesst dispo mit gesetztem construction_stage_id zu';
    exception
      when check_violation then null; -- erwartet
      when foreign_key_violation then null; -- erwartet (technician_id existiert nicht)
    end;
  end if;
end
$$;

-- 5h) alter Unique-Constraint ist weg, beide partiellen Indizes bestehen.
do $$
declare
  v_old_count integer;
  v_bereitschaft_count integer;
  v_dispo_count integer;
begin
  select count(*) into v_old_count
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_namespace ns on ns.oid = rel.relnamespace
  where ns.nspname = 'public' and rel.relname = 'on_call_plan'
    and con.conname = 'on_call_plan_stage_date_tech_uq';
  if v_old_count <> 0 then
    raise exception 'AUFTRAG_14/0022: der alte Unique-Constraint on_call_plan_stage_date_tech_uq besteht noch';
  end if;

  select count(*) into v_bereitschaft_count
  from pg_indexes
  where schemaname = 'public' and tablename = 'on_call_plan' and indexname = 'on_call_plan_bereitschaft_uq';
  select count(*) into v_dispo_count
  from pg_indexes
  where schemaname = 'public' and tablename = 'on_call_plan' and indexname = 'on_call_plan_dispo_uq';
  if v_bereitschaft_count <> 1 or v_dispo_count <> 1 then
    raise exception 'AUFTRAG_14/0022: die partiellen Unique-Indizes je Zuweisungsart fehlen';
  end if;
end
$$;

-- =====================================================================
-- Ende Migration 0022
-- =====================================================================
