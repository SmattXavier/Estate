# Service charge — who does what

Amendment to Phase 3. Run **after** `010_charge_roles.sql` has been applied.

## The split

| Action | Who |
|---|---|
| Issue a period, set the amount per unit | CEO only |
| Record a payment received | Facility manager, or CEO |
| Record an expense | Facility manager, or CEO |
| See arrears, totals and spend | Both |

The person who decides how much to collect should not also be the one
spending it and banking it. Day to day the manager does the entry — he is at
the desk when a resident brings a transfer receipt, and he is the one buying
diesel. The CEO keeps entry rights so he can correct a mistake without
waiting, but his screen is for oversight.

`010_charge_roles.sql` enforces the first row in the database.
`supabase/tests/charge_roles.sql` proves it.

## Stage 1 — Give the facility manager a charge page

New route `/board/charges`, nav entry "Service charge" below "Artisans".

It carries what the CEO's page carries now, because the manager is the one
acting on it:

- The four figures: units billed, collected, outstanding, units in arrears
- The arrears section — filtered on `is_overdue`, **never** on
  `days_overdue > 0`, which reads 12 on settled bills too
- The full bill list: table from 768px, stacked cards below
- Record a payment, on a bill with anything outstanding
- Record an expense

Query with an explicit `.eq('estate_id', profile.estate_id)` (Rule 13).

The CEO page is already 470 lines and at its limit. **Extract before
reusing**: pull the figures strip, the arrears section, the bill list and the
two forms into `src/routes/charges/` components that both pages import. Do
not copy the file — two copies of an arrears filter is exactly how the
`days_overdue` trap gets reintroduced in one of them.

## Stage 2 — Make the CEO's page oversight only

Remove both forms from `/charges`. Everything else stays: figures, arrears,
the bill list, the spend breakdown.

That is a deliberate quietening, matching `/overview` — the CEO's screens
show him what is happening and give him one intervention, not a data entry
desk.

Keep his RPC rights. Removing the forms from his screen is a design choice;
the database still permits him to correct an error, and
`supabase/tests/charge_roles.sql` asserts that.

## Not in scope

No UI for creating or issuing a period. `issue_service_period` is CEO-only
in the database and that is enough for now — one period exists in the seed,
and a period-creation screen is worth doing properly rather than bolting on.
Say so in your report rather than inventing one.

## Verify

- 390, 768 and 1440 in both themes on `/board/charges`: no horizontal
  scroll, inputs 16px or above, tap targets 44px or above.
- Both pages read the same numbers: outstanding on `/board/charges` equals
  outstanding on `/charges` equals `select sum(outstanding) from
  service_bill_status`.
- Arrears counts 3, not 7, on both pages.
- Signed in as the facility manager, recording a payment succeeds.
- Confirm the CEO's page no longer renders either form.
