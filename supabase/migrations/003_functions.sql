-- 003_functions.sql
-- Every state change lives here. The client calls these; it never writes
-- to a table directly.
--
-- RULE 12: the audit row is inserted in the same transaction as the state
-- change, inside the same function. There is no path that moves an issue
-- without leaving a trace.

-- ---------------------------------------------------------------------
-- Targets
-- ---------------------------------------------------------------------

create or replace function public.sla_minutes(p issue_priority)
returns int language sql immutable as $$
  select case p
    when 'emergency' then 15
    when 'high'      then 60
    when 'normal'    then 240
    when 'low'       then 1440
  end
$$;

create or replace function public.priority_label(p issue_priority)
returns text language sql immutable as $$
  select case p
    when 'emergency' then 'emergency'
    when 'high'      then 'high'
    when 'normal'    then 'normal'
    when 'low'       then 'low'
  end
$$;

create or replace function public.my_name()
returns text language sql stable security definer set search_path = public as $$
  select full_name from profiles where id = auth.uid()
$$;

-- ---------------------------------------------------------------------
-- Resident: log a fault
-- ---------------------------------------------------------------------

create or replace function public.log_issue(
  p_unit_id           uuid,
  p_category          text,
  p_priority          issue_priority,
  p_title             text,
  p_description       text,
  p_access_permission boolean
) returns issues
language plpgsql security definer set search_path = public as $$
declare
  v_estate uuid;
  v_issue  issues;
begin
  if public.my_role() is distinct from 'resident' then
    raise exception 'Only residents can log a fault';
  end if;

  select estate_id into v_estate
  from units
  where id = p_unit_id and resident_id = auth.uid();

  if v_estate is null then
    raise exception 'That unit is not yours';
  end if;

  if coalesce(trim(p_title), '') = '' or coalesce(trim(p_description), '') = '' then
    raise exception 'A fault needs a summary and a description';
  end if;

  insert into issues (
    estate_id, ref, unit_id, reported_by, category, priority,
    title, description, access_permission, sla_due_at
  ) values (
    v_estate,
    'MR-' || nextval('issue_ref_seq'),
    p_unit_id, auth.uid(), p_category, p_priority,
    trim(p_title), trim(p_description), coalesce(p_access_permission, false),
    now() + (public.sla_minutes(p_priority) || ' minutes')::interval
  )
  returning * into v_issue;

  insert into issue_updates (issue_id, author_id, author_name, kind, body)
  values (v_issue.id, auth.uid(), public.my_name(), 'log', 'Reported the fault');

  return v_issue;
end $$;

-- ---------------------------------------------------------------------
-- Facility manager: dispatch an artisan. This is what stops the clock.
-- ---------------------------------------------------------------------

create or replace function public.assign_technician(
  p_issue_id      uuid,
  p_technician_id uuid,
  p_reply         text
) returns issues
language plpgsql security definer set search_path = public as $$
declare
  v_issue issues;
  v_tech  technicians;
begin
  if public.my_role() is distinct from 'facility_manager' then
    raise exception 'Only the facility manager can dispatch';
  end if;

  if coalesce(trim(p_reply), '') = '' then
    raise exception 'Write a reply to the resident before dispatching';
  end if;

  select * into v_issue from issues where id = p_issue_id for update;
  if not found then raise exception 'No such issue'; end if;
  if v_issue.estate_id is distinct from public.my_estate() then
    raise exception 'That issue is not on your estate';
  end if;
  if v_issue.status <> 'submitted' then
    raise exception 'Issue is already %', v_issue.status;
  end if;

  select * into v_tech
  from technicians
  where id = p_technician_id and estate_id = v_issue.estate_id and active;
  if not found then raise exception 'No such artisan on this estate'; end if;

  update issues set
    status                 = 'assigned',
    assigned_at            = now(),
    assigned_technician_id = p_technician_id,
    updated_at             = now()
  where id = p_issue_id
  returning * into v_issue;

  insert into issue_updates (issue_id, author_id, author_name, kind, body)
  values (p_issue_id, auth.uid(), public.my_name(), 'dispatch', trim(p_reply));

  return v_issue;
end $$;

-- ---------------------------------------------------------------------
-- Facility manager: record what was actually needed
-- ---------------------------------------------------------------------

