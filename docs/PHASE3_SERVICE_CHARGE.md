# Phase 3 — Service charge

Read CLAUDE.md and docs/STATES.md first.

Two new routes inside the existing shell, two new nav entries. **No schema
changes.** Everything this needs is already built and verified by
`supabase/tests/phase2_lifecycle.sql` — section D.

Stop after each of the two stages and report.

## What exists already

Views, both `security_invoker`:

- `service_bill_status` — one row per bill: `bill_id`, `unit_id`,
  `unit_label`, `resident_id`, `resident_name`, `resident_phone`,
  `period_label`, `service_start`, `service_end`, `due_date`, `amount`,
  `paid`, `outstanding`, `pay_status`, `is_overdue`, `percent_paid`,
  `days_to_due`, `days_overdue`
- `service_spend_breakdown` — `period_id`, `period_label`, `category`,
  `spent`, `share_percent`

Tables readable under RLS: `service_periods`, `service_bills`,
`service_payments`, `service_expenses`.

RPCs: `record_payment(bill_id, amount, paid_on, method, reference)` and
`record_expense(period_id, category, amount, spent_on, description)`.
Valid categories come from `expense_categories()`. Payment methods are
`Bank transfer`, `Cash`, `Cheque`, `POS`.

**`pay_status` and `is_overdue` are orthogonal.** `pay_status` is `paid`,
`part paid` or `unpaid` — how much came in. `is_overdue` is whether the due
date has passed. A bill can be part paid and overdue at once; the seed has
exactly one such bill, and it exists to catch UI that treats these as one
field. Never collapse them into a single status.

## Stage 1 — The resident's charge page

Route `/my/charges`, nav entry "Service charge", below "My reports".

Query `service_bill_status` with an explicit `.eq('resident_id', profile.id)`
— RLS is the backstop, not the filter (Rule 13).

**Their bill.** For each bill, a card showing the period label, the total,
what they have paid, what is still to pay, and the due date. A progress bar
for `percent_paid` using the same bar component pattern as the countdown:
`--success` when paid in full, `--warning` when part paid, `--destructive`
when unpaid and overdue. Plain language — "You have paid", "Still to pay",
"Due by 12 September". A bill that is part paid and overdue must say both:
it is late *and* they have paid something.

**Their payments.** Under each bill, the rows from `service_payments` for
that bill: date, amount, method, reference. If there are none, an empty
state saying payments recorded by the estate office will appear here.

**Where the money went.** A section per period from
`service_spend_breakdown`: each category with its amount and share, ordered
largest first, as a simple labelled bar list — no pie chart, no legend. Above
it, one plain sentence naming the period and the total spent.

This section is the point of the page. On Nigerian estates the reason
residents resist paying is that nobody shows them what the charge bought.
Diesel will dominate, and that is exactly what should be visible.

Residents can read expenses for their estate by policy — that is deliberate.
Residents cannot record anything. No payment form on this page.

## Stage 2 — The CEO's service charge page

Route `/charges`, nav entry "Service charge", below "Overview".

Query `service_bill_status` with an explicit
`.eq('estate_id', profile.estate_id)`.

**Four figures**, in the same bordered strip as `/overview`: units billed,
total collected, total outstanding, and units in arrears (`is_overdue`).
Dash rather than NaN when there is nothing to divide.

**Arrears first.** Above the full list, the overdue bills — unit, resident
name and phone, amount outstanding, days overdue — sorted by days overdue
descending. Use `--destructive` treatment, but not the full-bleed red band;
this is a standing condition, not a live alert. Hide the section entirely
when nothing is overdue.

**Every bill**, as a table above 768px and stacked cards below, matching the
`/overview` pattern. Unit, resident, amount, paid, outstanding, status chip,
and an overdue marker that is separate from the status chip.

**Record a payment.** On a bill with anything outstanding, a form: amount,
date paid, method, reference. Calls `record_payment`. The server refuses
overpayment and returns a readable message — surface it, do not pre-empt it
with client-side arithmetic that could disagree.

**Record an expense.** A form taking category (from `expense_categories()`,
fetched, not hardcoded), amount, date, description. Calls `record_expense`.
After either, invalidate and let the figures update.

Creating or issuing a period is out of scope for this phase. One period
exists in the seed.

## Rules that still apply

- Writes go through the RPCs only. No `.from(...).insert()` anywhere.
- Money renders in naira with thousand separators, in the mono face, using
  the existing formatter rather than a new one.
- Every colour a semantic token. Zero hex, zero raw palette classes.
- Loading, empty and error states on every query, using the shared
  components from `src/components/States.tsx`.
- Phone floors from docs/DENSITY.md: 16px inputs, 44px tap targets, 13px
  smallest text.

## Verify

Per stage, at 390, 768 and 1440 in both themes: no horizontal scroll, no hex
or raw palette classes, inputs at 16px or above, tap targets at 44px or
above.

Then check the numbers against the database rather than trusting the UI:
total outstanding on the CEO page must equal
`select sum(outstanding) from service_bill_status`, and the spend shares
must total 100%. Report both figures.
