-- =====================================================================
-- Kabelbereitschaft – AP3 (Migration 0004)
-- Additiv: Monteure dürfen zusätzlich "Verbrauch" buchen (mit Vorgangs-
-- und Quelllagerbezug, nur für zugewiesene Vorgänge). Bestehende Policies,
-- Tabellen, Trigger und Views bleiben unverändert.
-- Idempotent über pg_policies-Guard.
-- =====================================================================

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'inventory_movements'
      and policyname = 'movements_insert_monteur_verbrauch'
  ) then
    create policy movements_insert_monteur_verbrauch
      on public.inventory_movements
      for insert
      with check (
        movement_type = 'verbrauch'
        and incident_id is not null
        and source_location_id is not null
        and public.is_assigned_to_incident(incident_id)
      );
  end if;
end $$;
