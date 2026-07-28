-- =====================================================================
-- Kabelbereitschaft – AP13 (Migration 0011): Aufgabenmodell und
-- auditierbare Massenaktionen.
--
-- Grundlage: Roadmap B.3, Version 1.13 (sieben verbindliche
-- Architekturbloecke, Freigabe Dennis 2026-07-27).
--
-- Leitlinien dieser Migration:
--   * additiv und wiederholbar ausfuehrbar (idempotent),
--   * `text` mit Check-Constraints, KEINE neuen PostgreSQL-Enums,
--   * keine Service-Role, keine Umgehung von RLS, Guards, Audit- oder
--     Chroniktriggern,
--   * Monteure erhalten KEIN direktes Tabellenrecht auf incident_tasks,
--   * die interne Reconciliation laeuft als gehaertete SECURITY DEFINER
--     Funktion, weil die Trigger auch durch zulaessige Monteur-Aktionen
--     ausgeloest werden (Bild- oder Kabelaenderung),
--   * Bulk-Aufrufe sind SECURITY INVOKER mit abgefangener Subtransaktion
--     je Eintrag innerhalb EINES aeusseren Aufrufs.
-- =====================================================================

set check_function_bodies = off;

-- ---------------------------------------------------------------------
-- 1) Tabelle incident_tasks
-- ---------------------------------------------------------------------
create table if not exists public.incident_tasks (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null references public.incidents(id) on delete cascade,
  task_type text not null,
  source text not null default 'derived',
  title text not null,
  body text,
  status text not null default 'open',
  priority text not null default 'normal',
  due_at timestamptz,
  assignee_profile_id uuid references public.profiles(id),
  assignee_team_id uuid references public.teams(id),
  assignee_role public.user_role,
  acknowledged_at timestamptz,
  acknowledged_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

-- Wertebereiche als Check-Constraints (kein Enum), idempotent gesetzt.
alter table public.incident_tasks
  drop constraint if exists incident_tasks_task_type_chk,
  add constraint incident_tasks_task_type_chk check (
    task_type in ('no_monteur', 'no_images', 'no_cable', 'historic_vzg', 'manual')
  );

alter table public.incident_tasks
  drop constraint if exists incident_tasks_source_chk,
  add constraint incident_tasks_source_chk check (source in ('derived', 'manual'));

alter table public.incident_tasks
  drop constraint if exists incident_tasks_status_chk,
  add constraint incident_tasks_status_chk check (
    status in ('open', 'in_progress', 'acknowledged', 'void')
  );

alter table public.incident_tasks
  drop constraint if exists incident_tasks_priority_chk,
  add constraint incident_tasks_priority_chk check (priority in ('low', 'normal', 'high'));

-- Exakte Koharenz: acknowledged_at/acknowledged_by sind genau bei
-- status = 'acknowledged' beide gesetzt, sonst beide NULL.
alter table public.incident_tasks
  drop constraint if exists incident_tasks_ack_coherence_chk,
  add constraint incident_tasks_ack_coherence_chk check (
    (status = 'acknowledged'
       and acknowledged_at is not null and acknowledged_by is not null)
    or
    (status <> 'acknowledged'
       and acknowledged_at is null and acknowledged_by is null)
  );

-- Abgeleitete Aufgaben tragen keinen Freitexttyp 'manual'.
alter table public.incident_tasks
  drop constraint if exists incident_tasks_source_type_chk,
  add constraint incident_tasks_source_type_chk check (
    (source = 'derived' and task_type <> 'manual')
    or (source = 'manual' and task_type = 'manual')
  );

-- Hoechstens ein derived-Datensatz je (incident_id, task_type).
create unique index if not exists uq_incident_tasks_derived
  on public.incident_tasks(incident_id, task_type)
  where source = 'derived';

create index if not exists idx_incident_tasks_incident_status
  on public.incident_tasks(incident_id, status);

create index if not exists idx_incident_tasks_assignee_open
  on public.incident_tasks(assignee_profile_id, status)
  where status in ('open', 'in_progress');

create index if not exists idx_incident_tasks_due
  on public.incident_tasks(status, due_at);

-- updated_at/updated_by pflegen (Konfliktbasis).
create or replace trigger trg_touch_incident_tasks
  before update on public.incident_tasks
  for each row execute function public.tg_touch_updated();

-- Feldgenaues Audit (eine Auditloesung, AP9-Entscheidung).
create or replace trigger trg_audit_incident_tasks
  after insert or update or delete on public.incident_tasks
  for each row execute function public.tg_audit();

-- Loeschsperre zusaetzlich zur fehlenden Delete-Policy und zum REVOKE.
create or replace function public.tg_incident_tasks_no_delete()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  raise exception 'Aufgaben duerfen nicht geloescht werden (nur Statuswechsel).'
    using errcode = '42501';
end $$;

create or replace trigger trg_incident_tasks_no_delete
  before delete on public.incident_tasks
  for each row execute function public.tg_incident_tasks_no_delete();

-- ---------------------------------------------------------------------
-- 2) RLS: Staff liest/schreibt, Monteure erhalten KEIN Tabellenrecht
-- ---------------------------------------------------------------------
alter table public.incident_tasks enable row level security;

