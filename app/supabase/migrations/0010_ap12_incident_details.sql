-- =====================================================================
-- AP12: Vorgangsdetail, Kontaktbezug und qualifizierte Kabelpositionen
-- =====================================================================

alter table public.incidents
  add column if not exists contact_id uuid references public.contacts(id),
  add column if not exists contact_phone_number_id uuid references public.contact_phone_numbers(id),
  add column if not exists contact_name_snapshot text,
  add column if not exists contact_function_snapshot text,
  add column if not exists contact_phone_snapshot text;

create index if not exists idx_incidents_contact on public.incidents(contact_id);

alter table public.incident_cable_positions
  add column if not exists quantity_value numeric(12,3),
  add column if not exists quantity_unit text,
  add column if not exists condition_code text;

alter table public.incident_cable_positions
  drop constraint if exists incident_cable_positions_quantity_pair,
  add constraint incident_cable_positions_quantity_pair check (
    (quantity_value is null and quantity_unit is null)
    or
    (quantity_value is not null and quantity_unit is not null)
  ),
  drop constraint if exists incident_cable_positions_quantity_value,
  add constraint incident_cable_positions_quantity_value check (
    quantity_value is null or quantity_value > 0
  ),
  drop constraint if exists incident_cable_positions_quantity_unit,
  add constraint incident_cable_positions_quantity_unit check (
    quantity_unit is null or quantity_unit in ('piece', 'meter')
  ),
  drop constraint if exists incident_cable_positions_piece_integer,
  add constraint incident_cable_positions_piece_integer check (
    quantity_unit is distinct from 'piece' or quantity_value = trunc(quantity_value)
  ),
  drop constraint if exists incident_cable_positions_condition_code,
  add constraint incident_cable_positions_condition_code check (
    condition_code is null or condition_code in ('ready', 'restricted', 'damaged', 'unusable')
  );

-- Ansprechpartner-Stammdaten sind nur für Staff direkt sichtbar. Monteure
-- erhalten ausschließlich die vorgangsbezogene Projektion weiter unten.
drop policy if exists contacts_select on public.contacts;
create policy contacts_select on public.contacts for select using (public.is_staff());
drop policy if exists contact_phone_numbers_select on public.contact_phone_numbers;
create policy contact_phone_numbers_select on public.contact_phone_numbers for select using (public.is_staff());
drop policy if exists construction_stage_contacts_select on public.construction_stage_contacts;
create policy construction_stage_contacts_select on public.construction_stage_contacts for select using (public.is_staff());

-- Bereitschaftsnummern: Verwaltung durch Staff; Leserecht bleibt für alle
-- Angemeldeten nötig, da Nummern in zugewiesenen Vorgängen angezeigt werden.
drop policy if exists oncall_write on public.on_call_numbers;
create policy oncall_write on public.on_call_numbers for all
  using (public.is_staff()) with check (public.is_staff());

