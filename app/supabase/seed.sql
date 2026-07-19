-- =====================================================================
-- Kabelbereitschaft – Beispiel-Stammdaten (optional)
-- Im Supabase SQL-Editor / per Service-Rolle ausfuehren (umgeht RLS).
-- Enthaelt KEINE personenbezogenen Daten und KEINE Zugangsdaten.
-- =====================================================================

insert into public.construction_stages (code, name, description) values
  ('BS1', 'Baustufe 1', 'Beispiel-Baustufe 1'),
  ('BS2', 'Baustufe 2', 'Beispiel-Baustufe 2'),
  ('BS3', 'Baustufe 3', 'Beispiel-Baustufe 3')
on conflict (code) do nothing;

insert into public.on_call_numbers (number, label) values
  ('BN-001', 'Bereitschaft Region Nord'),
  ('BN-002', 'Bereitschaft Region Süd')
on conflict (number) do nothing;

insert into public.storage_locations (name, location_type, note) values
  ('Zentrallager', 'zentrallager', 'Beispiel-Zentrallager'),
  ('Fahrzeug 1', 'fahrzeuglager', 'Beispiel-Fahrzeuglager')
on conflict do nothing;

insert into public.materials (material_no, name, category, unit, min_stock) values
  ('M-1001', 'Kabelendverschluss', 'Kabelzubehör', 'Stk', 10),
  ('M-1002', 'Erdungsklemme', 'Kabelzubehör', 'Stk', 20),
  ('M-1003', 'Kabelbinder 300mm', 'Verbrauch', 'Pkg', 5)
on conflict (material_no) do nothing;

-- Ersten Administrator festlegen (nach Anlage des Auth-Benutzers im Dashboard):
--   update public.profiles set role = 'admin', full_name = 'Vorname Nachname'
--   where id = '<AUTH_USER_UUID>';