drop policy if exists incident_tasks_select on public.incident_tasks;
create policy incident_tasks_select on public.incident_tasks
  for select using (public.is_staff());

drop policy if exists incident_tasks_insert on public.incident_tasks;
create policy incident_tasks_insert on public.incident_tasks
  for insert with check (public.is_staff());

drop policy if exists incident_tasks_update on public.incident_tasks;
create policy incident_tasks_update on public.incident_tasks
  for update using (public.is_staff()) with check (public.is_staff());

-- Bewusst KEINE Delete-Policy. Zusaetzlich Tabellenrechte einschraenken:
-- anon erhaelt gar nichts, authenticated kein DELETE. Monteure werden
-- zusaetzlich durch die Policies (is_staff()) ausgeschlossen.
revoke all on public.incident_tasks from anon;
revoke delete on public.incident_tasks from authenticated;
grant select, insert, update on public.incident_tasks to authenticated;

-- ---------------------------------------------------------------------
-- 3) Gehaertete interne Reconciliation (SECURITY DEFINER)
--
-- Wird ausschliesslich von Datenbanktriggern und der staff-beschraenkten
-- Refresh-RPC aufgerufen. Direktes EXECUTE ist public, anon und
-- authenticated entzogen, weil die Funktion RLS auf incident_tasks
-- notwendigerweise umgeht: die Trigger feuern auch bei zulaessigen
-- Monteur-Aktionen (Bild-/Kabelaenderung), Monteure haben aber kein
-- Schreibrecht auf incident_tasks.
-- ---------------------------------------------------------------------
create or replace function public.sync_incident_tasks_internal(p_incident_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_exists boolean;
  v_cond record;
  v_type text;
  v_active boolean;
  v_title text;
begin
  if p_incident_id is null then
    return;
  end if;

  select exists(select 1 from public.incidents where id = p_incident_id) into v_exists;
  if not v_exists then
    return;
  end if;

  -- Fachliche Ursachen exakt wie in incident_list_view (AP11).
  select
    not exists (
      select 1 from public.incident_assignments a
      where a.incident_id = i.id and a.is_active
    ) as no_monteur,
    not exists (
      select 1 from public.incident_images ii
      where ii.incident_id = i.id and ii.deleted_at is null
    ) as no_images,
    not exists (
      select 1 from public.incident_cable_positions cp
      where cp.incident_id = i.id
    ) as no_cable,
    (i.vzg_line_id is null and i.vzg_line_number is not null) as historic_vzg
  into v_cond
  from public.incidents i
  where i.id = p_incident_id;

  for v_type, v_active, v_title in
    select * from (values
      ('no_monteur',   v_cond.no_monteur,   'Kein Monteur zugewiesen'),
      ('no_images',    v_cond.no_images,    'Keine Bilder vorhanden'),
      ('no_cable',     v_cond.no_cable,     'Keine Kabelposition vorhanden'),
      ('historic_vzg', v_cond.historic_vzg, 'Historische VzG-Zuordnung')
    ) as t(task_type, is_active, title)
  loop
    if v_active then
      -- Ursache vorhanden: erzeugen oder von 'void' auf 'open' zuruecksetzen.
      -- 'acknowledged' bleibt bewusst unveraendert; 'in_progress' ebenfalls.
      insert into public.incident_tasks (incident_id, task_type, source, title, status)
      values (p_incident_id, v_type, 'derived', v_title, 'open')
      on conflict (incident_id, task_type) where source = 'derived'
      do update set
        status = case when incident_tasks.status = 'void'
                      then 'open' else incident_tasks.status end,
        title = excluded.title,
        updated_at = now()
      where incident_tasks.status = 'void'
         or incident_tasks.title is distinct from excluded.title;
    else
      -- Ursache entfallen: abgeleitete Aufgabe IMMER auf 'void' setzen,
      -- auch aus 'acknowledged'. Die Quittierungsfelder werden dabei
      -- atomar geleert, damit der Kohaerenz-Constraint erfuellt bleibt
      -- (acknowledged_at/_by sind genau bei status = 'acknowledged' gesetzt).
      -- Eine quittierte Aufgabe bleibt nur so lange 'acknowledged', wie ihre
      -- Ursache tatsaechlich weiter besteht.
      update public.incident_tasks
         set status = 'void',
             acknowledged_at = null,
             acknowledged_by = null,
             updated_at = now()
       where incident_id = p_incident_id
         and task_type = v_type
         and source = 'derived'
         and status <> 'void';
    end if;
  end loop;
end $$;

revoke all on function public.sync_incident_tasks_internal(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 4) Trigger auf den vier Quelltabellen
-- ---------------------------------------------------------------------
create or replace function public.tg_sync_tasks_from_incident()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.sync_incident_tasks_internal(coalesce(new.id, old.id));
  return null;
end $$;

create or replace function public.tg_sync_tasks_from_child()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.sync_incident_tasks_internal(coalesce(new.incident_id, old.incident_id));
  if tg_op = 'UPDATE'
     and new.incident_id is distinct from old.incident_id then
    perform public.sync_incident_tasks_internal(old.incident_id);
  end if;
  return null;
end $$;

revoke all on function public.tg_sync_tasks_from_incident() from public, anon, authenticated;
revoke all on function public.tg_sync_tasks_from_child() from public, anon, authenticated;

create or replace trigger trg_sync_tasks_incidents
  after insert or update of vzg_line_id, vzg_line_number on public.incidents
  for each row execute function public.tg_sync_tasks_from_incident();

create or replace trigger trg_sync_tasks_assignments
  after insert or update or delete on public.incident_assignments
  for each row execute function public.tg_sync_tasks_from_child();

create or replace trigger trg_sync_tasks_images
  after insert or update or delete on public.incident_images
  for each row execute function public.tg_sync_tasks_from_child();

create or replace trigger trg_sync_tasks_cable_positions
  after insert or update or delete on public.incident_cable_positions
  for each row execute function public.tg_sync_tasks_from_child();

-- ---------------------------------------------------------------------
-- 5) Staff-Refresh-RPC und idempotenter Backfill
-- ---------------------------------------------------------------------
-- Bewusst SECURITY DEFINER: die interne Reconciliation ist fuer
-- authenticated nicht ausfuehrbar. Der Staff-Zugang wird deshalb hier
-- explizit geprueft, bevor die Definer-Rechte genutzt werden.
create or replace function public.refresh_incident_tasks_ap13(p_incident_id uuid default null)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
  v_id uuid;
