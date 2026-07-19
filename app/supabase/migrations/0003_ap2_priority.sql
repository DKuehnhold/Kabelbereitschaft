-- =====================================================================
-- Kabelbereitschaft – AP2 (Migration 0003)
-- Additiv & datenerhaltend: Priorität + Abschluss-/interne Bemerkung.
-- Idempotent (IF NOT EXISTS / Guard), verändert bestehende Daten nicht.
-- =====================================================================

-- Prioritäts-Enum (Guard, da CREATE TYPE kein IF NOT EXISTS kennt)
do $$
begin
  if not exists (select 1 from pg_type where typname = 'incident_priority') then
    create type public.incident_priority as enum ('niedrig','normal','hoch','kritisch');
  end if;
end $$;

-- Neue Spalten (nur falls fehlend). Bestehende NOT-NULL-/optional-Felder bleiben unverändert.
alter table public.incidents
  add column if not exists priority public.incident_priority not null default 'normal',
  add column if not exists closing_note text,
  add column if not exists internal_note text;

create index if not exists idx_incidents_priority on public.incidents(priority);
