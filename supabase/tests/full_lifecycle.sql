-- full_lifecycle.sql
-- Proves the whole workflow before any UI exists.
--
-- Paste the entire file into the Supabase SQL editor and run it once.
-- It ends in ROLLBACK, so it leaves your demo data untouched.
--
-- It impersonates each of the three users by setting the JWT claim that
-- auth.uid() reads. Every step prints a NOTICE. Read them top to bottom:
-- any FAILED line means stop and fix before building the UI.

begin;

do $$
declare
  v_res uuid; v_fm uuid; v_ceo uuid;
  v_unit uuid; v_tech uuid; v_wrong_tech uuid;
  v_issue issues;
  v_id uuid;
  v_n int;
  v_seen int;
  v_msg text;
begin
  select id into v_res from auth.users where email = 'resident@demo.test';
  select id into v_fm  from auth.users where email = 'fm@demo.test';
  select id into v_ceo from auth.users where email = 'ceo@demo.test';
  select id into v_unit from units where label = 'Block C, Flat 12';
  select id into v_tech from technicians where full_name = 'Emeka Obi';
  select id into v_wrong_tech from technicians where full_name = 'Joseph Okon';

  if v_res is null or v_unit is null then
    raise exception 'Run 002_seed.sql first';
  end if;

  -- =================================================================
  -- 1. Resident logs a fault
  -- =================================================================
  perform set_config('request.jwt.claims', json_build_object('sub', v_res)::text, true);

  select * into v_issue from public.log_issue(
    v_unit, 'Plumbing', 'high',
    'Test: burst pipe under the sink',
    'Water everywhere, started ten minutes ago.',
    true);
  v_id := v_issue.id;

  raise notice '1. Logged % — status %, due in % min',
    v_issue.ref, v_issue.status,
    round(extract(epoch from (v_issue.sla_due_at - now())) / 60);

  if v_issue.status <> 'submitted' then raise notice '   FAILED: should be submitted'; end if;
  if round(extract(epoch from (v_issue.sla_due_at - v_issue.clock_started_at)) / 60) <> 60 then
    raise notice '   FAILED: high priority should give a 60 minute target';
  end if;

  select count(*) into v_n from issue_updates where issue_id = v_id;
  if v_n <> 1 then raise notice '   FAILED: expected 1 audit row, found %', v_n;
  else raise notice '   Audit row written in the same transaction (Rule 12)'; end if;

  -- =================================================================
  -- 2. Resident cannot dispatch
  -- =================================================================
  begin
    perform public.assign_technician(v_id, v_tech, 'I will fix it myself');
    raise notice '2. FAILED: a resident was allowed to dispatch';
  exception when others then
    raise notice '2. Resident blocked from dispatching: %', SQLERRM;
  end;

  -- =================================================================
  -- 3. The sweep escalates it once the target passes
  -- =================================================================
  update issues set sla_due_at = now() - interval '1 min' where id = v_id;

  select public.escalate_overdue() into v_n;
  select * into v_issue from issues where id = v_id;

  raise notice '3. Sweep escalated % issue(s); this one stamped at %', v_n, v_issue.escalated_at;
  if v_issue.escalated_at is null then raise notice '   FAILED: escalated_at not set'; end if;

  select count(*) into v_n from issue_updates where issue_id = v_id and kind = 'escalation';
  if v_n <> 1 then raise notice '   FAILED: expected 1 escalation audit row, found %', v_n;
  else raise notice '   Escalation logged to the timeline'; end if;

  -- Idempotent: a second sweep must not re-escalate or double-log
  perform public.escalate_overdue();
  select count(*) into v_n from issue_updates where issue_id = v_id and kind = 'escalation';
  if v_n <> 1 then raise notice '   FAILED: sweep is not idempotent, % escalation rows', v_n;
  else raise notice '   Second sweep changed nothing (idempotent)'; end if;

  -- =================================================================
  -- 4. CEO chases the facility manager
  -- =================================================================
  perform set_config('request.jwt.claims', json_build_object('sub', v_ceo)::text, true);

  select * into v_issue from public.nudge_facility_manager(v_id);
  raise notice '4. CEO chased at %', v_issue.nudged_at;
  if v_issue.nudged_at is null then raise notice '   FAILED: nudged_at not set'; end if;

  select count(*) into v_n from issue_updates
   where issue_id = v_id and kind = 'escalation' and author_id = v_ceo;
  if v_n <> 1 then raise notice '   FAILED: the chase left no permanent record';
  else raise notice '   The chase is on the record, not just a phone call'; end if;

  -- CEO cannot dispatch
  begin
    perform public.assign_technician(v_id, v_tech, 'Doing it myself');
    raise notice '   FAILED: the CEO was allowed to dispatch';
  exception when others then
    raise notice '   CEO blocked from dispatching: %', SQLERRM;
  end;

  -- =================================================================
  -- 5. Facility manager dispatches. This stops the clock.
  -- =================================================================
  perform set_config('request.jwt.claims', json_build_object('sub', v_fm)::text, true);

  -- Empty reply must be refused: dispatching without telling the resident
  -- is exactly the behaviour this product exists to stop.
  begin
    perform public.assign_technician(v_id, v_tech, '   ');
    raise notice '5. FAILED: dispatched with an empty reply';
  exception when others then
    raise notice '5. Empty reply refused: %', SQLERRM;
  end;

  select * into v_issue from public.assign_technician(
    v_id, v_tech, 'Dispatched Emeka Obi (Plumbing), 0803 552 8811. He is on his way.');

  raise notice '   Dispatched — status %, assigned at %', v_issue.status, v_issue.assigned_at;
  if v_issue.status <> 'assigned' then raise notice '   FAILED: should be assigned'; end if;

  -- Double dispatch must be refused
  begin
    perform public.assign_technician(v_id, v_tech, 'Again');
    raise notice '   FAILED: allowed a second dispatch';
  exception when others then
    raise notice '   Second dispatch refused: %', SQLERRM;
  end;

  -- =================================================================
  -- 6. Facility manager records what was needed
  -- =================================================================
  begin
    perform public.resolve_issue(v_id, '', 'nothing', 0);
    raise notice '6. FAILED: resolved with no work description';
  exception when others then
    raise notice '6. Blank work description refused: %', SQLERRM;
  end;

  select * into v_issue from public.resolve_issue(
    v_id, 'Replaced the burst section of pipe and the compression joint.',
    '1x 15mm copper section, 2x compression joints', 22000);

  raise notice '   Resolved — cost recorded as %', v_issue.work_cost;
  if v_issue.work_done is null then raise notice '   FAILED: work_done empty, the CSV would be useless'; end if;

  -- The facility manager must not be able to close his own work
  begin
    perform public.confirm_resolution(v_id);
    raise notice '   FAILED: the facility manager closed his own job';
  exception when others then
    raise notice '   Facility manager cannot close his own job: %', SQLERRM;
  end;

  -- =================================================================
  -- 7. Resident rejects, then the clock restarts
  -- =================================================================
  perform set_config('request.jwt.claims', json_build_object('sub', v_res)::text, true);

  select * into v_issue from public.reopen_issue(v_id, 'Still leaking overnight');
  raise notice '7. Reopened — status %, escalated_at %, new target in % min',
    v_issue.status, coalesce(v_issue.escalated_at::text, 'cleared'),
    round(extract(epoch from (v_issue.sla_due_at - now())) / 60);

  if v_issue.escalated_at is not null then raise notice '   FAILED: old escalation not cleared'; end if;
  if v_issue.assigned_technician_id is not null then raise notice '   FAILED: old artisan still attached'; end if;

  -- =================================================================
  -- 8. Round two, closed properly
  -- =================================================================
  perform set_config('request.jwt.claims', json_build_object('sub', v_fm)::text, true);
  perform public.assign_technician(v_id, v_tech, 'Sending Emeka back this evening.');
  perform public.resolve_issue(v_id, 'Re-cut and re-soldered the joint.', '1x coupling', 6000);

  perform set_config('request.jwt.claims', json_build_object('sub', v_res)::text, true);
  select * into v_issue from public.confirm_resolution(v_id);
  raise notice '8. Closed by the resident at %', v_issue.closed_at;
  if v_issue.status <> 'closed' then raise notice '   FAILED: should be closed'; end if;

  select count(*) into v_n from issue_updates where issue_id = v_id;
  raise notice '   Full history: % entries on one issue', v_n;

  -- =================================================================
  -- 9. Reading is scoped (Rule 13 backstop)
  -- =================================================================
  perform set_config('role', 'authenticated', true);

  perform set_config('request.jwt.claims', json_build_object('sub', v_res)::text, true);
  select count(*) into v_seen from technicians;
  raise notice '9. Resident sees % artisans (must be 0)', v_seen;
  if v_seen <> 0 then raise notice '   FAILED: the artisan roster leaked to a resident'; end if;

  perform set_config('request.jwt.claims', json_build_object('sub', v_fm)::text, true);
  select count(*) into v_seen from technicians;
  raise notice '   Facility manager sees % artisans (must be 10)', v_seen;
  if v_seen <> 10 then raise notice '   FAILED: manager cannot see the roster'; end if;

  perform set_config('request.jwt.claims', json_build_object('sub', v_ceo)::text, true);
  select count(*) into v_seen from issue_export;
  raise notice '   CEO export returns % rows', v_seen;
  if v_seen = 0 then raise notice '   FAILED: the export is empty for the CEO'; end if;

  perform set_config('role', 'postgres', true);
  raise notice '--- Lifecycle complete. Rolling back, your demo data is unchanged. ---';
end $$;

rollback;
