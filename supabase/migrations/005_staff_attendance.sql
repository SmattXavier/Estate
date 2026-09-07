-- 005_staff_attendance.sql
--
-- Run AFTER 004_roles.sql has completed on its own.
--
-- Gives artisans and security officers real logins, puts a geofence on the
-- estate, and records clock-in / clock-out with the coordinates that prove
-- the person was actually on site.

-- ---------------------------------------------------------------------
-- The estate gets a location and a fence
-- ---------------------------------------------------------------------

alter table estates
  add column if not exists lat             numeric(9,6),
  add column if not exists lng             numeric(9,6),
  add column if not exists geofence_metres int not null default 300;

-- ---------------------------------------------------------------------
-- Staff become people who can sign in
--
-- The technicians table stays the staff roster. It is not renamed, because
-- assign_technician and the whole board already depend on the name.
-- ---------------------------------------------------------------------

alter table technicians
  add column if not exists profile_id uuid unique references profiles(id),
  add column if not exists staff_kind text not null default 'artisan'
      check (staff_kind in ('artisan', 'security'));

create index if not exists technicians_profile_idx on technicians (profile_id);

-- ---------------------------------------------------------------------
-- Distance, by hand.
--
-- Deliberately not using earthdistance/cube. This project has already lost
-- time to an extension that would not enable; a haversine in plain SQL has
-- no dependencies and is accurate to well within a geofence's tolerance.
-- ---------------------------------------------------------------------

create or replace function public.metres_between(
  lat1 numeric, lng1 numeric, lat2 numeric, lng2 numeric
) returns numeric
language sql immutable as $$
  select round((
    6371000 * 2 * asin(sqrt(
        power(sin(radians(lat2 - lat1) / 2), 2)
        + cos(radians(lat1)) * cos(radians(lat2))
          * power(sin(radians(lng2 - lng1) / 2), 2)
    ))
  )::numeric, 1)
$$;

-- ---------------------------------------------------------------------
-- Shifts
-- ---------------------------------------------------------------------

create table if not exists staff_shifts (
  id                   uuid primary key default gen_random_uuid(),
  estate_id            uuid not null references estates(id),
  technician_id        uuid not null references technicians(id),

  clock_in_at          timestamptz not null default now(),
  clock_in_lat         numeric(9,6),
  clock_in_lng         numeric(9,6),
  clock_in_accuracy    numeric(8,1),
  clock_in_metres      numeric(10,1),
  clock_in_on_site     boolean,

  clock_out_at         timestamptz,
  clock_out_lat        numeric(9,6),
  clock_out_lng        numeric(9,6),
  clock_out_accuracy   numeric(8,1),
  clock_out_metres     numeric(10,1),
  clock_out_on_site    boolean,

  created_at           timestamptz not null default now()
);

-- One open shift per person. The database enforces it, not the UI.
create unique index if not exists staff_shifts_one_open_idx
  on staff_shifts (technician_id) where clock_out_at is null;

create index if not exists staff_shifts_estate_idx
  on staff_shifts (estate_id, clock_in_at desc);

-- ---------------------------------------------------------------------
-- Identity helper
-- ---------------------------------------------------------------------

create or replace function public.my_technician_id()
returns uuid language sql stable security definer set search_path = public as $$
  select id from technicians where profile_id = auth.uid() and active
$$;

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------

alter table staff_shifts enable row level security;

-- Staff see their own shifts only.
create policy staff_shifts_own on staff_shifts for select
  using (technician_id = public.my_technician_id());

-- Management sees the whole estate.
create policy staff_shifts_staff on staff_shifts for select
  using (public.is_staff() and estate_id = public.my_estate());

-- Artisans and security can see their own roster row, so a screen can greet
-- them by name and trade. They still cannot see the rest of the roster —
-- technicians_staff covers management, and is_staff() excludes these roles.
create policy technicians_self on technicians for select
  using (profile_id = auth.uid());

-- An artisan sees the jobs assigned to them, and nothing else.
create policy issues_artisan on issues for select
  using (assigned_technician_id = public.my_technician_id());

create policy issue_updates_artisan on issue_updates for select
  using (exists (
    select 1 from issues i
    where i.id = issue_updates.issue_id
      and i.assigned_technician_id = public.my_technician_id()
  ));