begin
  if auth.uid() is not null and not public.is_staff() then
    raise exception 'Nur Staff darf Aufgaben neu ableiten.' using errcode = '42501';
  end if;

  for v_id in
    select i.id from public.incidents i
    where p_incident_id is null or i.id = p_incident_id
  loop
    perform public.sync_incident_tasks_internal(v_id);
    v_count := v_count + 1;
  end loop;

  return v_count;
end $$;

revoke all on function public.refresh_incident_tasks_ap13(uuid) from public, anon;
grant execute on function public.refresh_incident_tasks_ap13(uuid) to authenticated;

-- Idempotenter Backfill fuer den Bestand (laeuft im Migrationskontext,
-- auth.uid() ist dort NULL).
do $$
declare v_id uuid;
begin
  for v_id in select id from public.incidents loop
    perform public.sync_incident_tasks_internal(v_id);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 6) Minimierte Monteur-Sicht (gehaertete SECURITY DEFINER RPC)
-- ---------------------------------------------------------------------
create or replace function public.get_assigned_incident_tasks(p_incident_id uuid)
returns table (
  incident_id uuid,
  task_type text,
  title text,
  status text,
  due_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Kein angemeldeter Benutzer.' using errcode = '42501';
  end if;
  if p_incident_id is null then
    raise exception 'Vorgang fehlt.' using errcode = '22004';
  end if;
  if not public.is_assigned_to_incident(p_incident_id) then
    raise exception 'Kein Zugriff auf diesen Vorgang.' using errcode = '42501';
  end if;

  return query
    select t.incident_id, t.task_type, t.title, t.status, t.due_at
    from public.incident_tasks t
    where t.incident_id = p_incident_id
      and t.status in ('open', 'in_progress')
    order by t.created_at;
end $$;

revoke all on function public.get_assigned_incident_tasks(uuid) from public, anon;
grant execute on function public.get_assigned_incident_tasks(uuid) to authenticated;

-- Bewusst KEIN allgemein aufrufbarer Definer-Helfer fuer den
-- Aufgabenstatus: eine solche Funktion waere eine freie
-- Informationsschnittstelle, mit der jeder angemeldete Benutzer den
-- Aufgabenstatus fremder Vorgaenge abfragen koennte. `has_open_task`
-- wird stattdessen RLS-konform in der security_invoker-View ermittelt
-- (siehe Abschnitt 9). Ein etwaiger Helfer aus einem frueheren Lauf
-- dieser Migration wird nach der View-Neuanlage entfernt.

-- ---------------------------------------------------------------------
-- 7) Bulk-Statusaenderung (SECURITY INVOKER)
--
-- Ein aeusserer Aufruf, abgefangene Subtransaktion je Eintrag.
-- Erwartbare Einzelfehler -> Ergebniscode; unerwartete technische
-- Fehler werden NICHT abgefangen und rollen den Gesamtaufruf zurueck.
-- ---------------------------------------------------------------------
create or replace function public.bulk_update_incident_status_ap13(
  p_items jsonb,
  p_new_status public.incident_status
)
returns table (incident_id uuid, ok boolean, code text)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_item jsonb;
  v_id uuid;
  v_expected timestamptz;
  v_current timestamptz;
  v_status public.incident_status;
