# Phase 5 — Attendance and geo-tagging

Read CLAUDE.md, docs/DENSITY.md and docs/PAGE_WIDTH.md first.

Two stages. **No schema changes** — everything here is built and verified by
`supabase/tests/phase2_lifecycle.sql`, section B.

Stop after each stage and report.

## What exists already

The `staff_attendance` view (`security_invoker`), one row per shift:
`full_name`, `trade`, `staff_kind`, `clock_in_at`, `clock_out_at`,
`clock_in_on_site`, `clock_out_on_site`, `clock_in_metres`, `minutes`,
`on_shift`.

RPCs `clock_in(lat, lng, accuracy)` and `clock_out(lat, lng, accuracy)`,
both for the signed-in staff member, both taking nulls.

The estate carries `lat`, `lng` and `geofence_metres` — 300m in the seed.
Distance is computed server-side by `metres_between`.

Seeded shifts: Joseph Okon on shift now, 18m from the centre; Emeka Obi
finished yesterday, on site; and Emeka Obi two days ago **clocked in 2.4km
away**, which is the case the manager's screen exists to surface.

## Three states, not two

`clock_in_on_site` is a nullable boolean and all three values mean
different things:

| Value | Means | Show |
|---|---|---|
| `true` | inside the fence | On site, with the distance |
| `false` | outside the fence | Off site, with the distance, `--warning` |
| `null` | no location was captured | Not recorded, neutral, no distance |

**Never render `null` as off site.** A phone with GPS off is not the same as
a person who clocked in from home, and treating them alike would accuse
someone of something they did not do. This is the same shape of trap as
derived expiry in Phase 4 and `days_overdue` in Phase 3 — put the mapping
in one function and use it on both screens.

Off site is information, not a verdict. Label it plainly and let the manager
judge; do not call it a violation, and do not use `--destructive`.

## Stage 1 — The manager's attendance view

Route `/board/attendance`, nav entry "Attendance" below "Service charge".

**Who is on now.** At the top, anyone with `on_shift` true: name, trade,
when they clocked in, how long they have been on, and their location state.
Hide the section when nobody is on shift.

**Recent shifts**, newest first, last seven days: name, trade, clock-in
time and state, clock-out time and state, and hours worked. Table from
768px, stacked cards below, matching the `/board/charges` pattern.

A shift still running shows a live figure rather than a dash — reuse the
existing ticking pattern rather than writing a third one.

**Three figures**, in the standard bordered strip: on shift now, shifts in
the last seven days, and how many of those had a clock-in that was off site
or not recorded. That third number is the one a manager actually wants.

Query with an explicit `.eq('estate_id', profile.estate_id)` (Rule 13).

## Stage 2 — The artisan's own screen

Route `/shifts`, replacing the holding page. This is the whole screen for
that role, used on a phone, often outdoors.

**Off shift:** their name and trade, and one large "Clock in" button.
**On shift:** when they started, a ticking duration, their clock-in location
state, and one large "Clock out" button.

Below either, their own recent shifts — last seven days, same three states.
RLS already scopes `staff_shifts` to their own rows.

**Location.** Reuse `src/lib/geo.ts` from Phase 4 — do not write a second
position wrapper. Denied or timed out means clock in **anyway** with nulls,
and say on screen that the location was not recorded. Never block someone
from clocking in because their phone could not get a fix; the shift matters
more than the evidence, and the manager can see which is which.

Geolocation needs a secure context, so this can only be truly tested on the
deployed site. Say what you could not verify.

**The server owns the rules.** One open shift at a time, and clocking out
with nothing open, are both refused server-side with readable messages —
surface them through `ErrorNote` rather than pre-empting with client-side
checks.

## Rules that still apply

- Writes through RPCs only.
- Every colour a semantic token. Zero hex, zero raw palette classes.
- Loading, empty and error states from `src/components/States.tsx`.
- Phone floors from docs/DENSITY.md; the clock-in button should be
  comfortably larger than 44px.
- Page width rules from docs/PAGE_WIDTH.md.

## Verify

At 390, 768 and 1440 in both themes: no horizontal scroll, tap targets 44px
or above.

Then, against the seeded data specifically:

- the 2.4km clock-in renders as off site **with its distance**, in
  `--warning`, not as a violation
- a shift with `clock_in_on_site` null renders as "not recorded" and **not**
  as off site — create one by clocking in with location denied
- Joseph Okon shows as currently on shift with a live duration
- an artisan sees only their own shifts, a manager sees the estate's
