-- 011_security_reads_units.sql
--
-- Run in the ESTATE project (URL must contain kgpoqkjcjznetnubrvrl).
-- One policy. No tables, columns or functions touched.
--
-- Why
--
-- The gate screen's history at /gate/today shows which flat each visitor
-- went to. It could not: is_staff() covers facility_manager and ceo only,
-- so units_staff does not reach the security role, and the embed returned
-- null.
--
-- This withholds nothing in practice. verify_pass is SECURITY DEFINER and
-- already hands the gateman unit_label at the moment of entry — which is
-- exactly when it matters most. Denying it afterwards only made the log
-- less useful to the person who wrote it.
--
-- Scoped to the officer's own estate, same as every other staff policy.
-- Read only: there are no write policies on units and this adds none.

create policy units_security on units for select
  using (public.my_role() = 'security' and estate_id = public.my_estate());

-- Check, as security@demo.test:
--
--   select count(*) from units;        -- 7, was 0
--   select count(*) from profiles;     -- still 1, their own row only
--   select count(*) from issues;       -- still 0
--   select count(*) from service_bill_status;  -- still 0
--
-- The last three matter as much as the first: this opens unit labels and
-- nothing else. Run supabase/tests/security_scope.sql to assert it.