begin
  if not public.is_staff() then
    raise exception 'Nur Staff darf Massenaktionen ausfuehren.' using errcode = '42501';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'p_items muss ein JSON-Array sein.' using errcode = '22023';
  end if;
  if jsonb_array_length(p_items) > 200 then
    raise exception 'Massenaktion auf maximal 200 Vorgaenge begrenzt (uebergeben: %).',
      jsonb_array_length(p_items) using errcode = '22023';
  end if;

  for v_item in select value from jsonb_array_elements(p_items) loop
    v_id := nullif(v_item->>'id', '')::uuid;
    v_expected := nullif(v_item->>'expected_updated_at', '')::timestamptz;

    begin
      select i.updated_at, i.status into v_current, v_status
      from public.incidents i
      where i.id = v_id
      for update;

      if not found then
        incident_id := v_id; ok := false; code := 'not_found';
        return next; continue;
      end if;

      if v_expected is null or v_current is distinct from v_expected then
        incident_id := v_id; ok := false; code := 'conflict';
        return next; continue;
      end if;

      if v_status = p_new_status then
        incident_id := v_id; ok := true; code := 'ok';
        return next; continue;
      end if;

      -- Regulaerer Schreibweg: RLS, tg_incident_guard,
      -- tg_incident_status_history und tg_audit greifen unveraendert.
      update public.incidents set status = p_new_status where id = v_id;

      incident_id := v_id; ok := true; code := 'ok';
      return next;

    exception
      when insufficient_privilege then
        incident_id := v_id; ok := false; code := 'guard_rejected';
        return next;
      when check_violation or invalid_parameter_value or foreign_key_violation then
        incident_id := v_id; ok := false; code := 'invalid_status';
        return next;
    end;
  end loop;
end $$;

revoke all on function public.bulk_update_incident_status_ap13(jsonb, public.incident_status)
  from public, anon;
grant execute on function public.bulk_update_incident_status_ap13(jsonb, public.incident_status)
  to authenticated;

-- ---------------------------------------------------------------------
-- 8) Monteurzuweisung: gemeinsamer gesperrter Pfad fuer Einzel und Bulk
-- ---------------------------------------------------------------------
create or replace function public.assign_incident_monteur_ap13(
  p_incident_id uuid,
  p_monteur_id uuid,
  p_expected_updated_at timestamptz,
  p_expected_monteur_ids uuid[]
)
returns text
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_current timestamptz;
  v_status public.incident_status;
  v_actual uuid[];
  v_expected uuid[];
  v_role public.user_role;
  v_active boolean;
  v_exists boolean;
