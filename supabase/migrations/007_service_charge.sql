-- 007_service_charge.sql
--
-- Run AFTER 006_access_control.sql.
--
-- A period runs from a service start to a service end and falls due on a
-- date. Each unit gets one bill. Payments are recorded by hand — no gateway,
-- no card data, no money touching this code.
--
-- Expenses are here because on Nigerian estates the second half of the
-- service charge problem is not billing, it is residents not believing the
-- money was spent on them. A resident who can see where their charge went
-- argues less about paying the next one.

create table service_periods (
  id            uuid primary key default gen_random_uuid(),
  estate_id     uuid not null references estates(id),
  label         text not null,
  service_start date not null,
  service_end   date not null,
  due_date      date not null,
  status        text not null default 'draft'
                check (status in ('draft', 'issued', 'closed')),
  created_at    timestamptz not null default now(),
  check (service_end >= service_start),
  unique (estate_id, label)
);

create table service_bills (
  id         uuid primary key default gen_random_uuid(),
  estate_id  uuid not null references estates(id),
  period_id  uuid not null references service_periods(id) on delete cascade,
  unit_id    uuid not null references units(id),
  amount     numeric(12,2) not null check (amount >= 0),
  issued_at  timestamptz,
  created_at timestamptz not null default now(),
  unique (period_id, unit_id)
);

create index service_bills_unit_idx on service_bills (unit_id);

create table service_payments (
  id          uuid primary key default gen_random_uuid(),
  estate_id   uuid not null references estates(id),
  bill_id     uuid not null references service_bills(id) on delete cascade,
  amount      numeric(12,2) not null check (amount > 0),
  paid_on     date not null,
  method      text not null default 'Bank transfer'
              check (method in ('Bank transfer', 'Cash', 'Cheque', 'POS')),
  reference   text,
  recorded_by uuid references profiles(id),
  created_at  timestamptz not null default now()
);

create index service_payments_bill_idx on service_payments (bill_id);

create table service_expenses (
  id          uuid primary key default gen_random_uuid(),
  estate_id   uuid not null references estates(id),
  period_id   uuid not null references service_periods(id) on delete cascade,
  category    text not null,
  amount      numeric(12,2) not null check (amount > 0),
  spent_on    date not null,
  description text,
  recorded_by uuid references profiles(id),
  created_at  timestamptz not null default now()
);

create index service_expenses_period_idx on service_expenses (period_id);

-- The categories a Nigerian estate actually bills for. Diesel is first
-- because it is the line that swings the total most.
create or replace function public.expense_categories()
returns text[] language sql immutable as $$
  select array[
    'Diesel and generator',
    'Security',
    'Waste disposal',
    'Water',
    'Cleaning',
    'Grounds and gardening',
    'Common area repairs',
    'CCTV and access control',
    'Insurance',
    'Staff salaries',
    'Management fee',
    'Audit fees'
  ]
$$;

-- ---------------------------------------------------------------------
-- Bill status
--
-- The same clock as the maintenance escalation, wearing different words:
-- a start, a due date, and three states. Reuse windowLeft and cardTone in
-- the frontend rather than writing a second countdown.
-- ---------------------------------------------------------------------

create or replace view service_bill_status
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
    when b.amount - coalesce(paid.total, 0) <= 0        then 'paid'
    when current_date > sp.due_date                     then 'overdue'
    when coalesce(paid.total, 0) > 0                    then 'part paid'
    else 'due'
  end                                               as pay_status,
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

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------

alter table service_periods  enable row level security;
alter table service_bills    enable row level security;
alter table service_payments enable row level security;
alter table service_expenses enable row level security;

create policy periods_read on service_periods for select
  using (estate_id = public.my_estate());

create policy bills_own on service_bills for select
  using (exists (select 1 from units u
                  where u.id = service_bills.unit_id and u.resident_id = auth.uid()));

create policy bills_staff on service_bills for select
  using (public.is_staff() and estate_id = public.my_estate());

create policy payments_own on service_payments for select
  using (exists (select 1 from service_bills b join units u on u.id = b.unit_id
                  where b.id = service_payments.bill_id and u.resident_id = auth.uid()));

create policy payments_staff on service_payments for select
  using (public.is_staff() and estate_id = public.my_estate());

