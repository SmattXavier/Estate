# Estate maintenance desk — project rules

Read this file and `docs/STATES.md` before writing any code. Every prompt in
this repo inherits these rules.

## What this is

A complaint desk for a Nigerian residential estate. Three people:

| Who | Does |
|---|---|
| Resident | Logs a fault, tracks it, confirms or rejects the fix |
| Facility manager | Sees the board, dispatches an artisan, records what was needed |
| CEO | Sees everything, gets alerted when a target slips, exports the record |

The point of the product is the **clock**. A fault that nobody is assigned to
within its target time escalates to the CEO. Everything else is supporting cast.

Demo estate: Wuse II Estate, Abuja. Currency ₦. Timezone Africa/Lagos.

## Stack

React 18 + Vite 5 + TypeScript 5, Tailwind v4, TanStack Query, React Router,
Supabase (Postgres, Auth, RLS, pg_cron). Vercel for hosting.

## The schema is finished. Do not change it.

`supabase/migrations/001_schema.sql`, `002_seed.sql` and `003_functions.sql`
are already applied and verified by `supabase/tests/full_lifecycle.sql`.

**Do not write migrations. Do not add tables or columns. Do not alter RLS.**
If you think the schema is missing something, stop and say so — do not fix it
yourself.

## Architecture rules

**Rule 1 — All writes go through RPCs.** There are no INSERT/UPDATE/DELETE
policies on any table, on purpose. The client calls `supabase.rpc(...)`:

| Action | Function |
|---|---|
| Resident logs a fault | `log_issue(unit_id, category, priority, title, description, access_permission)` |
| Manager dispatches | `assign_technician(issue_id, technician_id, reply)` |
| Manager records the fix | `resolve_issue(issue_id, work_done, materials, cost)` |
| Resident confirms | `confirm_resolution(issue_id)` |
| Resident rejects | `reopen_issue(issue_id, reason)` |
| CEO chases | `nudge_facility_manager(issue_id, note)` |

A `.from('issues').update(...)` anywhere in the frontend is a bug.

**Rule 12 — Audit and notification obligations are server-side, in the same
transaction as the main write.** This is already true in `003_functions.sql`;
do not add a second client-side call that writes a timeline entry after an
RPC succeeds. If a write can succeed while its audit row fails, it is wrong.

**Rule 13 — Never rely on RLS alone to scope a user-facing query.** Every
resident query must also carry its own filter, e.g.
`.eq('reported_by', user.id)`. RLS is the backstop, not the mechanism. A
policy that is dropped or mis-edited during a later change should degrade to
an empty list, not to somebody else's data.

**Rule 14 — The escalation clock is server time, never browser time.**
Compute overdue from `sla_due_at` against `new Date()` only for *display
countdown*. Whether an issue *is* escalated is `escalated_at !== null`, set by
the `escalate_overdue()` cron. Never let the browser decide escalation state,
or the alert exists only while someone is looking at it.

**Rule 15 — The facility manager cannot close his own work.** Only the
resident who reported a fault can move it from `resolved` to `closed`. This is
enforced in the database; do not add a manager-side close button.

## Reading data

Read with plain selects, wrapped in TanStack Query.

- Resident list: `issues` where `reported_by = user.id`, newest first.
- Manager board: `issues` where `estate_id = profile.estate_id`, split into
  three lanes by status — see STATES.md.
- CEO table: same, plus the `issue_export` view for the CSV.
- Timeline: `issue_updates` where `issue_id = ?` ordered by `created_at`.

Refetch interval 15s on the board and the CEO screen. No websockets; polling
is enough and it fails quietly on a bad connection.

## Priorities and targets

| Priority | Target to assign |
|---|---|
| emergency | 15 minutes |
| high | 1 hour |
| normal | 4 hours |
| low | 24 hours |

Never hardcode these in the frontend. Read `sla_due_at` off the row.

## Interface rules

Three genuinely different screens, not one dashboard with a role switch.

- **Resident** — mobile-first, single column, max 440px. Plain language. Never
  the words "SLA", "ticket", "escalate", "dispatch". Say "someone is coming".
- **Facility manager** — dense three-lane board, desktop-first: *Needs you
  now* (submitted, least time left first) / *Artisan out* (assigned) /
  *Finished* (resolved + closed). The artisan directory is a separate route
  reached from an issue, and it returns to that issue afterwards.
- **CEO** — quiet. Red alert band only when `escalated_at is not null and
  status = 'submitted'`. Four numbers, then the full table, then export.

Routing after sign-in, by `profiles.role`:
`resident → /my`, `facility_manager → /board`, `ceo → /overview`.
Any signed-out visit lands on `/`.

## Style

Tailwind v4. No component library beyond what is already installed. Colours:
ink `#14232B`, primary `#0E5A6E`, amber `#A9761B`, red `#A62A1F`, green
`#2F6E4F`, line `#D6DEDC`. Tabular numerals on every clock and countdown.

## Scope discipline

The demo is a walkthrough of one fault, from report to closure, plus one
escalation. Anything not on that path is out of scope: photo upload,
notifications, multi-estate switching, artisan logins, resident ratings,
charts. If asked to build something not in `docs/BUILD_TASKS.md`, say so
first.

## How to work

Before writing code, list the files you plan to create or modify and wait for
confirmation. Do one task at a time. If a task looks like it needs more than
six files, it is over-built — cut it.