begin
  if not public.is_staff() then
    raise exception 'Nur Staff darf Monteure zuweisen.' using errcode = '42501';
  end if;

  select p.role, p.is_active into v_role, v_active
  from public.profiles p where p.id = p_monteur_id;
  if v_role is null then
    return 'invalid_monteur';
  end if;
  if v_role <> 'monteur' or not v_active then
    return 'invalid_monteur';
  end if;

  -- Sperre den Vorgang, damit Konfliktpruefung und Aenderung nicht
  -- auseinanderlaufen koennen.
  select i.updated_at, i.status into v_current, v_status
  from public.incidents i
  where i.id = p_incident_id
  for update;

  if not found then
    return 'not_found';
  end if;

  if p_expected_updated_at is null or v_current is distinct from p_expected_updated_at then
    return 'conflict';
  end if;

  -- Erwartete sortierte Menge aktiver Monteure vergleichen:
  -- incidents.updated_at allein erkennt konkurrierende Zuweisungen nicht.
  select coalesce(array_agg(a.monteur_id order by a.monteur_id), array[]::uuid[])
    into v_actual
  from public.incident_assignments a
  where a.incident_id = p_incident_id and a.is_active;

  select coalesce(array_agg(x order by x), array[]::uuid[]) into v_expected
  from unnest(coalesce(p_expected_monteur_ids, array[]::uuid[])) as x;

  if v_actual is distinct from v_expected then
    return 'conflict';
  end if;

  select exists (
    select 1 from public.incident_assignments a
    where a.incident_id = p_incident_id
      and a.monteur_id = p_monteur_id
      and a.is_active
  ) into v_exists;

  if v_exists then
    -- Bereits aktive identische Zuweisung: erfolgreiches No-op,
    -- kein zusaetzlicher Auditeintrag, keine Chronik.
    return 'ok';
  end if;

  -- Additiv: bestehende aktive Monteure bleiben unveraendert.
  -- Der Insert erzeugt regulaer einen eigenen Auditeintrag
  -- (trg_audit_assignments).
  insert into public.incident_assignments (incident_id, monteur_id)
  values (p_incident_id, p_monteur_id);

  -- Statushistorie nur bei tatsaechlicher Statusaenderung.
  if v_status = 'neu' then
    update public.incidents set status = 'monteur_zugewiesen' where id = p_incident_id;
  end if;

  return 'ok';
end $$;

revoke all on function public.assign_incident_monteur_ap13(uuid, uuid, timestamptz, uuid[])
  from public, anon;
grant execute on function public.assign_incident_monteur_ap13(uuid, uuid, timestamptz, uuid[])
  to authenticated;

create or replace function public.bulk_assign_incident_monteur_ap13(
  p_items jsonb,
  p_monteur_id uuid
)
returns table (incident_id uuid, ok boolean, code text)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_item jsonb;
  v_id uuid;
  v_expected timestamptz;
  v_ids uuid[];
  v_code text;
begin
  if not public.is_staff() then
    raise exception 'Nur Staff darf Massenaktionen ausfuehren.' using errcode = '42501';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'p_items muss ein JSON-Array sein.' using errcode = '22023';
  end if;
  if jsonb_array_length(p_items) > 200 then
    raise exception 'Massenaktion auf maximal 200 Vorgaenge begrenzt (uebergeben: %).',
      jsonb_array_length(p_items) using errcode = '22023';
  end if;

  for v_item in select value from jsonb_array_elements(p_items) loop
    v_id := nullif(v_item->>'id', '')::uuid;
    v_expected := nullif(v_item->>'expected_updated_at', '')::timestamptz;

    select coalesce(array_agg((e)::uuid), array[]::uuid[]) into v_ids
    from jsonb_array_elements_text(coalesce(v_item->'expected_monteur_ids', '[]'::jsonb)) as e;

    begin
      -- Gemeinsamer kontrollierter RPC-/Sperrpfad (identisch zur
      -- Einzelzuweisung der Anwendung).
      v_code := public.assign_incident_monteur_ap13(v_id, p_monteur_id, v_expected, v_ids);
      incident_id := v_id;
      ok := (v_code = 'ok');
      code := v_code;
      return next;
    exception
      when insufficient_privilege then
        incident_id := v_id; ok := false; code := 'guard_rejected';
        return next;
      when check_violation or invalid_parameter_value or foreign_key_violation
        or unique_violation then
        incident_id := v_id; ok := false; code := 'invalid_status';
        return next;
    end;
  end loop;