-- Expenses are readable by everyone on the estate, deliberately. That is
-- the whole point of recording them.
create policy expenses_read on service_expenses for select
  using (estate_id = public.my_estate());

-- ---------------------------------------------------------------------
-- Management: issue a period, record money in, record money out
-- ---------------------------------------------------------------------

create or replace function public.issue_service_period(
  p_period_id       uuid,
  p_amount_per_unit numeric
) returns int
language plpgsql security definer set search_path = public as $$
declare
  v_period service_periods;
  v_count  int;
begin
  if public.my_role() not in ('facility_manager', 'ceo') then
    raise exception 'Only management can issue a service charge';
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

create or replace function public.record_payment(
  p_bill_id   uuid,
  p_amount    numeric,
  p_paid_on   date,
  p_method    text default 'Bank transfer',
  p_reference text default null
) returns service_payments
language plpgsql security definer set search_path = public as $$
declare
  v_bill    service_bills;
  v_paid    numeric;
  v_payment service_payments;
begin
  if public.my_role() not in ('facility_manager', 'ceo') then
    raise exception 'Only management can record a payment';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'A payment needs an amount';
  end if;

  select * into v_bill from service_bills where id = p_bill_id for update;
  if not found then raise exception 'No such bill'; end if;
  if v_bill.estate_id is distinct from public.my_estate() then
    raise exception 'That bill is not on your estate';
  end if;

  select coalesce(sum(amount), 0) into v_paid
  from service_payments where bill_id = p_bill_id;

  if v_paid + p_amount > v_bill.amount then
    raise exception 'That would overpay the bill by %',
      to_char(v_paid + p_amount - v_bill.amount, 'FM999,999,999.00');
  end if;

  insert into service_payments (
    estate_id, bill_id, amount, paid_on, method, reference, recorded_by
  ) values (
    v_bill.estate_id, p_bill_id, p_amount, coalesce(p_paid_on, current_date),
    coalesce(p_method, 'Bank transfer'),
    nullif(trim(coalesce(p_reference, '')), ''), auth.uid()
  )
  returning * into v_payment;

  return v_payment;
end $$;

create or replace function public.record_expense(
  p_period_id   uuid,
  p_category    text,
  p_amount      numeric,
  p_spent_on    date,
  p_description text default null
) returns service_expenses
language plpgsql security definer set search_path = public as $$
declare
  v_period  service_periods;
  v_expense service_expenses;
begin
  if public.my_role() not in ('facility_manager', 'ceo') then
    raise exception 'Only management can record an expense';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'An expense needs an amount';
  end if;
  if not (p_category = any (public.expense_categories())) then
    raise exception 'Unknown category: %', p_category;
  end if;

  select * into v_period from service_periods where id = p_period_id;
  if not found then raise exception 'No such period'; end if;
  if v_period.estate_id is distinct from public.my_estate() then
    raise exception 'That period is not on your estate';
  end if;

  insert into service_expenses (
    estate_id, period_id, category, amount, spent_on, description, recorded_by
  ) values (
    v_period.estate_id, p_period_id, p_category, p_amount,
    coalesce(p_spent_on, current_date),
    nullif(trim(coalesce(p_description, '')), ''), auth.uid()
  )
  returning * into v_expense;

  return v_expense;
end $$;

-- ---------------------------------------------------------------------
-- Where the money went. Readable by residents — that is the point.
-- ---------------------------------------------------------------------

create or replace view service_spend_breakdown
with (security_invoker = on) as
select
  e.estate_id,
  e.period_id,
  sp.label as period_label,
  e.category,
  sum(e.amount) as spent,
  round(100 * sum(e.amount) / nullif(sum(sum(e.amount)) over (partition by e.period_id), 0), 1)
    as share_percent
from service_expenses e
join service_periods sp on sp.id = e.period_id
group by e.estate_id, e.period_id, sp.label, e.category
order by sum(e.amount) desc;

grant execute on function public.issue_service_period(uuid, numeric)                to authenticated;
grant execute on function public.record_payment(uuid, numeric, date, text, text)    to authenticated;
grant execute on function public.record_expense(uuid, text, numeric, date, text)    to authenticated;
grant select on service_bill_status, service_spend_breakdown to authenticated;
