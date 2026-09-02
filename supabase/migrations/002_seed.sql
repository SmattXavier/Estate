-- 002_seed.sql
-- Run this AFTER 001_schema.sql and 003_functions.sql.
--
-- BEFORE running it, create three users in the Supabase dashboard:
--   Authentication → Users → Add user → "Auto Confirm User" ON
--     resident@demo.test  / demo1234
--     fm@demo.test        / demo1234
--     ceo@demo.test       / demo1234
--
-- This file looks them up by email and stops with a clear message if any
-- are missing. It is safe to re-run: it clears demo data first.

do $$
declare
  v_estate uuid;
  v_res uuid; v_fm uuid; v_ceo uuid;
  v_unit_c12 uuid; v_unit_b15 uuid; v_unit_a3 uuid;
  v_unit_b7 uuid;  v_unit_d21 uuid; v_unit_a9 uuid; v_unit_c4 uuid;
  t_plumb uuid; t_plumb2 uuid; t_elec uuid; t_water uuid; t_gen uuid;
  t_ac uuid; t_clean uuid; t_carp uuid; t_elec2 uuid; t_sec uuid;
  v_id uuid;
begin
  select id into v_res from auth.users where email = 'resident@demo.test';
  select id into v_fm  from auth.users where email = 'fm@demo.test';
  select id into v_ceo from auth.users where email = 'ceo@demo.test';

  if v_res is null or v_fm is null or v_ceo is null then
    raise exception
      'Create resident@demo.test, fm@demo.test and ceo@demo.test in Authentication → Users first (Auto Confirm ON), then re-run this file.';
  end if;

  -- Clean slate, so this file can be re-run before the demo.
  delete from issue_updates;
  delete from issues;
  delete from technicians;
  delete from units;
  delete from profiles;
  delete from estates;

  insert into estates (name, address)
  values ('Wuse II Estate', 'Wuse II, Abuja, FCT')
  returning id into v_estate;

  insert into profiles (id, estate_id, full_name, phone, role) values
    (v_res, v_estate, 'Ngozi Okafor',       '0803 411 9022', 'resident'),
    (v_fm,  v_estate, 'Chidi Nwosu',        '0802 556 1187', 'facility_manager'),
    (v_ceo, v_estate, 'Mrs. Adaeze Onwuka', '0805 900 4412', 'ceo');

  -- Ngozi holds two units so she has more than one report to show.
  insert into units (estate_id, label, resident_id) values
    (v_estate, 'Block C, Flat 12', v_res) returning id into v_unit_c12;
  insert into units (estate_id, label, resident_id) values
    (v_estate, 'Block B, Flat 15', v_res) returning id into v_unit_b15;

  -- Other units carry historical issues. No resident login behind them,
  -- so they are reported_by Ngozi for the demo's sake but labelled by unit.
  insert into units (estate_id, label, resident_id) values
    (v_estate, 'Block A, Flat 3',  v_res) returning id into v_unit_a3;
  insert into units (estate_id, label, resident_id) values
    (v_estate, 'Block B, Flat 7',  v_res) returning id into v_unit_b7;
  insert into units (estate_id, label, resident_id) values
    (v_estate, 'Block D, Flat 21', v_res) returning id into v_unit_d21;
  insert into units (estate_id, label, resident_id) values
    (v_estate, 'Block A, Flat 9',  v_res) returning id into v_unit_a9;
  insert into units (estate_id, label, resident_id) values
    (v_estate, 'Block C, Flat 4',  v_res) returning id into v_unit_c4;

  insert into technicians (estate_id, full_name, trade, phone, engagement, on_books_since) values
    (v_estate, 'Emeka Obi',       'Plumbing',         '0803 552 8811', 'In-house', '2023') returning id into t_plumb;
  insert into technicians (estate_id, full_name, trade, phone, engagement, on_books_since) values
    (v_estate, 'Sadiq Bello',     'Plumbing',         '0807 219 0043', 'Vendor',   '2025') returning id into t_plumb2;
  insert into technicians (estate_id, full_name, trade, phone, engagement, on_books_since) values
    (v_estate, 'Kelechi Anyanwu', 'Electrical',       '0812 664 7719', 'In-house', '2022') returning id into t_elec;
  insert into technicians (estate_id, full_name, trade, phone, engagement, on_books_since) values
    (v_estate, 'Musa Danladi',    'Water supply',     '0806 903 2215', 'In-house', '2024') returning id into t_water;
  insert into technicians (estate_id, full_name, trade, phone, engagement, on_books_since) values
    (v_estate, 'Ahmed Yusuf',     'Generator',        '0809 445 6672', 'Vendor',   '2023') returning id into t_gen;
  insert into technicians (estate_id, full_name, trade, phone, engagement, on_books_since) values
    (v_estate, 'Sunday Etim',     'Air conditioning', '0805 771 3308', 'Vendor',   '2025') returning id into t_ac;
  insert into technicians (estate_id, full_name, trade, phone, engagement, on_books_since) values
    (v_estate, 'Blessing Uche',   'Cleaning',         '0813 226 9940', 'In-house', '2021') returning id into t_clean;
  insert into technicians (estate_id, full_name, trade, phone, engagement, on_books_since) values
    (v_estate, 'Peter Adamu',     'Carpentry',        '0802 118 5563', 'In-house', '2024') returning id into t_carp;
  insert into technicians (estate_id, full_name, trade, phone, engagement, on_books_since) values
    (v_estate, 'Halima Sani',     'Electrical',       '0810 337 2284', 'Vendor',   '2026') returning id into t_elec2;
  insert into technicians (estate_id, full_name, trade, phone, engagement, on_books_since) values
    (v_estate, 'Joseph Okon',     'Security',         '0808 992 4471', 'In-house', '2022') returning id into t_sec;

  -- ------------------------------------------------------------------
  -- Issues. Times are relative to now(), so the board always looks right
  -- however long before the demo you run this.
  -- ------------------------------------------------------------------

  -- 1. Overdue by ~14 min. High, 1h target, logged 74 min ago.
  insert into issues (estate_id, ref, unit_id, reported_by, category, priority, title,
                      description, access_permission, status, created_at, clock_started_at,
                      sla_due_at, escalated_at)
  values (v_estate, 'MR-1041', v_unit_c12, v_res, 'Plumbing', 'high',
    'Toilet cistern overflowing into the corridor',
    'Water has been running since about 6am and it has now reached the corridor. I turned off the stopcock but it is still leaking slowly. The tiles outside my door are already lifting.',
    true, 'submitted', now() - interval '74 min', now() - interval '74 min',
    now() - interval '14 min', now() - interval '14 min')
  returning id into v_id;
  insert into issue_updates (issue_id, author_id, author_name, kind, body, created_at) values
    (v_id, v_res, 'Ngozi Okafor', 'log', 'Reported the fault', now() - interval '74 min'),
    (v_id, null, 'System', 'escalation',
     'No artisan assigned within the high target. Raised to the CEO.', now() - interval '14 min');

  -- 2. Emergency, 15m target, logged 22 min ago — overdue by 7.
  insert into issues (estate_id, ref, unit_id, reported_by, category, priority, title,
                      description, access_permission, status, created_at, clock_started_at,
                      sla_due_at, escalated_at)
  values (v_estate, 'MR-1040', v_unit_a3, v_res, 'Electrical', 'emergency',
    'Sparking socket in the kitchen, burning smell',
    'The socket behind the fridge sparked twice and there is a smell of burning plastic. I have switched off that breaker. Two small children in the flat.',
    true, 'submitted', now() - interval '22 min', now() - interval '22 min',
    now() - interval '7 min', now() - interval '7 min')
  returning id into v_id;
  insert into issue_updates (issue_id, author_id, author_name, kind, body, created_at) values
    (v_id, v_res, 'Ngozi Okafor', 'log', 'Reported the fault', now() - interval '22 min'),
    (v_id, null, 'System', 'escalation',
     'No artisan assigned within the emergency target. Raised to the CEO.', now() - interval '7 min');

  -- 3. High, 8 minutes left. This is the one that turns red during the demo.
  insert into issues (estate_id, ref, unit_id, reported_by, category, priority, title,
                      description, access_permission, status, created_at, clock_started_at, sla_due_at)
  values (v_estate, 'MR-1039', v_unit_b7, v_res, 'Generator', 'high',
    'Estate generator cutting out every few minutes',
    'Since last night the generator has been starting and stopping. It goes off for about ten minutes then comes back. Everyone on our line is affected.',
    false, 'submitted', now() - interval '52 min', now() - interval '52 min',
    now() + interval '8 min')
  returning id into v_id;
  insert into issue_updates (issue_id, author_id, author_name, kind, body, created_at) values
    (v_id, v_res, 'Ngozi Okafor', 'log', 'Reported the fault', now() - interval '52 min');

  -- 4. Dispatched, artisan out.
  insert into issues (estate_id, ref, unit_id, reported_by, category, priority, title,
                      description, access_permission, status, created_at, clock_started_at,
                      sla_due_at, assigned_at, assigned_technician_id)
  values (v_estate, 'MR-1038', v_unit_d21, v_res, 'Water supply', 'normal',
    'No water on the third floor since Sunday',
    'Taps are dry from the third floor upward. Ground floor still has water so it looks like a pump or pressure problem.',
    true, 'assigned', now() - interval '95 min', now() - interval '95 min',
    now() + interval '145 min', now() - interval '41 min', t_water)
  returning id into v_id;
  insert into issue_updates (issue_id, author_id, author_name, kind, body, created_at) values
    (v_id, v_res, 'Ngozi Okafor', 'log', 'Reported the fault', now() - interval '95 min'),
    (v_id, v_fm, 'Chidi Nwosu', 'dispatch',
     'Dispatched Musa Danladi (Water supply). He is checking the booster pump this afternoon, should be back on by 4pm.',
     now() - interval '41 min');

  -- 5. Fixed, waiting on the resident to confirm.
  insert into issues (estate_id, ref, unit_id, reported_by, category, priority, title,
                      description, access_permission, status, created_at, clock_started_at,
                      sla_due_at, assigned_at, assigned_technician_id, resolved_at,
                      work_done, work_materials, work_cost)
  values (v_estate, 'MR-1037', v_unit_b15, v_res, 'Plumbing', 'high',
    'Kitchen sink draining very slowly',
    'Takes about five minutes to clear after washing plates. Started last week and it is getting worse.',
    true, 'resolved', now() - interval '310 min', now() - interval '310 min',
    now() - interval '250 min', now() - interval '268 min', t_plumb, now() - interval '58 min',
    'Cleared blockage in the P-trap and replaced the corroded trap assembly.',
    '1x 40mm PVC P-trap, PTFE tape', 14500)
  returning id into v_id;
  insert into issue_updates (issue_id, author_id, author_name, kind, body, created_at) values
    (v_id, v_res, 'Ngozi Okafor', 'log', 'Reported the fault', now() - interval '310 min'),
    (v_id, v_fm, 'Chidi Nwosu', 'dispatch',
     'Dispatched Emeka Obi (Plumbing). He will come between 2 and 4pm today.', now() - interval '268 min'),
    (v_id, v_fm, 'Chidi Nwosu', 'resolution',
     'Marked resolved: Cleared blockage in the P-trap and replaced the corroded trap assembly.',
     now() - interval '58 min');

  -- 6. Closed, complete history. This is the row that makes the CSV look real.
  insert into issues (estate_id, ref, unit_id, reported_by, category, priority, title,
                      description, access_permission, status, created_at, clock_started_at,
                      sla_due_at, assigned_at, assigned_technician_id, resolved_at, closed_at,
                      work_done, work_materials, work_cost)
  values (v_estate, 'MR-1036', v_unit_c4, v_res, 'Cleaning', 'low',
    'Refuse not collected from the back bay',
    'The bins at the rear of Block C have not been emptied since Thursday.',
    false, 'closed', now() - interval '2100 min', now() - interval '2100 min',
    now() - interval '660 min', now() - interval '1980 min', t_clean,
    now() - interval '1700 min', now() - interval '1600 min',
    'Rescheduled the collection contractor and cleared the bay.', 'None', 0)
  returning id into v_id;
  insert into issue_updates (issue_id, author_id, author_name, kind, body, created_at) values
    (v_id, v_res, 'Ngozi Okafor', 'log', 'Reported the fault', now() - interval '2100 min'),
    (v_id, v_fm, 'Chidi Nwosu', 'dispatch', 'Dispatched Blessing Uche (Cleaning).', now() - interval '1980 min'),
    (v_id, v_fm, 'Chidi Nwosu', 'resolution',
     'Marked resolved: Rescheduled the collection contractor and cleared the bay.', now() - interval '1700 min'),
    (v_id, v_res, 'Ngozi Okafor', 'confirmation', 'Confirmed the work was done', now() - interval '1600 min');

  -- 7. Comfortably inside target — proves green is reachable.
  insert into issues (estate_id, ref, unit_id, reported_by, category, priority, title,
                      description, access_permission, status, created_at, clock_started_at, sla_due_at)
  values (v_estate, 'MR-1035', v_unit_b15, v_res, 'Air conditioning', 'normal',
    'Bedroom AC blowing warm air',
    'It runs but never gets cold. Probably needs gas.',
    true, 'submitted', now() - interval '11 min', now() - interval '11 min',
    now() + interval '229 min')
  returning id into v_id;
  insert into issue_updates (issue_id, author_id, author_name, kind, body, created_at) values
    (v_id, v_res, 'Ngozi Okafor', 'log', 'Reported the fault', now() - interval '11 min');

  -- The refs above are hardcoded, so the sequence has to be pushed past the
  -- highest of them. Derive it rather than hardcoding a number here too:
  -- the next log_issue() then mints MR-1042 and cannot collide.
  perform setval('issue_ref_seq', (select max(substring(ref from 4)::bigint) from issues), true);

  raise notice 'Seeded: 1 estate, 3 people, 7 units, 10 artisans, 7 issues (2 already overdue). Next ref MR-%.',
    (select max(substring(ref from 4)::bigint) from issues) + 1;
end $$;