-- ---------------------------------------------------------------------
-- Clock in / clock out
--
-- RULE 12: the shift row and its geo evidence are written together. There
-- is no path that records attendance without recording where it happened.
-- ---------------------------------------------------------------------

create or replace function public.clock_in(
  p_lat numeric, p_lng numeric, p_accuracy numeric default null
) returns staff_shifts
language plpgsql security definer set search_path = public as $$
declare
  v_tech    technicians;
  v_estate  estates;
  v_metres  numeric;
  v_shift   staff_shifts;
begin
  select * into v_tech from technicians where profile_id = auth.uid() and active;
  if not found then
    raise exception 'You are not on the staff roster for this estate';
  end if;

  if exists (select 1 from staff_shifts
              where technician_id = v_tech.id and clock_out_at is null) then
    raise exception 'You are already clocked in';
  end if;

  select * into v_estate from estates where id = v_tech.estate_id;

  -- Location is recorded, never required. A phone with GPS off must still be
  -- able to clock in; the row simply carries no proof, and the manager can
  -- see that it does not.
  if p_lat is not null and p_lng is not null
     and v_estate.lat is not null and v_estate.lng is not null then
    v_metres := public.metres_between(p_lat, p_lng, v_estate.lat, v_estate.lng);
  end if;

  insert into staff_shifts (
    estate_id, technician_id,
    clock_in_lat, clock_in_lng, clock_in_accuracy,
    clock_in_metres, clock_in_on_site
  ) values (
    v_tech.estate_id, v_tech.id,
    p_lat, p_lng, p_accuracy,
    v_metres,
    case when v_metres is null then null
         else v_metres <= v_estate.geofence_metres end
  )
  returning * into v_shift;

  return v_shift;
end $$;

create or replace function public.clock_out(
  p_lat numeric, p_lng numeric, p_accuracy numeric default null
) returns staff_shifts
language plpgsql security definer set search_path = public as $$
declare
  v_tech   technicians;
  v_estate estates;
  v_metres numeric;
  v_shift  staff_shifts;
begin
  select * into v_tech from technicians where profile_id = auth.uid() and active;
  if not found then
    raise exception 'You are not on the staff roster for this estate';
  end if;

  select * into v_shift from staff_shifts
   where technician_id = v_tech.id and clock_out_at is null
   for update;
  if not found then
    raise exception 'You are not clocked in';
  end if;

  select * into v_estate from estates where id = v_tech.estate_id;

  if p_lat is not null and p_lng is not null
     and v_estate.lat is not null and v_estate.lng is not null then
    v_metres := public.metres_between(p_lat, p_lng, v_estate.lat, v_estate.lng);
  end if;

  update staff_shifts set
    clock_out_at       = now(),
    clock_out_lat      = p_lat,
    clock_out_lng      = p_lng,
    clock_out_accuracy = p_accuracy,
    clock_out_metres   = v_metres,
    clock_out_on_site  = case when v_metres is null then null
                              else v_metres <= v_estate.geofence_metres end
  where id = v_shift.id
  returning * into v_shift;

  return v_shift;
end $$;

-- ---------------------------------------------------------------------
-- Attendance roll-up for the manager
-- ---------------------------------------------------------------------

create or replace view staff_attendance
with (security_invoker = on) as
select
  s.id,
  s.estate_id,
  t.full_name,
  t.trade,
  t.staff_kind,
  s.clock_in_at,
  s.clock_out_at,
  s.clock_in_on_site,
  s.clock_out_on_site,
  s.clock_in_metres,
  case when s.clock_out_at is null
       then round(extract(epoch from (now() - s.clock_in_at)) / 60)
       else round(extract(epoch from (s.clock_out_at - s.clock_in_at)) / 60)
  end as minutes,
  s.clock_out_at is null as on_shift
from staff_shifts s
join technicians t on t.id = s.technician_id
order by s.clock_in_at desc;

grant execute on function public.clock_in(numeric, numeric, numeric)  to authenticated;
grant execute on function public.clock_out(numeric, numeric, numeric) to authenticated;
grant select on staff_attendance to authenticated;