create or replace function public.get_assigned_incident_contact(p_incident_id uuid)
returns table (
  incident_id uuid,
  contact_name text,
  contact_function text,
  operative_phone text
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    i.id,
    coalesce(i.contact_name_snapshot, i.caller_name),
    i.contact_function_snapshot,
    coalesce(i.contact_phone_snapshot, i.caller_contact)
  from public.incidents i
  where i.id = p_incident_id
    and public.is_assigned_to_incident(i.id);
$$;

revoke all on function public.get_assigned_incident_contact(uuid) from public, anon;
grant execute on function public.get_assigned_incident_contact(uuid) to authenticated;

create or replace function public.create_incident_ap12(
  p_customer_id uuid,
  p_construction_stage_id uuid,
  p_vzg_line_id uuid,
  p_on_call_number_id uuid,
  p_priority public.incident_priority,
  p_description text,
  p_operating_point text,
  p_track text,
  p_direction text,
  p_object_type text,
  p_object_designation text,
  p_location_description text,
  p_external_reference text,
  p_km_from numeric,
  p_km_to numeric,
  p_caller_name text,
  p_caller_contact text,
  p_internal_note text,
  p_contact_id uuid,
  p_contact_phone_number_id uuid,
  p_cable_positions jsonb
) returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_id uuid;
  v_vzg_number text;
  v_vzg_stage uuid;
  v_contact_name text;
  v_contact_function text;
  v_contact_customer uuid;
  v_phone text;
  v_phone_contact uuid;
  v_position jsonb;
  v_cable_type_id uuid;
  v_quantity numeric(12,3);
  v_unit text;
  v_condition text;
  v_sort integer := 0;
begin
  if p_customer_id is null or p_construction_stage_id is null or p_vzg_line_id is null
     or p_priority is null or nullif(btrim(p_description), '') is null
     or p_cable_positions is null or jsonb_typeof(p_cable_positions) <> 'array'
     or jsonb_array_length(p_cable_positions) = 0 then
    raise exception 'Pflichtfelder fehlen.' using errcode = '23514';
  end if;

  select line_number, construction_stage_id into v_vzg_number, v_vzg_stage
  from public.vzg_lines where id = p_vzg_line_id;
  if v_vzg_number is null then
    raise exception 'VzG-Strecke nicht gefunden.' using errcode = '23503';
  end if;
  if v_vzg_stage <> p_construction_stage_id then
    raise exception 'VzG-Strecke gehört nicht zum gewählten Bauabschnitt.' using errcode = '23514';
  end if;

  if p_contact_id is not null then
    select name, function, customer_id
      into v_contact_name, v_contact_function, v_contact_customer
    from public.contacts where id = p_contact_id and is_active;
    if v_contact_name is null then
      raise exception 'Ansprechpartner nicht gefunden oder inaktiv.' using errcode = '23503';
    end if;
    if v_contact_customer <> p_customer_id then
      raise exception 'Ansprechpartner gehört nicht zum gewählten Kunden.' using errcode = '23514';
    end if;
    if p_contact_phone_number_id is not null then
      select phone, contact_id into v_phone, v_phone_contact
      from public.contact_phone_numbers where id = p_contact_phone_number_id;
      if v_phone is null or v_phone_contact <> p_contact_id then
        raise exception 'Telefonnummer gehört nicht zum Ansprechpartner.' using errcode = '23514';
      end if;
    end if;
  elsif p_contact_phone_number_id is not null then
    raise exception 'Telefonnummer erfordert einen Ansprechpartner.' using errcode = '23514';
  end if;

  insert into public.incidents (
    customer_id, construction_stage_id, vzg_line_id, vzg_line_number, on_call_number_id,
    priority, description, operating_point, track, direction, object_type, object_designation,
    location_description, external_reference, km_from, km_to, caller_name, caller_contact,
    internal_note, call_received_at, status, contact_id, contact_phone_number_id,
    contact_name_snapshot, contact_function_snapshot, contact_phone_snapshot
  ) values (
    p_customer_id, p_construction_stage_id, p_vzg_line_id, v_vzg_number, p_on_call_number_id,
    p_priority, p_description, p_operating_point, p_track, p_direction, p_object_type, p_object_designation,
    p_location_description, p_external_reference, p_km_from, p_km_to, p_caller_name, p_caller_contact,
    p_internal_note, now(), 'neu', p_contact_id, p_contact_phone_number_id,
    v_contact_name, v_contact_function, v_phone
  ) returning id into v_id;

  for v_position in select value from jsonb_array_elements(p_cable_positions)
  loop
    begin
      v_cable_type_id := nullif(v_position->>'cable_type_id', '')::uuid;
      v_quantity := nullif(replace(v_position->>'quantity_value', ',', '.'), '')::numeric;
    exception when invalid_text_representation then
      raise exception 'Ungültige Kabelposition.' using errcode = '23514';
    end;
    v_unit := nullif(v_position->>'quantity_unit', '');
    v_condition := nullif(v_position->>'condition_code', '');
    if v_cable_type_id is null or v_quantity is null or v_unit is null or v_condition is null then
      raise exception 'Jede neue Kabelposition benötigt Kabelart, Menge, Einheit und Zustand.' using errcode = '23514';
    end if;
    insert into public.incident_cable_positions (
      incident_id, cable_type_id, sort_order, quantity_value, quantity_unit, condition_code
    ) values (
      v_id, v_cable_type_id, v_sort, v_quantity, v_unit, v_condition
    );
    v_sort := v_sort + 1;
  end loop;
  return v_id;
end $$;

create or replace function public.update_incident_ap12(
  p_id uuid,
  p_customer_id uuid,
  p_construction_stage_id uuid,
  p_vzg_line_id uuid,
  p_on_call_number_id uuid,
  p_priority public.incident_priority,
  p_description text,
  p_operating_point text,
  p_track text,
  p_direction text,
  p_object_type text,
  p_object_designation text,
  p_location_description text,
  p_external_reference text,
  p_km_from numeric,
  p_km_to numeric,
  p_caller_name text,
  p_caller_contact text,
  p_internal_note text,
  p_contact_id uuid,
  p_contact_phone_number_id uuid,
  p_cable_positions jsonb
) returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_vzg_number text;
  v_vzg_stage uuid;
  v_old_contact uuid;
  v_old_phone uuid;
  v_contact_name text;
  v_contact_function text;
  v_contact_customer uuid;
  v_phone text;
  v_phone_contact uuid;
  v_position jsonb;
  v_position_id uuid;
  v_cable_type_id uuid;
  v_quantity numeric(12,3);
  v_unit text;
  v_condition text;
  v_old record;
  v_sort integer := 0;
  v_seen uuid[] := array[]::uuid[];
begin
  if p_id is null or p_customer_id is null or p_construction_stage_id is null or p_vzg_line_id is null
     or p_priority is null or nullif(btrim(p_description), '') is null
     or p_cable_positions is null or jsonb_typeof(p_cable_positions) <> 'array'
     or jsonb_array_length(p_cable_positions) = 0 then
    raise exception 'Pflichtfelder fehlen.' using errcode = '23514';
  end if;

  select contact_id, contact_phone_number_id into v_old_contact, v_old_phone
  from public.incidents where id = p_id for update;
  if not found then
    raise exception 'Vorgang nicht gefunden.' using errcode = '23503';
  end if;

  select line_number, construction_stage_id into v_vzg_number, v_vzg_stage
  from public.vzg_lines where id = p_vzg_line_id;
  if v_vzg_number is null then
    raise exception 'VzG-Strecke nicht gefunden.' using errcode = '23503';
  end if;
  if v_vzg_stage <> p_construction_stage_id then
    raise exception 'VzG-Strecke gehört nicht zum gewählten Bauabschnitt.' using errcode = '23514';
  end if;

  if p_contact_id is not null then
    select name, function, customer_id into v_contact_name, v_contact_function, v_contact_customer
    from public.contacts where id = p_contact_id;
    if v_contact_name is null then
      raise exception 'Ansprechpartner nicht gefunden.' using errcode = '23503';
    end if;
    if v_contact_customer <> p_customer_id then
      raise exception 'Ansprechpartner gehört nicht zum gewählten Kunden.' using errcode = '23514';
    end if;
    if p_contact_phone_number_id is not null then
      select phone, contact_id into v_phone, v_phone_contact
      from public.contact_phone_numbers where id = p_contact_phone_number_id;
      if v_phone is null or v_phone_contact <> p_contact_id then
        raise exception 'Telefonnummer gehört nicht zum Ansprechpartner.' using errcode = '23514';
      end if;
    end if;
  elsif p_contact_phone_number_id is not null then
    raise exception 'Telefonnummer erfordert einen Ansprechpartner.' using errcode = '23514';
  end if;

  update public.incidents set
    customer_id = p_customer_id,
    construction_stage_id = p_construction_stage_id,
    vzg_line_id = p_vzg_line_id,
    vzg_line_number = v_vzg_number,
    on_call_number_id = p_on_call_number_id,
    priority = p_priority,
    description = p_description,
    operating_point = p_operating_point,
    track = p_track,
    direction = p_direction,
    object_type = p_object_type,
    object_designation = p_object_designation,
    location_description = p_location_description,
    external_reference = p_external_reference,
    km_from = p_km_from,
    km_to = p_km_to,
    caller_name = p_caller_name,
    caller_contact = p_caller_contact,
    internal_note = p_internal_note,
    contact_id = p_contact_id,
    contact_phone_number_id = p_contact_phone_number_id,
    contact_name_snapshot = case
      when p_contact_id is not null and (
        p_contact_id is distinct from v_old_contact
        or p_contact_phone_number_id is distinct from v_old_phone
        or contact_name_snapshot is null
      )
        then v_contact_name else contact_name_snapshot end,
    contact_function_snapshot = case
      when p_contact_id is not null and (
        p_contact_id is distinct from v_old_contact
        or p_contact_phone_number_id is distinct from v_old_phone
        or contact_name_snapshot is null
      )
        then v_contact_function else contact_function_snapshot end,
    contact_phone_snapshot = case
      when p_contact_id is not null and (
        p_contact_id is distinct from v_old_contact
        or p_contact_phone_number_id is distinct from v_old_phone
        or contact_name_snapshot is null
      )
        then v_phone else contact_phone_snapshot end
  where id = p_id;

  for v_position in select value from jsonb_array_elements(p_cable_positions)
  loop
    begin
      v_position_id := nullif(v_position->>'id', '')::uuid;
      v_cable_type_id := nullif(v_position->>'cable_type_id', '')::uuid;
      v_quantity := nullif(replace(v_position->>'quantity_value', ',', '.'), '')::numeric;
    exception when invalid_text_representation then
      raise exception 'Ungültige Kabelposition.' using errcode = '23514';
    end;
    v_unit := nullif(v_position->>'quantity_unit', '');
    v_condition := nullif(v_position->>'condition_code', '');
    if v_cable_type_id is null then
      raise exception 'Jede Kabelposition benötigt eine Kabelart.' using errcode = '23514';
    end if;

    if v_position_id is null then
      if v_quantity is null or v_unit is null or v_condition is null then
        raise exception 'Neue Kabelpositionen benötigen Menge, Einheit und Zustand.' using errcode = '23514';
      end if;
      insert into public.incident_cable_positions (
        incident_id, cable_type_id, sort_order, quantity_value, quantity_unit, condition_code
      ) values (p_id, v_cable_type_id, v_sort, v_quantity, v_unit, v_condition)
      returning id into v_position_id;
    else
      if v_position_id = any(v_seen) then
        raise exception 'Kabelposition wurde doppelt übermittelt.' using errcode = '23514';
      end if;
      select cable_type_id, quantity_value, quantity_unit, condition_code
        into v_old
      from public.incident_cable_positions
      where id = v_position_id and incident_id = p_id for update;
      if not found then
        raise exception 'Kabelposition gehört nicht zum Vorgang.' using errcode = '23503';
      end if;
      if (v_cable_type_id, v_quantity, v_unit, v_condition)
         is distinct from (v_old.cable_type_id, v_old.quantity_value, v_old.quantity_unit, v_old.condition_code)
         and (v_quantity is null or v_unit is null or v_condition is null) then
        raise exception 'Geänderte Kabelpositionen benötigen Menge, Einheit und Zustand.' using errcode = '23514';
      end if;
      update public.incident_cable_positions set
        cable_type_id = v_cable_type_id,
        sort_order = v_sort,
        quantity_value = v_quantity,
        quantity_unit = v_unit,
        condition_code = v_condition
      where id = v_position_id;
    end if;
    v_seen := array_append(v_seen, v_position_id);
    v_sort := v_sort + 1;
  end loop;

  delete from public.incident_cable_positions
  where incident_id = p_id and not (id = any(v_seen));
end $$;

revoke all on function public.create_incident_ap12(
  uuid, uuid, uuid, uuid, public.incident_priority, text, text, text, text, text,
  text, text, text, numeric, numeric, text, text, text, uuid, uuid, jsonb
) from public, anon;
revoke all on function public.update_incident_ap12(
  uuid, uuid, uuid, uuid, uuid, public.incident_priority, text, text, text, text, text,
  text, text, text, numeric, numeric, text, text, text, uuid, uuid, jsonb
) from public, anon;
grant execute on function public.create_incident_ap12(
  uuid, uuid, uuid, uuid, public.incident_priority, text, text, text, text, text,
  text, text, text, numeric, numeric, text, text, text, uuid, uuid, jsonb
) to authenticated;
grant execute on function public.update_incident_ap12(
  uuid, uuid, uuid, uuid, uuid, public.incident_priority, text, text, text, text, text,
  text, text, text, numeric, numeric, text, text, text, uuid, uuid, jsonb
) to authenticated;

-- AP10 bleibt aus historischen Gründen als DB-Objekt erhalten, ist für
-- Anwendungsrollen aber nicht mehr ausführbar.
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as signature
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('create_incident_ap10', 'update_incident_ap10')
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', r.signature);
  end loop;
end $$;
