-- 009_fix_bill_status.sql
--
-- Run in the estate project. Replaces the view from 007; no data changes.
--
-- The first version folded two independent facts into one column, so a bill
-- that was part paid AND past its due date reported only as overdue and the
-- payment vanished. How much has been paid and whether the date has passed
-- are orthogonal — the same separation already used for issue status versus
-- escalated_at.
--
--   pay_status : 'paid' | 'part paid' | 'unpaid'   (how much came in)
--   is_overdue : boolean                            (has the date passed)
--
-- A bill can be part paid and overdue at once, and both screens can say so.
--
-- The view is dropped rather than replaced: create-or-replace cannot add or
-- reorder columns, only redefine existing ones. Nothing reads this view yet.

drop view if exists service_bill_status;

create view service_bill_status
with (security_invoker = on) as
select
  b.id                                              as bill_id,
  b.estate_id,
  b.period_id,
  b.unit_id,
  u.label                                           as unit_label,
  u.resident_id,
  pr.full_name                                      as resident_name,
  pr.phone                                          as resident_phone,
  sp.label                                          as period_label,
  sp.service_start,
  sp.service_end,
  sp.due_date,
  sp.status                                         as period_status,
  b.amount,
  coalesce(paid.total, 0)                           as paid,
  b.amount - coalesce(paid.total, 0)                as outstanding,

  case
    when b.amount - coalesce(paid.total, 0) <= 0 then 'paid'
    when coalesce(paid.total, 0) > 0             then 'part paid'
    else 'unpaid'
  end                                               as pay_status,

  (b.amount - coalesce(paid.total, 0) > 0
   and current_date > sp.due_date)                  as is_overdue,

  -- Progress, for a bar on the resident's screen.
  case when b.amount > 0
       then round(100 * coalesce(paid.total, 0) / b.amount, 1)
       else 100 end                                 as percent_paid,

  sp.due_date - current_date                        as days_to_due,
  case when current_date > sp.due_date
       then current_date - sp.due_date else 0 end   as days_overdue
from service_bills b
join service_periods sp on sp.id = b.period_id
join units u            on u.id  = b.unit_id
left join profiles pr   on pr.id = u.resident_id
left join lateral (
  select sum(p.amount) as total
  from service_payments p
  where p.bill_id = b.id
) paid on true;

grant select on service_bill_status to authenticated;

-- Check: 4 paid, 1 part paid, 2 unpaid, 3 overdue, N1,150,000 outstanding.
--
--   select pay_status, is_overdue, count(*), sum(outstanding)
--   from service_bill_status group by 1, 2 order by 1, 2;
