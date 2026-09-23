-- 010_charge_roles.sql
--
-- Run in the ESTATE project (URL must contain kgpoqkjcjznetnubrvrl).
-- Function bodies only — no tables, columns or RLS touched.
--
-- Separation of duties on the service charge:
--
--   Issue a period, set the amount per unit   CEO only
--   Record a payment received                 facility manager or CEO
--   Record an expense                         facility manager or CEO
--
-- The person who decides how much to collect should not also be the person
-- spending it and banking it. That is the accountability gap residents on
-- Nigerian estates actually complain about, and it is the same split the
-- maintenance side already uses: the manager operates, the CEO oversees
-- and can intervene.
--
-- The CEO keeps payment and expense entry so he can correct a mistake
-- without waiting for the manager. Day to day it is the manager's job.

create or replace function public.issue_service_period(
  p_period_id       uuid,
  p_amount_per_unit numeric
) returns int
language plpgsql security definer set search_path = public as $$
declare
  v_period service_periods;
  v_count  int;
begin
  -- CEO only. Changed from (facility_manager, ceo) in 007.
  if public.my_role() is distinct from 'ceo' then
    raise exception 'Only the chief executive can issue a service charge';
  end if;
  if p_amount_per_unit is null or p_amount_per_unit <= 0 then
    raise exception 'A service charge needs an amount';
  end if;

  select * into v_period from service_periods where id = p_period_id for update;
  if not found then raise exception 'No such period'; end if;
  if v_period.estate_id is distinct from public.my_estate() then
    raise exception 'That period is not on your estate';
  end if;
  if v_period.status <> 'draft' then
    raise exception 'That period is already %', v_period.status;
  end if;

  insert into service_bills (estate_id, period_id, unit_id, amount, issued_at)
  select v_period.estate_id, v_period.id, u.id, p_amount_per_unit, now()
  from units u
  where u.estate_id = v_period.estate_id
  on conflict (period_id, unit_id) do nothing;

  get diagnostics v_count = row_count;

  update service_periods set status = 'issued' where id = p_period_id;

  return v_count;
end $$;

grant execute on function public.issue_service_period(uuid, numeric) to authenticated;

-- Check: the manager must be refused, the CEO allowed.
-- Run supabase/tests/charge_roles.sql.
