-- 004_roles.sql
--
-- RUN THIS FILE COMPLETELY ALONE, BEFORE 005.
--
-- Postgres will not let you add a value to an enum and then use that value
-- inside the same transaction. The Supabase SQL editor runs each execution
-- as one transaction, so if you paste this together with 005 you will get:
--
--   ERROR: unsafe use of new value "artisan" of enum type user_role
--
-- Paste ONLY these two lines, run, wait for success, then move on.
-- Safe to re-run: the values are added only if missing.

alter type user_role add value if not exists 'artisan';
alter type user_role add value if not exists 'security';

-- Check: this should return 5 rows —
--   resident, facility_manager, ceo, artisan, security
--
--   select unnest(enum_range(null::user_role));