end $$;

revoke all on function public.bulk_assign_incident_monteur_ap13(jsonb, uuid) from public, anon;
grant execute on function public.bulk_assign_incident_monteur_ap13(jsonb, uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 9) Listenintegration: has_open_task additiv am Ende der View
--     (offen = 'open' oder 'in_progress'; 'acknowledged'/'void' zaehlen nicht)
--
-- Die Ermittlung erfolgt als korrelierte Unterabfrage INNERHALB der
-- security_invoker-View. Damit greift die RLS von incident_tasks fuer den
-- aufrufenden Benutzer: Staff sieht den echten Wert, ein Monteur erhaelt
-- keinen Informationsgewinn (immer false) und es entsteht keine frei
-- nutzbare Abfrageschnittstelle. Die Liste ist ohnehin staff-only.
-- ---------------------------------------------------------------------
create or replace view public.incident_list_view
with (security_invoker = true) as
select
  i.id,
  i.incident_no,
  i.status,
  i.priority,
  i.customer_id,
  c.name                                   as customer_name,
  i.construction_stage_id,
  cs.code                                  as stage_code,
  cs.name                                  as stage_name,
  i.vzg_line_id,
  i.vzg_line_number,
  vl.line_number                           as vzg_line_ref,
  i.on_call_number_id,
  ocn.number                               as on_call_number,
  ocn.label                                as on_call_label,
  i.operating_point,
  i.km_from,
  i.km_to,
  i.created_at,
  i.created_by,
  i.updated_at,
  (i.created_at at time zone 'Europe/Berlin')::date as created_date_local,
  coalesce(img.cnt, 0)                      as image_count,
  coalesce(cab.names, array[]::text[])      as cable_arts,
  coalesce(mon.names, array[]::text[])      as monteur_names,
  coalesce(mon.ids, array[]::uuid[])        as monteur_ids,
  (mon.ids is null or array_length(mon.ids, 1) is null)   as no_monteur,
  (coalesce(img.cnt, 0) = 0)                              as no_images,
  (cab.names is null or array_length(cab.names, 1) is null) as no_cable,
  (i.vzg_line_id is null and i.vzg_line_number is not null) as historic_vzg,
  lower(
    coalesce(i.incident_no::text, '') || ' ' ||
    coalesce(c.name, '') || ' ' ||
    coalesce(cs.code, '') || ' ' ||
    coalesce(cs.name, '') || ' ' ||
    coalesce(vl.line_number, i.vzg_line_number, '') || ' ' ||
    coalesce(i.operating_point, '') || ' ' ||
    coalesce(i.description, '') || ' ' ||
    coalesce(i.external_reference, '')
  ) as search_text,
  exists (
    select 1 from public.incident_tasks t
    where t.incident_id = i.id
      and t.status in ('open', 'in_progress')
  )                                         as has_open_task
from public.incidents i
left join public.customers c            on c.id = i.customer_id
left join public.construction_stages cs on cs.id = i.construction_stage_id
left join public.vzg_lines vl           on vl.id = i.vzg_line_id
left join public.on_call_numbers ocn    on ocn.id = i.on_call_number_id
left join lateral (
  select count(*)::int as cnt
  from public.incident_images ii
  where ii.incident_id = i.id and ii.deleted_at is null
) img on true
left join lateral (
  select array_agg(ct.name order by cp.sort_order) as names
  from public.incident_cable_positions cp
  join public.cable_types ct on ct.id = cp.cable_type_id
  where cp.incident_id = i.id
) cab on true
left join lateral (
  select array_agg(p.full_name order by p.full_name) as names,
         array_agg(a.monteur_id) as ids
  from public.incident_assignments a
  join public.profiles p on p.id = a.monteur_id
  where a.incident_id = i.id and a.is_active
) mon on true;

-- Aufraeumen: ein in einem frueheren Lauf dieser Migration erzeugter
-- Definer-Helfer wird entfernt, nachdem die View ihn nicht mehr nutzt.
drop function if exists public.incident_has_open_task(uuid);

-- =====================================================================
-- Ende Migration 0011
-- =====================================================================
