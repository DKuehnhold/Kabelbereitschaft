-- =====================================================================
-- Kabelbereitschaft – AP11 (Migration 0009): Operative Vorgangsliste
-- Additiv, read-only. Eine RLS-konforme View für kombinierte Suche,
-- Filterung, Mehrfachsortierung und serverseitige Pagination.
--   * `security_invoker = true`: RLS der Basistabellen greift für den
--     aufrufenden Benutzer (keine Rechteumgehung, keine Service-Role).
--   * Flache Felder + Aggregate (Bildanzahl nur nicht gelöschte, Kabelarten,
--     aktive Monteure) + abgeleitete „offene Hinweise" + Suchtext + lokales
--     Erstelldatum (Europe/Berlin) für tz-korrekte Datumsfilter.
-- Keine neue Tabelle, kein Audit, keine Mutation. Keine Änderung an 0001–0008.
-- =====================================================================

set check_function_bodies = off;

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
  ) as search_text
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