create or replace function public.resolve_issue(
  p_issue_id  uuid,
  p_work_done text,
  p_materials text,
  p_cost      numeric
) returns issues
language plpgsql security definer set search_path = public as $$
declare v_issue issues;
begin
  if public.my_role() is distinct from 'facility_manager' then
    raise exception 'Only the facility manager can record a fix';
  end if;
  if coalesce(trim(p_work_done), '') = '' then
    raise exception 'Say what was done';
  end if;

  select * into v_issue from issues where id = p_issue_id for update;
  if not found then raise exception 'No such issue'; end if;
  if v_issue.estate_id is distinct from public.my_estate() then
    raise exception 'That issue is not on your estate';
  end if;
  if v_issue.status <> 'assigned' then
    raise exception 'Only a dispatched issue can be resolved, this one is %', v_issue.status;
  end if;

  update issues set
    status         = 'resolved',
    resolved_at    = now(),
    work_done      = trim(p_work_done),
    work_materials = nullif(trim(coalesce(p_materials, '')), ''),
    work_cost      = coalesce(p_cost, 0),
    updated_at     = now()
  where id = p_issue_id
  returning * into v_issue;

  insert into issue_updates (issue_id, author_id, author_name, kind, body)
  values (p_issue_id, auth.uid(), public.my_name(), 'resolution',
          'Marked resolved: ' || trim(p_work_done));

  return v_issue;
end $$;

-- ---------------------------------------------------------------------
-- Resident closes the loop. The facility manager cannot close his own work.
-- ---------------------------------------------------------------------

create or replace function public.confirm_resolution(p_issue_id uuid)
returns issues
language plpgsql security definer set search_path = public as $$
declare v_issue issues;
begin
  select * into v_issue from issues where id = p_issue_id for update;
  if not found then raise exception 'No such issue'; end if;
  if v_issue.reported_by <> auth.uid() then
    raise exception 'Only the resident who reported it can close it';
  end if;
  if v_issue.status <> 'resolved' then
    raise exception 'Nothing to confirm, this issue is %', v_issue.status;
  end if;

  update issues set status = 'closed', closed_at = now(), updated_at = now()
  where id = p_issue_id returning * into v_issue;

  insert into issue_updates (issue_id, author_id, author_name, kind, body)
  values (p_issue_id, auth.uid(), public.my_name(), 'confirmation',
          'Confirmed the work was done');

  return v_issue;
end $$;

create or replace function public.reopen_issue(p_issue_id uuid, p_reason text default null)
returns issues
language plpgsql security definer set search_path = public as $$
declare v_issue issues;
begin
  select * into v_issue from issues where id = p_issue_id for update;
  if not found then raise exception 'No such issue'; end if;
  if v_issue.reported_by <> auth.uid() then
    raise exception 'Only the resident who reported it can reopen it';
  end if;
  if v_issue.status <> 'resolved' then
    raise exception 'Only a resolved issue can be reopened, this one is %', v_issue.status;
  end if;

  -- A reopened fault gets a fresh clock, and can escalate again.
  update issues set
    status                 = 'submitted',
    clock_started_at       = now(),
    sla_due_at             = now() + (public.sla_minutes(v_issue.priority) || ' minutes')::interval,
    assigned_at            = null,
    assigned_technician_id = null,
    resolved_at            = null,
    escalated_at           = null,
    nudged_at              = null,
    updated_at             = now()
  where id = p_issue_id
  returning * into v_issue;

  insert into issue_updates (issue_id, author_id, author_name, kind, body)
  values (p_issue_id, auth.uid(), public.my_name(), 'reopen',
          coalesce(nullif(trim(coalesce(p_reason,'')), ''),
                   'Says the fault is still there') || '. Clock restarted.');

  return v_issue;
end $$;

-- ---------------------------------------------------------------------
-- CEO: chase the facility manager. Permanent, on the issue.
-- ---------------------------------------------------------------------

create or replace function public.nudge_facility_manager(p_issue_id uuid, p_note text default null)
returns issues
language plpgsql security definer set search_path = public as $$
declare v_issue issues;
begin
  if public.my_role() is distinct from 'ceo' then
    raise exception 'Only the CEO can chase';
  end if;

  select * into v_issue from issues where id = p_issue_id for update;
  if not found then raise exception 'No such issue'; end if;
  if v_issue.estate_id is distinct from public.my_estate() then
    raise exception 'That issue is not on your estate';
  end if;
  if v_issue.escalated_at is null then
    raise exception 'This issue has not passed its target yet';
  end if;

  update issues set nudged_at = now(), updated_at = now()
  where id = p_issue_id returning * into v_issue;

  insert into issue_updates (issue_id, author_id, author_name, kind, body)
  values (p_issue_id, auth.uid(), public.my_name(), 'escalation',
          coalesce(nullif(trim(coalesce(p_note,'')), ''),
                   'Asked the facility manager to attend to this immediately.'));

  return v_issue;
