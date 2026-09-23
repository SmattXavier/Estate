-- full_lifecycle.sql  (v2 — returns a table, not notices)
--
-- Proves the maintenance workflow end to end: log, escalate, chase,
-- dispatch, resolve, reject, restart, close, and read scoping.
--
-- The Supabase SQL editor does not display RAISE NOTICE output, so this
-- version writes every check into a temp table and selects it at the end.
-- You get a grid: verdict, step, detail. FAILs sort to the top.
--
-- Paste the WHOLE file into the SQL editor of the ESTATE project and run.
-- Click "Run without RLS" at the temp-table warning — the table is dropped
-- at commit and the whole thing rolls back, so nothing is exposed.
--
-- Requires 002_seed.sql to have been run. Leaves your data untouched.

begin;

create temp table t_result (
  seq     serial primary key,
  step    text,
  detail  text,
  verdict text
) on commit drop;

-- Section 9 switches the current role to `authenticated` to prove the RLS
-- scoping. That role must still be able to write its findings here.
grant all on t_result to authenticated;
grant usage on all sequences in schema pg_temp to authenticated;

do $$
declare
  v_res uuid; v_fm uuid; v_ceo uuid;
  v_unit uuid; v_tech uuid;
  v_issue issues;
  v_id uuid;
  v_n int;
