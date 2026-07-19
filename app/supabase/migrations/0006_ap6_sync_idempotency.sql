-- =====================================================================
-- Kabelbereitschaft – AP6 (Migration 0006): Idempotenz der Offline-Synchronisation
-- Additiv, idempotent, ohne Datenverlust.
-- Neue Tabelle `sync_actions` dedupliziert vorgemerkte Offline-Aktionen anhand einer
-- stabilen Client-Action-ID je Benutzer. Verhindert Doppelübertragung bei Retry/Reconnect.
-- Bestehende Tabellen/Trigger/RLS bleiben unverändert.
-- =====================================================================

create table if not exists public.sync_actions (
  id uuid primary key default gen_random_uuid(),
  actor uuid not null default auth.uid() references auth.users(id) on delete cascade,
  client_action_id uuid not null,
  kind text not null,                        -- 'note' | 'status' | 'image'
  incident_id uuid references public.incidents(id) on delete set null,
  applied_at timestamptz not null default now()
);

-- Eindeutigkeit je Benutzer + Client-Action-ID (Kern der Deduplizierung).
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'sync_actions_actor_client_uniq') then
    alter table public.sync_actions
      add constraint sync_actions_actor_client_uniq unique (actor, client_action_id);
  end if;
end $$;

create index if not exists idx_sync_actions_actor on public.sync_actions(actor);

alter table public.sync_actions enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='sync_actions' and policyname='sync_actions_select') then
    create policy sync_actions_select on public.sync_actions for select
      using (actor = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='sync_actions' and policyname='sync_actions_insert') then
    create policy sync_actions_insert on public.sync_actions for insert
      with check (actor = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='sync_actions' and policyname='sync_actions_delete') then
    -- Kompensation bei fehlgeschlagener Anwendung (siehe /api/sync): eigener Eintrag löschbar.
    create policy sync_actions_delete on public.sync_actions for delete
      using (actor = auth.uid());
  end if;
end $$;
