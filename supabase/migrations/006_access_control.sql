-- 006_access_control.sql
--
-- Run AFTER 005_staff_attendance.sql.
--
-- A resident creates a pass for a visitor and gets a short code. The visitor
-- shows the code at the gate. The security officer verifies it and logs the
-- arrival, geo-stamped from their own phone.

create type pass_status as enum ('active', 'used', 'revoked');

-- ---------------------------------------------------------------------
-- Passes
--
-- Note there is no 'expired' status. Expiry is derived from valid_until,
-- so nothing has to run on a schedule to keep it true. The escalation
-- sweep needed a cron because a stamp had to be written; this does not.
-- ---------------------------------------------------------------------

create table visitor_passes (
  id            uuid primary key default gen_random_uuid(),
  estate_id     uuid not null references estates(id),
  unit_id       uuid not null references units(id),
  created_by    uuid not null references profiles(id),
  code          text not null unique,
  visitor_name  text not null,
  visitor_phone text,
  purpose       text,
  vehicle_plate text,
  valid_from    timestamptz not null default now(),
  valid_until   timestamptz not null,
  status        pass_status not null default 'active',
  created_at    timestamptz not null default now()
);

create index visitor_passes_unit_idx   on visitor_passes (unit_id, created_at desc);
create index visitor_passes_estate_idx on visitor_passes (estate_id, created_at desc);

create table gate_events (
  id            uuid primary key default gen_random_uuid(),
  estate_id     uuid not null references estates(id),
  pass_id       uuid references visitor_passes(id),
  direction     text not null check (direction in ('in', 'out')),
  recorded_by   uuid references profiles(id),
  recorded_name text not null,
  lat           numeric(9,6),
  lng           numeric(9,6),
  accuracy      numeric(8,1),
  metres        numeric(10,1),
  on_site       boolean,
  note          text,
  recorded_at   timestamptz not null default now()
);

create index gate_events_estate_idx on gate_events (estate_id, recorded_at desc);
create index gate_events_pass_idx   on gate_events (pass_id, recorded_at);

-- ---------------------------------------------------------------------
-- Code generation
--
-- Six characters, no 0/O/1/I/L — those get misread over the phone and
-- mistyped at a gate at night, which is exactly when this gets used.
-- ---------------------------------------------------------------------

create or replace function public.new_pass_code()
returns text language plpgsql as $$
declare
  v_alphabet text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  v_code     text;
  v_try      int := 0;
begin
  loop
    v_code := '';
    for i in 1..6 loop
      v_code := v_code || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1);
    end loop;

    exit when not exists (select 1 from visitor_passes where code = v_code);

    v_try := v_try + 1;
    if v_try > 50 then
      raise exception 'Could not generate a unique pass code';
    end if;
  end loop;

  return v_code;
end $$;

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------

alter table visitor_passes enable row level security;
alter table gate_events    enable row level security;

-- A resident sees passes they created. Rule 13 still applies in the client:
-- filter by created_by explicitly as well.
create policy passes_own on visitor_passes for select
  using (created_by = auth.uid());

-- Management sees the estate.
create policy passes_staff on visitor_passes for select
  using (public.is_staff() and estate_id = public.my_estate());

-- Security sees the estate's passes, because that is the job.
create policy passes_security on visitor_passes for select
  using (public.my_role() = 'security' and estate_id = public.my_estate());

create policy gate_events_staff on gate_events for select
  using (public.is_staff() and estate_id = public.my_estate());

create policy gate_events_security on gate_events for select
  using (public.my_role() = 'security' and estate_id = public.my_estate());

-- A resident sees the comings and goings on their own passes, and no others.
create policy gate_events_own on gate_events for select
  using (exists (
    select 1 from visitor_passes p
    where p.id = gate_events.pass_id and p.created_by = auth.uid()
  ));

-- ---------------------------------------------------------------------
-- Resident: create and revoke
-- ---------------------------------------------------------------------

create or replace function public.create_visitor_pass(
  p_unit_id       uuid,
  p_visitor_name  text,
  p_visitor_phone text,
  p_purpose       text,
  p_vehicle_plate text,
  p_hours_valid   int default 12
) returns visitor_passes
language plpgsql security definer set search_path = public as $$
declare
  v_estate uuid;
  v_pass   visitor_passes;
begin
  if public.my_role() is distinct from 'resident' then
    raise exception 'Only residents can create a visitor pass';
  end if;

  select estate_id into v_estate
  from units where id = p_unit_id and resident_id = auth.uid();
  if v_estate is null then
    raise exception 'That unit is not yours';
  end if;

  if coalesce(trim(p_visitor_name), '') = '' then
    raise exception 'A pass needs the visitor''s name';
  end if;

  if p_hours_valid is null or p_hours_valid < 1 or p_hours_valid > 168 then
    raise exception 'A pass must be valid for between 1 and 168 hours';
  end if;

  insert into visitor_passes (
    estate_id, unit_id, created_by, code,
    visitor_name, visitor_phone, purpose, vehicle_plate, valid_until
  ) values (
    v_estate, p_unit_id, auth.uid(), public.new_pass_code(),
    trim(p_visitor_name),
    nullif(trim(coalesce(p_visitor_phone, '')), ''),
    nullif(trim(coalesce(p_purpose, '')), ''),
    upper(nullif(trim(coalesce(p_vehicle_plate, '')), '')),
    now() + (p_hours_valid || ' hours')::interval
  )
  returning * into v_pass;

  return v_pass;
