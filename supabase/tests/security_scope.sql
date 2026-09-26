-- security_scope.sql
--
-- Asserts that 011 opened unit labels to the gate and nothing else.
-- Paste the whole file into the SQL editor of the ESTATE project and run.
-- "Run without RLS" at the temp-table warning. Ends in ROLLBACK.

begin;

create temp table t_result (
  seq serial primary key, step text, detail text, verdict text
) on commit drop;

grant all on t_result to authenticated;
grant usage on all sequences in schema pg_temp to authenticated;

do $$
declare
  v_sec uuid; v_res uuid; v_fm uuid;
  v_n int; v_txt text;
begin
  select id into v_sec from auth.users where email = 'security@demo.test';
  select id into v_res from auth.users where email = 'resident@demo.test';
  select id into v_fm  from auth.users where email = 'fm@demo.test';

  if v_sec is null then raise exception 'Run 008_seed_phase2.sql first'; end if;

  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_sec)::text, true);

  -- ---------- what 011 opens ----------

  select count(*) into v_n from units;
  insert into t_result (step, detail, verdict) values
    ('1 gate sees units', v_n || ' (expect 7)',
     case when v_n = 7 then 'PASS' else 'FAIL' end);

  select label into v_txt from units order by label limit 1;
  insert into t_result (step, detail, verdict) values
    ('1b and can read the label', coalesce(v_txt, 'null'),
     case when v_txt is not null then 'PASS' else 'FAIL' end);

  -- ---------- what must stay shut ----------

  select count(*) into v_n from issues;
  insert into t_result (step, detail, verdict) values
    ('2 gate sees issues', v_n || ' (must be 0)',
     case when v_n = 0 then 'PASS' else 'FAIL' end);

  select count(*) into v_n from service_bill_status;
  insert into t_result (step, detail, verdict) values
    ('3 gate sees bills', v_n || ' (must be 0)',
     case when v_n = 0 then 'PASS' else 'FAIL' end);

  select count(*) into v_n from technicians;
  insert into t_result (step, detail, verdict) values
    ('4 gate sees the artisan roster', v_n || ' (must be 0)',
     case when v_n = 0 then 'PASS' else 'FAIL' end);

  select count(*) into v_n from profiles;
  insert into t_result (step, detail, verdict) values
    ('5 gate sees profiles', v_n || ' (must be 1, their own)',
     case when v_n = 1 then 'PASS' else 'FAIL' end);

  select count(*) into v_n from staff_shifts;
  insert into t_result (step, detail, verdict) values
    ('6 gate sees shifts', v_n || ' (own only, not the estate)',
     case when v_n <= 1 then 'PASS' else 'FAIL' end);

  -- ---------- and what the gate still needs ----------

  select count(*) into v_n from visitor_passes;
  insert into t_result (step, detail, verdict) values
    ('7 gate sees passes', v_n || ' (must be > 0)',
     case when v_n > 0 then 'PASS' else 'FAIL' end);

  select count(*) into v_n from gate_events;
  insert into t_result (step, detail, verdict) values
    ('8 gate sees its own log', v_n || ' (must be > 0)',
     case when v_n > 0 then 'PASS' else 'FAIL' end);

  -- ---------- nobody else gained anything ----------

  perform set_config('request.jwt.claims', json_build_object('sub', v_res)::text, true);
  select count(*) into v_n from units;
  insert into t_result (step, detail, verdict) values
    ('9 resident still sees own units only', v_n || ' (expect 2)',
     case when v_n = 2 then 'PASS' else 'FAIL' end);

  perform set_config('request.jwt.claims', json_build_object('sub', v_fm)::text, true);
  select count(*) into v_n from units;
  insert into t_result (step, detail, verdict) values
    ('10 manager still sees the estate', v_n || ' (expect 7)',
     case when v_n = 7 then 'PASS' else 'FAIL' end);

  perform set_config('role', 'postgres', true);
end $$;

select verdict, step, detail
from t_result
order by (verdict = 'PASS'), seq;

rollback;