end $$;

-- ---------------------------------------------------------------------
-- The escalation sweep.
--
-- This is the whole product. It must run server-side on a schedule — an
-- alert that only exists while somebody has a dashboard open is not an
-- alert. Stamp and audit row happen in one statement (RULE 12).
-- ---------------------------------------------------------------------

create or replace function public.escalate_overdue()
returns int
language plpgsql security definer set search_path = public as $$
declare v_count int;
begin
  with due as (
    update issues
       set escalated_at = now(), updated_at = now()
     where status = 'submitted'
       and escalated_at is null
       and sla_due_at < now()
    returning id, priority
  ),
  logged as (
    insert into issue_updates (issue_id, author_id, author_name, kind, body)
    select d.id, null, 'System', 'escalation',
           'No artisan assigned within the ' || public.priority_label(d.priority)
           || ' target. Raised to the CEO.'
      from due d
    returning 1
  )
  select count(*) into v_count from logged;

  return v_count;
end $$;

-- ---------------------------------------------------------------------
-- The CEO's export. One select, every column the CSV needs.
-- ---------------------------------------------------------------------

create or replace view issue_export
with (security_invoker = on) as
select
  i.ref                                                as "Reference",
  to_char(i.created_at at time zone 'Africa/Lagos',
          'DD Mon YYYY HH24:MI')                       as "Logged",
  e.name                                               as "Estate",
  u.label                                              as "Unit",
  p.full_name                                          as "Resident",
  p.phone                                              as "Phone",
  i.category                                           as "Category",
  i.priority::text                                     as "Priority",
  i.title                                              as "Summary",
  i.description                                        as "Description",
  i.status::text                                       as "Status",
  t.full_name                                          as "Artisan",
  t.trade                                              as "Trade",
  to_char(i.assigned_at at time zone 'Africa/Lagos',
          'DD Mon YYYY HH24:MI')                       as "Assigned at",
  case when i.assigned_at is not null
       then round(extract(epoch from (i.assigned_at - i.clock_started_at)) / 60)
  end                                                  as "Minutes to assign",
  public.sla_minutes(i.priority)                       as "Target minutes",
  case when i.assigned_at is null then null
       when i.assigned_at <= i.sla_due_at then 'Yes' else 'No' end
                                                       as "Target met",
  case when i.escalated_at is not null then 'Yes' else 'No' end
                                                       as "Escalated to CEO",
  case when i.nudged_at is not null then 'Yes' else 'No' end
                                                       as "CEO chased",
  to_char(i.resolved_at at time zone 'Africa/Lagos',
          'DD Mon YYYY HH24:MI')                       as "Resolved at",
  i.work_done                                          as "What was needed",
  i.work_materials                                     as "Parts used",
  i.work_cost                                          as "Cost (NGN)"
from issues i
join estates e on e.id = i.estate_id
join units   u on u.id = i.unit_id
join profiles p on p.id = i.reported_by
left join technicians t on t.id = i.assigned_technician_id
order by i.created_at desc;

-- ---------------------------------------------------------------------
-- Grants. Function bodies do the role checks; PostgREST needs to see them.
-- ---------------------------------------------------------------------

grant execute on function public.log_issue(uuid, text, issue_priority, text, text, boolean) to authenticated;
grant execute on function public.assign_technician(uuid, uuid, text)            to authenticated;
grant execute on function public.resolve_issue(uuid, text, text, numeric)       to authenticated;
grant execute on function public.confirm_resolution(uuid)                       to authenticated;
grant execute on function public.reopen_issue(uuid, text)                       to authenticated;
grant execute on function public.nudge_facility_manager(uuid, text)             to authenticated;
grant select on issue_export to authenticated;

-- escalate_overdue is deliberately NOT granted to authenticated.
-- Only the cron job runs it.
revoke execute on function public.escalate_overdue() from public, authenticated;

-- ---------------------------------------------------------------------
-- Schedule the sweep.
--
-- Dashboard → Database → Extensions → enable `pg_cron` first, then run
-- this block. If pg_cron is not enabled, this raises and nothing else in
-- the file is affected.
-- ---------------------------------------------------------------------

-- create extension if not exists pg_cron;
-- select cron.schedule(
--   'escalate-overdue-issues',
--   '* * * * *',
--   $cron$ select public.escalate_overdue(); $cron$
-- );