end $$;

create or replace function public.revoke_visitor_pass(p_pass_id uuid)
returns visitor_passes
language plpgsql security definer set search_path = public as $$
declare v_pass visitor_passes;
begin
  select * into v_pass from visitor_passes where id = p_pass_id for update;
  if not found then raise exception 'No such pass'; end if;
  if v_pass.created_by <> auth.uid() then
    raise exception 'Only the resident who created it can revoke it';
  end if;
  if v_pass.status <> 'active' then
    raise exception 'That pass is already %', v_pass.status;
  end if;

  update visitor_passes set status = 'revoked'
  where id = p_pass_id returning * into v_pass;

  return v_pass;
end $$;

-- ---------------------------------------------------------------------
-- Security: verify, then admit
--
-- verify_pass reads only. It never mutates, so a gateman can check a code
-- twice without burning it — which is what actually happens at a gate.
-- ---------------------------------------------------------------------

create or replace function public.verify_pass(p_code text)
returns table (
  pass_id       uuid,
  code          text,
  visitor_name  text,
  visitor_phone text,
  purpose       text,
  vehicle_plate text,
  unit_label    text,
  resident_name text,
  resident_phone text,
  valid_until   timestamptz,
  verdict       text
)
language plpgsql security definer set search_path = public as $$
begin
  if public.my_role() not in ('security', 'facility_manager', 'ceo') then
    raise exception 'Only gate and management staff can verify a pass';
  end if;

  return query
  select
    p.id, p.code, p.visitor_name, p.visitor_phone, p.purpose, p.vehicle_plate,
    u.label, pr.full_name, pr.phone, p.valid_until,
    case
      when p.status = 'revoked'     then 'revoked'
      when p.status = 'used'        then 'already used'
      when p.valid_until < now()    then 'expired'
      when p.valid_from  > now()    then 'not valid yet'
      else 'valid'
    end
  from visitor_passes p
  join units u     on u.id = p.unit_id
  join profiles pr on pr.id = p.created_by
  where p.code = upper(trim(p_code))
    and p.estate_id = public.my_estate();
end $$;

create or replace function public.record_gate_event(
  p_code      text,
  p_direction text,
  p_lat       numeric default null,
  p_lng       numeric default null,
  p_accuracy  numeric default null,
  p_note      text    default null
) returns gate_events
language plpgsql security definer set search_path = public as $$
declare
  v_pass   visitor_passes;
  v_estate estates;
  v_metres numeric;
  v_event  gate_events;
begin
  if public.my_role() not in ('security', 'facility_manager') then
    raise exception 'Only gate staff can log an arrival';
  end if;

  if p_direction not in ('in', 'out') then
    raise exception 'Direction must be in or out';
  end if;

  select * into v_pass from visitor_passes
   where code = upper(trim(p_code)) and estate_id = public.my_estate()
   for update;
  if not found then raise exception 'No pass with that code'; end if;

  if v_pass.status = 'revoked' then
    raise exception 'That pass was revoked by the resident';
  end if;
  if v_pass.valid_until < now() then
    raise exception 'That pass expired on %',
      to_char(v_pass.valid_until at time zone 'Africa/Lagos', 'DD Mon at HH24:MI');
  end if;
  if p_direction = 'in' and v_pass.status = 'used' then
    raise exception 'That pass has already been used to enter';
  end if;

  select * into v_estate from estates where id = v_pass.estate_id;

  if p_lat is not null and p_lng is not null
     and v_estate.lat is not null and v_estate.lng is not null then
    v_metres := public.metres_between(p_lat, p_lng, v_estate.lat, v_estate.lng);
  end if;

  -- Stamp the pass and write the event together (RULE 12).
  if p_direction = 'in' then
    update visitor_passes set status = 'used' where id = v_pass.id;
  end if;

  insert into gate_events (
    estate_id, pass_id, direction, recorded_by, recorded_name,
    lat, lng, accuracy, metres, on_site, note
  ) values (
    v_pass.estate_id, v_pass.id, p_direction, auth.uid(),
    coalesce((select full_name from profiles where id = auth.uid()), 'Gate'),
    p_lat, p_lng, p_accuracy, v_metres,
    case when v_metres is null then null
         else v_metres <= v_estate.geofence_metres end,
    nullif(trim(coalesce(p_note, '')), '')
  )
  returning * into v_event;

  return v_event;
end $$;

grant execute on function public.create_visitor_pass(uuid, text, text, text, text, int) to authenticated;
grant execute on function public.revoke_visitor_pass(uuid)                              to authenticated;
grant execute on function public.verify_pass(text)                                      to authenticated;
grant execute on function public.record_gate_event(text, text, numeric, numeric, numeric, text) to authenticated;
