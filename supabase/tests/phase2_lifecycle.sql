-- phase2_lifecycle.sql  (v2 — returns a table, not notices)
--
-- The Supabase SQL editor does not display RAISE NOTICE output, so this
-- version writes every check into a temp table and selects it at the end.
-- You get a grid: verdict, step, detail. FAILs sort to the top.
--
-- Paste the WHOLE file into the SQL editor of the ESTATE project and run.
-- It ends in ROLLBACK, so your seeded demo data is untouched.

begin;

create temp table t_result (
  seq     serial primary key,
  step    text,
  detail  text,
  verdict text
) on commit drop;

-- Section E switches the current role to `authenticated` to prove the RLS
-- scoping. That role must still be able to write its findings here, so the
-- temp table and its sequence are granted for the life of the transaction.
grant all on t_result to authenticated;
grant usage on all sequences in schema pg_temp to authenticated;

do $$
declare
  v_estate uuid;
  v_res uuid; v_fm uuid; v_ceo uuid; v_art uuid; v_sec uuid;
  v_c12 uuid; v_period uuid; v_bill uuid;
  v_shift staff_shifts;
  v_pass  visitor_passes;
  v_event gate_events;
  v_code text; v_txt text;
  v_n int; v_m numeric;
begin
  select id into v_estate from estates where name = 'Wuse II Estate';
  select id into v_res from auth.users where email = 'resident@demo.test';
  select id into v_fm  from auth.users where email = 'fm@demo.test';
  select id into v_ceo from auth.users where email = 'ceo@demo.test';
  select id into v_art from auth.users where email = 'artisan@demo.test';
  select id into v_sec from auth.users where email = 'security@demo.test';
  select id into v_c12 from units where estate_id = v_estate and label = 'Block C, Flat 12';
  select id into v_period from service_periods where estate_id = v_estate limit 1;

  if v_art is null or v_sec is null or v_period is null then
    raise exception 'Run 008_seed_phase2.sql first';
  end if;

  -- ===================== A. Distance maths =====================

  select public.metres_between(9.076500, 7.467100, 9.076500, 7.467100) into v_m;
  insert into t_result (step, detail, verdict) values
    ('A1 same point', v_m || ' m (expect 0)',
     case when v_m = 0 then 'PASS' else 'FAIL' end);

  select public.metres_between(9.000000, 7.467100, 10.000000, 7.467100) into v_m;
  insert into t_result (step, detail, verdict) values
    ('A2 one degree latitude', v_m || ' m (expect ~111,195)',
     case when v_m between 110000 and 112500 then 'PASS' else 'FAIL' end);

  -- ===================== B. Attendance =====================

  perform set_config('request.jwt.claims', json_build_object('sub', v_art)::text, true);

  select * into v_shift from public.clock_in(9.076530, 7.467150, 8.0);
  insert into t_result (step, detail, verdict) values
    ('B1 clock in on site',
     v_shift.clock_in_metres || ' m, on_site=' || coalesce(v_shift.clock_in_on_site::text, 'null'),
     case when v_shift.clock_in_on_site then 'PASS' else 'FAIL' end);

  begin
    perform public.clock_in(9.076530, 7.467150, 8.0);
    insert into t_result (step, detail, verdict) values
      ('B2 double clock in', 'allowed a second open shift', 'FAIL');
  exception when others then
    insert into t_result (step, detail, verdict) values ('B2 double clock in', SQLERRM, 'PASS');
  end;

  select * into v_shift from public.clock_out(9.098200, 7.467400, 15.0);
  insert into t_result (step, detail, verdict) values
    ('B3 clock out off site',
     v_shift.clock_out_metres || ' m, on_site=' || coalesce(v_shift.clock_out_on_site::text, 'null'),
     case when v_shift.clock_out_on_site is false then 'PASS' else 'FAIL' end);

  begin
    perform public.clock_out(9.076500, 7.467100, 10.0);
    insert into t_result (step, detail, verdict) values
      ('B4 clock out twice', 'allowed with no open shift', 'FAIL');
  exception when others then
    insert into t_result (step, detail, verdict) values ('B4 clock out twice', SQLERRM, 'PASS');
  end;

  perform set_config('request.jwt.claims', json_build_object('sub', v_res)::text, true);
  begin
    perform public.clock_in(9.076500, 7.467100, 10.0);
    insert into t_result (step, detail, verdict) values
      ('B5 resident clock in', 'a resident clocked in', 'FAIL');
  exception when others then
    insert into t_result (step, detail, verdict) values ('B5 resident clock in', SQLERRM, 'PASS');
  end;

  perform set_config('request.jwt.claims', json_build_object('sub', v_art)::text, true);
  select * into v_shift from public.clock_in(null, null, null);
  insert into t_result (step, detail, verdict) values
    ('B6 GPS off',
     'on_site=' || coalesce(v_shift.clock_in_on_site::text, 'null') || ' (must be null, not false)',
     case when v_shift.clock_in_on_site is null then 'PASS' else 'FAIL' end);
  perform public.clock_out(null, null, null);

  -- ===================== C. Visitor passes =====================

  perform set_config('request.jwt.claims', json_build_object('sub', v_res)::text, true);

  select * into v_pass from public.create_visitor_pass(
    v_c12, 'Test Visitor', '0800 000 0000', 'Testing', 'abj 123 xy', 6);
  v_code := v_pass.code;

  insert into t_result (step, detail, verdict) values
    ('C1 code format', 'code ' || v_code,
     case when length(v_code) = 6 and v_code !~ '[01OIL]' then 'PASS' else 'FAIL' end);

  insert into t_result (step, detail, verdict) values
    ('C1b plate normalised', coalesce(v_pass.vehicle_plate, 'null'),
     case when v_pass.vehicle_plate = 'ABJ 123 XY' then 'PASS' else 'FAIL' end);

  begin
    perform public.create_visitor_pass(v_c12, 'Someone', null, null, null, 900);
    insert into t_result (step, detail, verdict) values
      ('C3 absurd validity', 'allowed a 900 hour pass', 'FAIL');
  exception when others then
    insert into t_result (step, detail, verdict) values ('C3 absurd validity', SQLERRM, 'PASS');
  end;

  begin
    perform public.verify_pass(v_code);
    insert into t_result (step, detail, verdict) values
      ('C4 resident verifies', 'a resident verified a pass', 'FAIL');
  exception when others then
    insert into t_result (step, detail, verdict) values ('C4 resident verifies', SQLERRM, 'PASS');
  end;

  perform set_config('request.jwt.claims', json_build_object('sub', v_sec)::text, true);

  select verdict into v_txt from public.verify_pass(v_code);
  insert into t_result (step, detail, verdict) values
    ('C5 gate verifies', 'verdict: ' || v_txt,
     case when v_txt = 'valid' then 'PASS' else 'FAIL' end);

  select verdict into v_txt from public.verify_pass(v_code);
  insert into t_result (step, detail, verdict) values
    ('C5b verify is read only', 'second verify: ' || v_txt,
     case when v_txt = 'valid' then 'PASS' else 'FAIL' end);

  select verdict into v_txt from public.verify_pass('  ' || lower(v_code) || ' ');
  insert into t_result (step, detail, verdict) values
    ('C5c lowercase and padding', 'verdict: ' || v_txt,
     case when v_txt = 'valid' then 'PASS' else 'FAIL' end);

  select * into v_event from public.record_gate_event(v_code, 'in', 9.076610, 7.467240, 12.0, null);
  select status into v_txt from visitor_passes where code = v_code;
  insert into t_result (step, detail, verdict) values
    ('C6 admit',
     v_event.metres || ' m by ' || v_event.recorded_name || ', pass now ' || v_txt,
     case when v_txt = 'used' and v_event.on_site then 'PASS' else 'FAIL' end);

  begin
    perform public.record_gate_event(v_code, 'in', 9.076610, 7.467240, 12.0, null);
    insert into t_result (step, detail, verdict) values
      ('C7 re-entry', 'admitted the same pass twice', 'FAIL');
  exception when others then
    insert into t_result (step, detail, verdict) values ('C7 re-entry', SQLERRM, 'PASS');
  end;

  select * into v_event from public.record_gate_event(v_code, 'out', 9.076610, 7.467240, 12.0, null);
  insert into t_result (step, detail, verdict) values
    ('C8 exit', 'logged at ' || to_char(v_event.recorded_at, 'HH24:MI'), 'PASS');

  begin
    perform public.record_gate_event('H8N3PW', 'in', 9.076610, 7.467240, 12.0, null);
    insert into t_result (step, detail, verdict) values
      ('C9 expired pass', 'admitted an expired pass', 'FAIL');
  exception when others then
    insert into t_result (step, detail, verdict) values ('C9 expired pass', SQLERRM, 'PASS');
  end;

  perform set_config('request.jwt.claims', json_build_object('sub', v_res)::text, true);
  select * into v_pass from public.create_visitor_pass(v_c12, 'Revoke Me', null, null, null, 6);
  perform public.revoke_visitor_pass(v_pass.id);

  perform set_config('request.jwt.claims', json_build_object('sub', v_sec)::text, true);
  begin
    perform public.record_gate_event(v_pass.code, 'in', 9.076610, 7.467240, 12.0, null);
    insert into t_result (step, detail, verdict) values
      ('C10 revoked pass', 'admitted a revoked pass', 'FAIL');
  exception when others then
    insert into t_result (step, detail, verdict) values ('C10 revoked pass', SQLERRM, 'PASS');
  end;

  -- ===================== D. Service charge =====================

  perform set_config('request.jwt.claims', json_build_object('sub', v_ceo)::text, true);

  select count(*) into v_n from service_bill_status where period_id = v_period and pay_status = 'paid';
  insert into t_result (step, detail, verdict) values
    ('D1 paid in full', v_n || ' (expect 4)', case when v_n = 4 then 'PASS' else 'FAIL' end);

  select count(*) into v_n from service_bill_status where period_id = v_period and pay_status = 'part paid';
  insert into t_result (step, detail, verdict) values
    ('D1b part paid', v_n || ' (expect 1)', case when v_n = 1 then 'PASS' else 'FAIL' end);

  select count(*) into v_n from service_bill_status where period_id = v_period and pay_status = 'unpaid';
  insert into t_result (step, detail, verdict) values
    ('D1c unpaid', v_n || ' (expect 2)', case when v_n = 2 then 'PASS' else 'FAIL' end);

  -- Overdue is orthogonal to payment progress: the two unpaid bills plus the
  -- part paid one are all past the due date.
  select count(*) into v_n from service_bill_status where period_id = v_period and is_overdue;
  insert into t_result (step, detail, verdict) values
    ('D1d overdue', v_n || ' (expect 3)', case when v_n = 3 then 'PASS' else 'FAIL' end);

  select count(*) into v_n from service_bill_status
   where period_id = v_period and pay_status = 'part paid' and is_overdue;
  insert into t_result (step, detail, verdict) values
    ('D1e part paid AND overdue', v_n || ' (expect 1, the case that was hidden before)',
     case when v_n = 1 then 'PASS' else 'FAIL' end);

  select sum(outstanding) into v_m from service_bill_status where period_id = v_period;
  insert into t_result (step, detail, verdict) values
    ('D2 total outstanding', 'N' || to_char(v_m, 'FM999,999,999'), 'PASS');

  perform set_config('request.jwt.claims', json_build_object('sub', v_fm)::text, true);
  select bill_id into v_bill from service_bill_status
   where period_id = v_period and pay_status = 'unpaid' limit 1;

  begin
    perform public.record_payment(v_bill, 999999999, current_date, 'Cash', 'TEST');
    insert into t_result (step, detail, verdict) values
      ('D3 overpayment', 'allowed an overpayment', 'FAIL');
  exception when others then
    insert into t_result (step, detail, verdict) values ('D3 overpayment', SQLERRM, 'PASS');
  end;

  perform public.record_payment(v_bill, 450000, current_date, 'Bank transfer', 'TEST-CLEAR');
  select pay_status into v_txt from service_bill_status where bill_id = v_bill;
  insert into t_result (step, detail, verdict) values
    ('D4 pay in full', 'status now ' || v_txt, case when v_txt = 'paid' then 'PASS' else 'FAIL' end);

  perform set_config('request.jwt.claims', json_build_object('sub', v_res)::text, true);
  begin
    perform public.record_payment(v_bill, 1000, current_date, 'Cash', 'SELF');
    insert into t_result (step, detail, verdict) values
      ('D5 resident self-pays', 'a resident recorded their own payment', 'FAIL');
  exception when others then
    insert into t_result (step, detail, verdict) values ('D5 resident self-pays', SQLERRM, 'PASS');
  end;

  perform set_config('request.jwt.claims', json_build_object('sub', v_fm)::text, true);
  begin
    perform public.record_expense(v_period, 'Chairman lunch', 50000, current_date, null);
    insert into t_result (step, detail, verdict) values
      ('D6 unknown category', 'accepted an unknown category', 'FAIL');
  exception when others then
    insert into t_result (step, detail, verdict) values ('D6 unknown category', SQLERRM, 'PASS');
  end;

  select round(sum(share_percent)) into v_m from service_spend_breakdown where period_id = v_period;
  select category into v_txt from service_spend_breakdown where period_id = v_period order by spent desc limit 1;
  insert into t_result (step, detail, verdict) values
    ('D7 spend shares', v_m || '%, largest: ' || v_txt,
     case when v_m between 99 and 101 then 'PASS' else 'FAIL' end);

  -- ===================== E. Scoping (Rule 13 backstop) =====================

  perform set_config('role', 'authenticated', true);

  perform set_config('request.jwt.claims', json_build_object('sub', v_res)::text, true);
  select count(*) into v_n from staff_attendance;
  insert into t_result (step, detail, verdict) values
    ('E1 resident sees attendance', v_n || ' rows (must be 0)',
     case when v_n = 0 then 'PASS' else 'FAIL' end);

  perform set_config('request.jwt.claims', json_build_object('sub', v_art)::text, true);
  select count(*) into v_n from technicians;
  insert into t_result (step, detail, verdict) values
    ('E2 artisan sees roster', v_n || ' rows (must be 1, their own)',
     case when v_n = 1 then 'PASS' else 'FAIL' end);

  select count(*) into v_n from service_bill_status;
  insert into t_result (step, detail, verdict) values
    ('E2b artisan sees bills', v_n || ' rows (must be 0)',
     case when v_n = 0 then 'PASS' else 'FAIL' end);

  perform set_config('request.jwt.claims', json_build_object('sub', v_sec)::text, true);
  select count(*) into v_n from visitor_passes;
  insert into t_result (step, detail, verdict) values
    ('E3 security sees passes', v_n || ' rows (must be > 0)',
     case when v_n > 0 then 'PASS' else 'FAIL' end);

  select count(*) into v_n from service_bill_status;
  insert into t_result (step, detail, verdict) values
    ('E3b security sees bills', v_n || ' rows (must be 0)',
     case when v_n = 0 then 'PASS' else 'FAIL' end);

  perform set_config('request.jwt.claims', json_build_object('sub', v_fm)::text, true);
  select count(*) into v_n from staff_attendance;
  insert into t_result (step, detail, verdict) values
    ('E4 manager sees attendance', v_n || ' rows (must be > 0)',
     case when v_n > 0 then 'PASS' else 'FAIL' end);

  perform set_config('role', 'postgres', true);
end $$;

select verdict, step, detail
from t_result
order by (verdict = 'PASS'), seq;

rollback;