begin
  select id into v_res from auth.users where email = 'resident@demo.test';
  select id into v_fm  from auth.users where email = 'fm@demo.test';
  select id into v_ceo from auth.users where email = 'ceo@demo.test';
  select id into v_unit from units where label = 'Block C, Flat 12';
  select id into v_tech from technicians where full_name = 'Emeka Obi';

  if v_res is null or v_unit is null or v_tech is null then
    raise exception 'Run 002_seed.sql first';
  end if;

  -- ===================== 1. Resident logs a fault =====================

  perform set_config('request.jwt.claims', json_build_object('sub', v_res)::text, true);

  select * into v_issue from public.log_issue(
    v_unit, 'Plumbing', 'high',
    'Test: burst pipe under the sink',
    'Water everywhere, started ten minutes ago.',
    true);
  v_id := v_issue.id;

  insert into t_result (step, detail, verdict) values
    ('1 logged', v_issue.ref || ', status ' || v_issue.status,
     case when v_issue.status = 'submitted' then 'PASS' else 'FAIL' end);

  insert into t_result (step, detail, verdict) values
    ('1b high = 60 min target',
     round(extract(epoch from (v_issue.sla_due_at - v_issue.clock_started_at)) / 60) || ' min',
     case when round(extract(epoch from (v_issue.sla_due_at - v_issue.clock_started_at)) / 60) = 60
          then 'PASS' else 'FAIL' end);

  select count(*) into v_n from issue_updates where issue_id = v_id;
  insert into t_result (step, detail, verdict) values
    ('1c audit row, same transaction (Rule 12)', v_n || ' row(s), expect 1',
     case when v_n = 1 then 'PASS' else 'FAIL' end);

  -- ===================== 2. Resident cannot dispatch =====================

  begin
    perform public.assign_technician(v_id, v_tech, 'I will fix it myself');
    insert into t_result (step, detail, verdict) values
      ('2 resident dispatches', 'a resident was allowed to dispatch', 'FAIL');
  exception when others then
    insert into t_result (step, detail, verdict) values
      ('2 resident dispatches', SQLERRM, 'PASS');
  end;

  -- ===================== 3. The sweep escalates =====================

  update issues set sla_due_at = now() - interval '1 min' where id = v_id;

  select public.escalate_overdue() into v_n;
  select * into v_issue from issues where id = v_id;

  insert into t_result (step, detail, verdict) values
    ('3 sweep escalates', v_n || ' issue(s) stamped this run',
     case when v_issue.escalated_at is not null then 'PASS' else 'FAIL' end);

  select count(*) into v_n from issue_updates
   where issue_id = v_id and kind = 'escalation';
  insert into t_result (step, detail, verdict) values
    ('3b escalation on the timeline', v_n || ' row(s), expect 1',
     case when v_n = 1 then 'PASS' else 'FAIL' end);

  perform public.escalate_overdue();
  select count(*) into v_n from issue_updates
   where issue_id = v_id and kind = 'escalation';
  insert into t_result (step, detail, verdict) values
    ('3c sweep is idempotent', 'still ' || v_n || ' escalation row(s) after a second sweep',
     case when v_n = 1 then 'PASS' else 'FAIL' end);

  -- ===================== 4. CEO chases =====================

  perform set_config('request.jwt.claims', json_build_object('sub', v_ceo)::text, true);

  select * into v_issue from public.nudge_facility_manager(v_id);
  insert into t_result (step, detail, verdict) values
    ('4 CEO chases', 'nudged at ' || to_char(v_issue.nudged_at, 'HH24:MI'),
     case when v_issue.nudged_at is not null then 'PASS' else 'FAIL' end);

  select count(*) into v_n from issue_updates
   where issue_id = v_id and kind = 'escalation' and author_id = v_ceo;
  insert into t_result (step, detail, verdict) values
    ('4b the chase is permanent', v_n || ' row(s) by the CEO, expect 1',
     case when v_n = 1 then 'PASS' else 'FAIL' end);

  begin
    perform public.assign_technician(v_id, v_tech, 'Doing it myself');
    insert into t_result (step, detail, verdict) values
      ('4c CEO dispatches', 'the CEO was allowed to dispatch', 'FAIL');
  exception when others then
    insert into t_result (step, detail, verdict) values
      ('4c CEO dispatches', SQLERRM, 'PASS');
  end;

  -- ===================== 5. Manager dispatches =====================

  perform set_config('request.jwt.claims', json_build_object('sub', v_fm)::text, true);

  begin
    perform public.assign_technician(v_id, v_tech, '   ');
    insert into t_result (step, detail, verdict) values
      ('5 empty reply', 'dispatched with an empty reply', 'FAIL');
  exception when others then
    insert into t_result (step, detail, verdict) values
      ('5 empty reply', SQLERRM, 'PASS');
  end;

  select * into v_issue from public.assign_technician(
    v_id, v_tech, 'Dispatched Emeka Obi (Plumbing), 0803 552 8811. He is on his way.');

  insert into t_result (step, detail, verdict) values
    ('5b dispatched, clock stops', 'status ' || v_issue.status
      || ', assigned ' || to_char(v_issue.assigned_at, 'HH24:MI'),
     case when v_issue.status = 'assigned' then 'PASS' else 'FAIL' end);

  begin
    perform public.assign_technician(v_id, v_tech, 'Again');
    insert into t_result (step, detail, verdict) values
      ('5c double dispatch', 'allowed a second dispatch', 'FAIL');
  exception when others then
    insert into t_result (step, detail, verdict) values
      ('5c double dispatch', SQLERRM, 'PASS');
  end;

  -- ===================== 6. Manager records the fix =====================

  begin
    perform public.resolve_issue(v_id, '', 'nothing', 0);
    insert into t_result (step, detail, verdict) values
      ('6 blank work description', 'resolved with nothing written', 'FAIL');
  exception when others then
    insert into t_result (step, detail, verdict) values
      ('6 blank work description', SQLERRM, 'PASS');
  end;

  select * into v_issue from public.resolve_issue(
    v_id, 'Replaced the burst section of pipe and the compression joint.',
    '1x 15mm copper section, 2x compression joints', 22000);

  insert into t_result (step, detail, verdict) values
    ('6b what was needed recorded', 'N' || to_char(v_issue.work_cost, 'FM999,999')
      || ', ' || left(v_issue.work_done, 40) || '...',
     case when v_issue.work_done is not null then 'PASS' else 'FAIL' end);

  begin
    perform public.confirm_resolution(v_id);
    insert into t_result (step, detail, verdict) values
      ('6c manager closes own job', 'the manager closed his own work', 'FAIL');
  exception when others then
    insert into t_result (step, detail, verdict) values
      ('6c manager closes own job', SQLERRM, 'PASS');
  end;

  -- ===================== 7. Resident rejects =====================

  perform set_config('request.jwt.claims', json_build_object('sub', v_res)::text, true);

  select * into v_issue from public.reopen_issue(v_id, 'Still leaking overnight');

  insert into t_result (step, detail, verdict) values
    ('7 reopened, clock restarts',
     'status ' || v_issue.status || ', new target in '
       || round(extract(epoch from (v_issue.sla_due_at - now())) / 60) || ' min',
     case when v_issue.status = 'submitted' then 'PASS' else 'FAIL' end);

  insert into t_result (step, detail, verdict) values
    ('7b old escalation cleared',
     coalesce(v_issue.escalated_at::text, 'cleared'),
     case when v_issue.escalated_at is null then 'PASS' else 'FAIL' end);

  insert into t_result (step, detail, verdict) values
    ('7c old artisan detached',
     coalesce(v_issue.assigned_technician_id::text, 'none'),
     case when v_issue.assigned_technician_id is null then 'PASS' else 'FAIL' end);

  -- ===================== 8. Round two, closed properly =====================

  perform set_config('request.jwt.claims', json_build_object('sub', v_fm)::text, true);
  perform public.assign_technician(v_id, v_tech, 'Sending Emeka back this evening.');
  perform public.resolve_issue(v_id, 'Re-cut and re-soldered the joint.', '1x coupling', 6000);

  perform set_config('request.jwt.claims', json_build_object('sub', v_res)::text, true);
  select * into v_issue from public.confirm_resolution(v_id);

  insert into t_result (step, detail, verdict) values
    ('8 resident closes it', 'closed at ' || to_char(v_issue.closed_at, 'HH24:MI'),
     case when v_issue.status = 'closed' then 'PASS' else 'FAIL' end);

  select count(*) into v_n from issue_updates where issue_id = v_id;
  insert into t_result (step, detail, verdict) values
    ('8b full history on one issue', v_n || ' timeline entries',
     case when v_n >= 8 then 'PASS' else 'FAIL' end);

  -- ===================== 9. Read scoping (Rule 13 backstop) =====================

  perform set_config('role', 'authenticated', true);

  perform set_config('request.jwt.claims', json_build_object('sub', v_res)::text, true);
  select count(*) into v_n from technicians;
  insert into t_result (step, detail, verdict) values
    ('9 resident sees artisans', v_n || ' (must be 0)',
     case when v_n = 0 then 'PASS' else 'FAIL' end);

  perform set_config('request.jwt.claims', json_build_object('sub', v_fm)::text, true);
  select count(*) into v_n from technicians;
  insert into t_result (step, detail, verdict) values
    ('9b manager sees the roster', v_n || ' (must be 10)',
     case when v_n = 10 then 'PASS' else 'FAIL' end);

  perform set_config('request.jwt.claims', json_build_object('sub', v_ceo)::text, true);
  select count(*) into v_n from issue_export;
  insert into t_result (step, detail, verdict) values
    ('9c CEO export returns rows', v_n || ' rows (must be > 0)',
     case when v_n > 0 then 'PASS' else 'FAIL' end);

  perform set_config('role', 'postgres', true);
end $$;

select verdict, step, detail
from t_result
order by (verdict = 'PASS'), seq;

rollback;