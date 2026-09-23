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

React 19.2.8 + Vite 8.2.2 + TypeScript 6.0.3, Tailwind v4.3.3, TanStack
Query 5, React Router 7, Supabase (Postgres, Auth, RLS, pg_cron). Vercel for
hosting. Build against what is installed, not against these numbers once they
drift — but fix the line when they do.

**Tailwind is CSS-first. There is no `tailwind.config.js` and there should not
be one.** The theme is declared in CSS: raw token values in `src/theme.css`,
mapped onto utility names by `@theme inline` in `src/index.css`.

**The dark variant is `@custom-variant`, not `darkMode: 'class'`.**
`darkMode` is Tailwind v3 configuration and has nowhere to live here. The
equivalent sits at the top of `src/index.css`:

```css
@custom-variant dark (&:where(.dark, .dark *));
```

Same behaviour — `class="dark"` on `<html>` — declared in CSS.

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

- **Resident** — two routes, each a full page inside the shell.
  `/my/new` is the report form alone; `/my/reports` is the list alone, with
  its expand-in-place timeline. `/my` redirects to `/my/reports`. Submitting
  navigates to `/my/reports` with the new report highlighted — the id rides
  in location state, and the highlight expires with the report's own age.
  There are no tabs and no two-column layout. Plain language at every width.
  Never the words "SLA", "ticket", "escalate", "dispatch". Say "someone is
  coming".
- **Facility manager** — dense three-lane board, desktop-first: *Needs you
  now* (submitted, least time left first) / *Artisan out* (assigned) /
  *Finished* (resolved + closed). From 1024px the three lanes scroll
  independently so a long queue in one does not push the others off screen.
  The artisan directory is a separate route: reached from an issue at
  `/board/artisans/:issueId` it returns to that issue afterwards, and reached
  from the sidebar at `/board/artisans` it is a browse-only roster with no
  dispatch button.
- **CEO** — quiet. Red alert band only when `escalated_at is not null and
  status = 'submitted'`. Four numbers, then the full table, then export.

Routing after sign-in, by `profiles.role`:
`resident → /my/reports`, `facility_manager → /board`, `ceo → /overview`.
Any signed-out visit lands on `/`.

## Visual direction

Tailwind v4, no component library beyond what is already installed.

### The shell

Every signed-in route renders inside one shared layout, `src/shell/Shell.tsx`.
From 1024px it is a fixed 240px sidebar: estate name at the top, role-specific
nav links with a rail marking the current page, and at the bottom the theme
toggle, the signed-in person's name and role, and sign out. Content fills the
rest of the viewport — the page itself is never a centred column, though wide
content such as the CEO table may cap its own width. Below 1024px the sidebar
becomes an off-canvas drawer opened from a slim top bar carrying the page
title and a menu button.

Navigation is declared once, in `src/shell/nav.ts`. A new screen adds an entry
there and the sidebar, the drawer and the mobile title all follow.

### Two authored modes

Light and dark are authored independently in `src/theme.css` — dark is not a
filter, inversion or opacity trick over light. Dark is a neutral graphite
base, so the only colour on screen is colour that carries meaning.

`class="dark"` on `<html>` selects the mode. The choice is saved in
localStorage under `estate-theme`; with nothing saved, `prefers-color-scheme`
decides. An inline script in `index.html` applies it before first paint, so
there is no flash of the wrong theme.

### Tokens

Raw values live in `theme.css`, once per mode; `index.css` maps them onto
utility names.

| Family | Tokens |
|---|---|
| Surfaces | `--background`, `--foreground` (+ `-muted`, `-faint`), `--card`, `--surface-2`, `--surface-3` |
| Borders | `--border-subtle`, `--border-strong` |
| Shell | `--shell`, `--shell-foreground` |
| Brand | `--primary` (+ `-hover`, `-foreground`) — teal, for actions only |
| Status | `--success`, `--warning`, `--info`, `--destructive`, each with a `-soft` background; plus `--destructive-surface` / `-on-surface` for the alert band |
| Elevation | `--shadow-e1/e2/e3`, only on things that genuinely float |
| Motion | `--motion-fast/base/slow`, all 1ms under `prefers-reduced-motion` |

**No hex values and no raw Tailwind palette classes (`text-red-600`,
`bg-emerald-50`) in components.** Status colour is carried by a 4px coloured
left border plus a small bordered chip, never by tinting a whole card.
Assigned is `--info` blue, per STATES.md — not the brand teal.

### Type

IBM Plex Sans (400/500/600) for everything, IBM Plex Mono (400/500) via the
`.num` class for refs, clocks, countdowns, counts and money — the figure
only, never the sentence around it.

### Density

Density varies by surface and by width. Resident screens are generous on a
phone and comfortable on desktop; the board and CEO screens are comfortable
and tap-safe on a phone and dense from 1024px. The 768–1023px band takes
desktop text with roomier padding.

Below 768px these are floors, not preferences:

- form controls at 16px minimum, or iOS Safari force-zooms on focus
- 44px minimum for anything tappable (a checkbox may keep its own size if its
  label carries the target)
- text no smaller than 13px — `--text-xs` is raised to `0.8125rem` under
  768px so this holds for screens written later
- sizes in `rem`, not `px`, so enlarged system text actually enlarges

The countdown bar draining is the only animated thing in the app. Loading
skeletons are deliberately still.

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
