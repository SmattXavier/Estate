-- 001_schema.sql
-- Estate maintenance desk — identity, units, artisans, issues, audit trail.
-- Run this whole file in the Supabase SQL editor, top to bottom, once.

-- ---------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------

create type user_role       as enum ('resident', 'facility_manager', 'ceo');
create type issue_status    as enum ('submitted', 'assigned', 'resolved', 'closed');
create type issue_priority  as enum ('emergency', 'high', 'normal', 'low');
create type update_kind     as enum ('log', 'dispatch', 'resolution', 'confirmation', 'reopen', 'escalation', 'note');

-- ---------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------

create table estates (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  address     text,
  created_at  timestamptz not null default now()
);

create table profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  estate_id   uuid not null references estates(id),
  full_name   text not null,
  phone       text,
  role        user_role not null,
  created_at  timestamptz not null default now()
);

create table units (
  id          uuid primary key default gen_random_uuid(),
  estate_id   uuid not null references estates(id),
  label       text not null,                       -- 'Block C, Flat 12'
  resident_id uuid references profiles(id),
  created_at  timestamptz not null default now(),
  unique (estate_id, label)
);

-- Artisans have no login. The facility manager reaches them by phone.
create table technicians (
  id          uuid primary key default gen_random_uuid(),
  estate_id   uuid not null references estates(id),
  full_name   text not null,
  trade       text not null,                       -- 'Plumbing', 'Electrical', ...
  phone       text not null,
  engagement  text not null default 'In-house',    -- 'In-house' | 'Vendor'
  on_books_since text,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

create sequence issue_ref_seq start 1035;

create table issues (
  id                     uuid primary key default gen_random_uuid(),
  estate_id              uuid not null references estates(id),
  ref                    text not null unique,
  unit_id                uuid not null references units(id),
  reported_by            uuid not null references profiles(id),
  category               text not null,
  priority               issue_priority not null,
  title                  text not null,
  description            text not null,
  access_permission      boolean not null default false,
  status                 issue_status not null default 'submitted',

  -- The clock. clock_started_at is not created_at: reopening restarts it.
  created_at             timestamptz not null default now(),
  clock_started_at       timestamptz not null default now(),
  sla_due_at             timestamptz not null,

  assigned_at            timestamptz,
  assigned_technician_id uuid references technicians(id),
  resolved_at            timestamptz,
  closed_at              timestamptz,
  escalated_at           timestamptz,
  nudged_at              timestamptz,

  -- "what was needed", filled in at resolution. The CSV is worthless without it.
  work_done              text,
  work_materials         text,
  work_cost              numeric(12,2),

  updated_at             timestamptz not null default now()
);

create index issues_estate_status_idx on issues (estate_id, status);
create index issues_reporter_idx      on issues (reported_by);
create index issues_sweep_idx         on issues (sla_due_at) where status = 'submitted' and escalated_at is null;

create table issue_updates (
  id          uuid primary key default gen_random_uuid(),
  issue_id    uuid not null references issues(id) on delete cascade,
  author_id   uuid references profiles(id),        -- null = written by the system
  author_name text not null,                       -- frozen at write time
  kind        update_kind not null,
  body        text not null,
  created_at  timestamptz not null default now()
);

create index issue_updates_issue_idx on issue_updates (issue_id, created_at);

-- ---------------------------------------------------------------------
-- Identity helpers
--
-- SECURITY DEFINER so that a policy on `profiles` can call them without
-- recursing into `profiles`' own policies.
-- ---------------------------------------------------------------------

create or replace function public.my_role()
returns user_role language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid()
$$;

create or replace function public.my_estate()
returns uuid language sql stable security definer set search_path = public as $$
  select estate_id from profiles where id = auth.uid()
$$;

create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select role from profiles where id = auth.uid()) in ('facility_manager','ceo'), false)
$$;

-- ---------------------------------------------------------------------
-- Row level security
--
-- RULE 13: these policies are a backstop, not the scoping mechanism.
-- Every resident-facing query in the client must ALSO filter explicitly.
-- ---------------------------------------------------------------------

alter table estates       enable row level security;
alter table profiles      enable row level security;
alter table units         enable row level security;
alter table technicians   enable row level security;
alter table issues        enable row level security;
alter table issue_updates enable row level security;

create policy estates_read on estates for select
  using (id = public.my_estate());

create policy profiles_self on profiles for select
  using (id = auth.uid());

create policy profiles_staff on profiles for select
  using (public.is_staff() and estate_id = public.my_estate());

create policy units_own on units for select
  using (resident_id = auth.uid());

create policy units_staff on units for select
  using (public.is_staff() and estate_id = public.my_estate());

-- Residents never see the artisan roster. They see a name on their own
-- issue, which reaches them through the issue row, not through this table.
create policy technicians_staff on technicians for select
  using (public.is_staff() and estate_id = public.my_estate());

create policy issues_own on issues for select
  using (reported_by = auth.uid());

create policy issues_staff on issues for select
  using (public.is_staff() and estate_id = public.my_estate());

create policy issue_updates_visible on issue_updates for select
  using (exists (
    select 1 from issues i
    where i.id = issue_updates.issue_id
      and (i.reported_by = auth.uid()
           or (public.is_staff() and i.estate_id = public.my_estate()))
  ));

-- No INSERT / UPDATE / DELETE policies anywhere, deliberately.
-- Every write goes through a SECURITY DEFINER function in 003, so that the
-- state change and its audit row land in the same transaction (RULE 12).
