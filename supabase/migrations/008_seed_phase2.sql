-- 008_seed_phase2.sql
--
-- Run AFTER 007_service_charge.sql, and AFTER 002_seed.sql has been run at
-- least once (this file builds on the estate, units and roster it creates).
--
-- BEFORE running it, create two more users in the dashboard:
--   Authentication → Users → Add user → "Auto Confirm User" ON
--     artisan@demo.test   / demo1234
--     security@demo.test  / demo1234
--
-- Safe to re-run. It clears only the Phase 2 tables, never your issues.

do $$
declare
  v_estate   uuid;
  v_artisan  uuid;
  v_security uuid;
  v_fm       uuid;
  v_emeka    uuid;
  v_joseph   uuid;
  v_c12      uuid;
  v_period   uuid;
  v_bill     uuid;
  v_pass     uuid;
  v_n        int;
begin
  select id into v_estate from estates where name = 'Wuse II Estate';
  if v_estate is null then
    raise exception 'Run 002_seed.sql first — no estate found.';
  end if;

  select id into v_artisan  from auth.users where email = 'artisan@demo.test';
  select id into v_security from auth.users where email = 'security@demo.test';
  select id into v_fm       from auth.users where email = 'fm@demo.test';

  if v_artisan is null or v_security is null then
    raise exception
      'Create artisan@demo.test and security@demo.test in Authentication → Users first (Auto Confirm ON), then re-run.';
  end if;

  -- Phase 2 tables only. Issues and their history are untouched.
  delete from gate_events       where estate_id = v_estate;
  delete from visitor_passes    where estate_id = v_estate;
  delete from staff_shifts      where estate_id = v_estate;
  delete from service_payments  where estate_id = v_estate;
  delete from service_expenses  where estate_id = v_estate;
  delete from service_bills     where estate_id = v_estate;
  delete from service_periods   where estate_id = v_estate;

  -- ------------------------------------------------------------------
  -- Estate location. Wuse II, Abuja, with a 300m fence.
  -- ------------------------------------------------------------------
  update estates
     set lat = 9.076500, lng = 7.467100, geofence_metres = 300
   where id = v_estate;

  -- ------------------------------------------------------------------
  -- Two staff get logins. Emeka the plumber, Joseph on the gate.
  -- ------------------------------------------------------------------
  insert into profiles (id, estate_id, full_name, phone, role) values
    (v_artisan,  v_estate, 'Emeka Obi',   '0803 552 8811', 'artisan'),
    (v_security, v_estate, 'Joseph Okon', '0808 992 4471', 'security')
  on conflict (id) do update
    set role = excluded.role, full_name = excluded.full_name, phone = excluded.phone;

  select id into v_emeka  from technicians
   where estate_id = v_estate and full_name = 'Emeka Obi';
  select id into v_joseph from technicians
   where estate_id = v_estate and full_name = 'Joseph Okon';

  update technicians set profile_id = v_artisan,  staff_kind = 'artisan'
   where id = v_emeka;
  update technicians set profile_id = v_security, staff_kind = 'security'
   where id = v_joseph;

  -- Everyone whose trade is Security is gate staff, not an artisan.
  update technicians set staff_kind = 'security'
   where estate_id = v_estate and trade = 'Security';

  -- ------------------------------------------------------------------
  -- Attendance. Joseph is on shift now; Emeka worked yesterday and is
  -- currently off, so the board shows both states.
  -- ------------------------------------------------------------------

  -- On shift, clocked in at the gate this morning, inside the fence.
  insert into staff_shifts (
    estate_id, technician_id, clock_in_at,
    clock_in_lat, clock_in_lng, clock_in_accuracy, clock_in_metres, clock_in_on_site
  ) values (
    v_estate, v_joseph, now() - interval '4 hours',
    9.076610, 7.467240, 12.0, 18.4, true
  );

  -- Completed shift yesterday.
  insert into staff_shifts (
    estate_id, technician_id,
    clock_in_at,  clock_in_lat,  clock_in_lng,  clock_in_accuracy,  clock_in_metres,  clock_in_on_site,
    clock_out_at, clock_out_lat, clock_out_lng, clock_out_accuracy, clock_out_metres, clock_out_on_site
  ) values (
    v_estate, v_emeka,
    now() - interval '1 day 8 hours', 9.076480, 7.467020, 9.0,  9.6,  true,
    now() - interval '1 day 1 hour',  9.076520, 7.467180, 11.0, 10.8, true
  );

  -- A clock-in from well outside the fence, so the manager's screen has
  -- something to actually catch. Roughly 2.4km away.
  insert into staff_shifts (
    estate_id, technician_id,
    clock_in_at,  clock_in_lat, clock_in_lng, clock_in_accuracy, clock_in_metres, clock_in_on_site,
    clock_out_at, clock_out_lat, clock_out_lng, clock_out_accuracy, clock_out_metres, clock_out_on_site
  ) values (
    v_estate, v_emeka,
    now() - interval '2 days 9 hours', 9.098200, 7.467400, 15.0, 2411.0, false,
    now() - interval '2 days 2 hours', 9.076500, 7.467100, 10.0, 2.0,    true
  );

  -- ------------------------------------------------------------------
  -- Visitor passes
  -- ------------------------------------------------------------------

  select id into v_c12 from units where estate_id = v_estate and label = 'Block C, Flat 12';

  -- Active, unused. This is the one to demo at the gate.
  insert into visitor_passes (
    estate_id, unit_id, created_by, code, visitor_name, visitor_phone,
    purpose, vehicle_plate, valid_until
  )
  select v_estate, v_c12, u.resident_id, 'K7M2QF', 'Chinedu Eze', '0806 771 2200',
         'Family visit', 'ABJ 442 KV', now() + interval '9 hours'
  from units u where u.id = v_c12;

  -- Already used, with an arrival on the record.
  insert into visitor_passes (
    estate_id, unit_id, created_by, code, visitor_name, visitor_phone,
    purpose, vehicle_plate, valid_from, valid_until, status
  )
  select v_estate, v_c12, u.resident_id, 'R4T9XB', 'Bimbo Alade', '0812 330 4471',
         'Delivery', null, now() - interval '3 hours', now() + interval '3 hours', 'used'
  from units u where u.id = v_c12
  returning id into v_pass;

  insert into gate_events (
    estate_id, pass_id, direction, recorded_by, recorded_name,
    lat, lng, accuracy, metres, on_site, recorded_at
  ) values (
    v_estate, v_pass, 'in', v_security, 'Joseph Okon',
    9.076610, 7.467240, 12.0, 18.4, true, now() - interval '2 hours 40 minutes'
  );

  -- Expired, never used. Shows the derived-expiry state.
  insert into visitor_passes (
    estate_id, unit_id, created_by, code, visitor_name,
    purpose, valid_from, valid_until
  )
  select v_estate, v_c12, u.resident_id, 'H8N3PW', 'Musa Garba',
         'Furniture drop-off', now() - interval '2 days', now() - interval '30 hours'
  from units u where u.id = v_c12;

  -- ------------------------------------------------------------------
  -- Service charge. One period, billed annually, already past its due
  -- date so the arrears view has something in it on arrival.
  -- ------------------------------------------------------------------

  insert into service_periods (estate_id, label, service_start, service_end, due_date, status)
  values (v_estate, '2026 Annual Service Charge',
          date '2026-01-01', date '2026-12-31',
          current_date - 12, 'issued')
  returning id into v_period;

  -- ₦450,000 per unit for the year, seven units.
  insert into service_bills (estate_id, period_id, unit_id, amount, issued_at)
  select v_estate, v_period, u.id, 450000, now() - interval '90 days'
  from units u where u.estate_id = v_estate;

  get diagnostics v_n = row_count;

  -- Four paid in full, one part paid, two in arrears. That spread is what
  -- makes the CEO's screen worth looking at.
  insert into service_payments (estate_id, bill_id, amount, paid_on, method, reference, recorded_by)
  select v_estate, b.id, 450000, current_date - 40, 'Bank transfer',
         'TRF-' || substr(b.id::text, 1, 6), v_fm
  from service_bills b
  join units u on u.id = b.unit_id
  where b.period_id = v_period
    and u.label in ('Block A, Flat 3', 'Block A, Flat 9', 'Block B, Flat 7', 'Block B, Flat 15');

  select b.id into v_bill
  from service_bills b join units u on u.id = b.unit_id
  where b.period_id = v_period and u.label = 'Block D, Flat 21';

  insert into service_payments (estate_id, bill_id, amount, paid_on, method, reference, recorded_by)
  values (v_estate, v_bill, 200000, current_date - 25, 'Bank transfer', 'TRF-PART-01', v_fm);

  -- Block C, Flat 12 (Ngozi) and Block C, Flat 4 are left unpaid and overdue.

  -- ------------------------------------------------------------------
  -- Where the money went. Diesel dominates, as it does in reality.
  -- ------------------------------------------------------------------
  insert into service_expenses (estate_id, period_id, category, amount, spent_on, description, recorded_by) values
    (v_estate, v_period, 'Diesel and generator',    980000, current_date - 70, 'Q1 diesel supply and generator service', v_fm),
    (v_estate, v_period, 'Diesel and generator',    845000, current_date - 35, 'Q2 diesel supply',                      v_fm),
    (v_estate, v_period, 'Security',                720000, current_date - 60, 'Gate staff wages, first half',          v_fm),
    (v_estate, v_period, 'Waste disposal',          180000, current_date - 55, 'Monthly refuse contractor',             v_fm),
    (v_estate, v_period, 'Water',                   145000, current_date - 48, 'Borehole pump repair and treatment',    v_fm),
    (v_estate, v_period, 'Cleaning',                160000, current_date - 42, 'Common area cleaning',                  v_fm),
    (v_estate, v_period, 'Grounds and gardening',    95000, current_date - 38, 'Grass cutting and hedge trimming',      v_fm),
    (v_estate, v_period, 'Common area repairs',     210000, current_date - 30, 'Corridor lighting and gate motor',      v_fm),
    (v_estate, v_period, 'CCTV and access control', 130000, current_date - 26, 'Camera replacement at the main gate',   v_fm),
    (v_estate, v_period, 'Insurance',               240000, current_date - 80, 'Block insurance premium',               v_fm),
    (v_estate, v_period, 'Management fee',          315000, current_date - 20, 'Facility management fee',               v_fm);

  raise notice 'Phase 2 seeded: geofence 300m, 2 staff logins, 3 shifts (1 open, 1 off-site), 3 passes (1 active code K7M2QF), % bills at N450,000, 2 units in arrears, 11 expense lines.', v_n;
end $$;
