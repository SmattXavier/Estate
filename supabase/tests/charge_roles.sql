-- charge_roles.sql
--
-- Proves the service-charge separation of duties after 010.
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
  v_estate uuid;
  v_fm uuid; v_ceo uuid; v_res uuid;
  v_period uuid; v_draft uuid; v_bill uuid;
  v_n int;
begin
  select id into v_estate from estates where name = 'Wuse II Estate';
  select id into v_fm  from auth.users where email = 'fm@demo.test';
  select id into v_ceo from auth.users where email = 'ceo@demo.test';
  select id into v_res from auth.users where email = 'resident@demo.test';
  select id into v_period from service_periods where estate_id = v_estate limit 1;

  if v_period is null then raise exception 'Run 008_seed_phase2.sql first'; end if;

  -- A draft period to attempt issuing against.
  insert into service_periods (estate_id, label, service_start, service_end, due_date, status)
  values (v_estate, 'TEST draft period', date '2027-01-01', date '2027-12-31',
          current_date + 30, 'draft')
  returning id into v_draft;

  -- ---------- issue_service_period: CEO only ----------

  perform set_config('request.jwt.claims', json_build_object('sub', v_fm)::text, true);
  begin
    perform public.issue_service_period(v_draft, 500000);
    insert into t_result (step, detail, verdict) values
      ('1 manager issues a charge', 'the manager was allowed to set the charge', 'FAIL');
  exception when others then
    insert into t_result (step, detail, verdict) values
      ('1 manager issues a charge', SQLERRM, 'PASS');
  end;

  perform set_config('request.jwt.claims', json_build_object('sub', v_res)::text, true);
  begin
    perform public.issue_service_period(v_draft, 500000);
    insert into t_result (step, detail, verdict) values
      ('2 resident issues a charge', 'a resident was allowed to set the charge', 'FAIL');
  exception when others then
    insert into t_result (step, detail, verdict) values
      ('2 resident issues a charge', SQLERRM, 'PASS');
  end;

  perform set_config('request.jwt.claims', json_build_object('sub', v_ceo)::text, true);
  select public.issue_service_period(v_draft, 500000) into v_n;
  insert into t_result (step, detail, verdict) values
    ('3 CEO issues a charge', v_n || ' bills created, expect 7',
     case when v_n = 7 then 'PASS' else 'FAIL' end);

  insert into t_result (step, detail, verdict) values
    ('3b period marked issued',
     (select status from service_periods where id = v_draft),
     case when (select status from service_periods where id = v_draft) = 'issued'
          then 'PASS' else 'FAIL' end);

  -- ---------- record_payment: manager and CEO ----------

  select bill_id into v_bill from service_bill_status
   where period_id = v_period and pay_status = 'unpaid' limit 1;

  perform set_config('request.jwt.claims', json_build_object('sub', v_fm)::text, true);
  begin
    perform public.record_payment(v_bill, 1000, current_date, 'Cash', 'ROLE-TEST-FM');
    insert into t_result (step, detail, verdict) values
      ('4 manager records a payment', 'allowed, as intended', 'PASS');
  exception when others then
    insert into t_result (step, detail, verdict) values
      ('4 manager records a payment', SQLERRM, 'FAIL');
  end;

  perform set_config('request.jwt.claims', json_build_object('sub', v_ceo)::text, true);
  begin
    perform public.record_payment(v_bill, 1000, current_date, 'Cash', 'ROLE-TEST-CEO');
    insert into t_result (step, detail, verdict) values
      ('5 CEO records a payment', 'allowed, so he can correct an error', 'PASS');
  exception when others then
    insert into t_result (step, detail, verdict) values
      ('5 CEO records a payment', SQLERRM, 'FAIL');
  end;

  perform set_config('request.jwt.claims', json_build_object('sub', v_res)::text, true);
  begin
    perform public.record_payment(v_bill, 1000, current_date, 'Cash', 'ROLE-TEST-RES');
    insert into t_result (step, detail, verdict) values
      ('6 resident records a payment', 'a resident recorded their own payment', 'FAIL');
  exception when others then
    insert into t_result (step, detail, verdict) values
      ('6 resident records a payment', SQLERRM, 'PASS');
  end;

  -- ---------- record_expense: manager and CEO ----------

  perform set_config('request.jwt.claims', json_build_object('sub', v_fm)::text, true);
  begin
    perform public.record_expense(v_period, 'Diesel and generator', 5000,
                                  current_date, 'Role test');
    insert into t_result (step, detail, verdict) values
      ('7 manager records an expense', 'allowed, as intended', 'PASS');
  exception when others then
    insert into t_result (step, detail, verdict) values
      ('7 manager records an expense', SQLERRM, 'FAIL');
  end;

  perform set_config('request.jwt.claims', json_build_object('sub', v_res)::text, true);
  begin
    perform public.record_expense(v_period, 'Diesel and generator', 5000,
                                  current_date, 'Role test');
    insert into t_result (step, detail, verdict) values
      ('8 resident records an expense', 'a resident recorded an expense', 'FAIL');
  exception when others then
    insert into t_result (step, detail, verdict) values
      ('8 resident records an expense', SQLERRM, 'PASS');
  end;

  perform set_config('role', 'postgres', true);
end $$;

select verdict, step, detail
from t_result
order by (verdict = 'PASS'), seq;

rollback;
