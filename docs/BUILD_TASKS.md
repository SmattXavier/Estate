# Build tasks

Six tasks, in order. Paste each into Claude Code as its own prompt. Do not
run two at once. After each one, test the check before moving on.

Every prompt assumes Claude Code has read `CLAUDE.md` and `docs/STATES.md` —
say so at the top of each one, because it forgets between sessions.

**If you run short of time, stop after Task 4.** Tasks 1–4 give you the full
demo story: report → escalate → chase → dispatch → fix. Task 5 (confirm) and
Task 6 (export) are worth having but the walkthrough survives without them —
you can close a fault from the Supabase table editor and show the export as a
`select * from issue_export` in the SQL editor. Nobody minds, and it is honest.

---

## Task 1 — Auth and role routing

> Read CLAUDE.md and docs/STATES.md before doing anything.
>
> Task 1 only — authentication and role-based routing. Nothing else.
>
> Build an email/password sign-in page using the existing `src/lib/supabase.ts`
> client. On successful sign-in, read the user's row from `profiles` and route
> by `role`: resident → `/my`, facility_manager → `/board`, ceo → `/overview`.
> Each of those three routes renders only its title and a sign-out button for
> now. Any unauthenticated visit to any route lands on sign-in. Persist the
> session across refresh. Put the signed-in profile in a context so later
> tasks can read `id`, `full_name`, `role` and `estate_id` without refetching.
>
> Before writing any code, list the files you plan to create or modify and
> wait for my confirmation.

**Check:** sign in as `resident@demo.test` and `fm@demo.test` — different
landing pages. Refresh, still signed in.

**Watch for:** if it proposes a migration or a `profiles` insert trigger, it
has not read CLAUDE.md. Make it start over.

---

## Task 2 — Resident screen

> Read CLAUDE.md and docs/STATES.md.
>
> Task 2 — the resident screen at `/my`. Mobile-first, single column, max
> width 440px.
>
> Two tabs. "Report a fault": a form with unit (select from `units` where
> `resident_id` is the signed-in user), category, priority as four tappable
> buttons showing the target time, one-line summary, description, and a
> checkbox for entry permission. Submitting calls the `log_issue` RPC and
> switches to the second tab.
>
> "Your reports": the user's issues, newest first, each showing title, ref,
> unit, a plain-language status line, and for submitted issues a draining
> countdown bar against `sla_due_at`. Tapping one expands it to show the
> description and the `issue_updates` timeline.
>
> Query issues with an explicit `.eq('reported_by', user.id)` — RLS is the
> backstop, not the filter (Rule 13). No RPC other than `log_issue` in this
> task.
>
> Before writing any code, list the files you plan to create or modify and
> wait for my confirmation.

**Check:** log a fault as Emergency. It appears in the list with a 15-minute
bar draining. Confirm the row exists in the Supabase table editor.

---

## Task 3 — Manager board and artisan directory

> Read CLAUDE.md and docs/STATES.md.
>
> Task 3 — the facility manager board at `/board`, and the artisan directory
> at `/board/artisans/:issueId`.
>
> The board is three lanes exactly as specified in STATES.md, desktop-first,
> with a dark left rail showing the manager's name and live counts. Each card
> shows ref, title, unit, category, a status chip, and for submitted issues
> the countdown bar. Cards expand in place to show resident contact details,
> entry permission, the description, and the timeline.
>
> An expanded submitted issue has one button, "Choose an artisan", which
> navigates to the directory route with the trade filter pre-set to the
> issue's category. Picking someone returns to the board with that issue
> expanded and a prefilled reply in a textarea; "Confirm dispatch" calls
> `assign_technician`. Show each artisan's current open job count, computed
> from issues where `assigned_technician_id` matches and status is
> `submitted` or `assigned`.
>
> An issue with `nudged_at` set shows a red line: "The CEO has asked about
> this one."
>
> Refetch every 15 seconds. Before writing any code, list the files you plan
> to create or modify and wait for my confirmation.

**Check:** dispatch the fault you logged in Task 2. It moves lanes, the
countdown disappears, and the reply shows on the resident's timeline.

---

## Task 4 — CEO overview

> Read CLAUDE.md and docs/STATES.md.
>
> Task 4 — the CEO screen at `/overview`.
>
> A dark band with the CEO's name. Below it, a red alert panel listing every
> issue where `escalated_at is not null and status = 'submitted'`, each with
> ref, title, unit, priority, how far past target, and a "Chase the manager"
> button calling `nudge_facility_manager`. The button becomes a disabled
> "Chased Xm ago" once `nudged_at` is set. The whole panel is hidden when
> nothing is escalated.
>
> Then four figures: open issues, past target now, average minutes to assign
> across all assigned issues (using `clock_started_at`), and percentage
> assigned within target. Then a table of every issue, newest first, rows
> expanding to show description and timeline.
>
> Escalation state comes from `escalated_at`, never from comparing
> `sla_due_at` to the browser clock (Rule 14). Refetch every 15 seconds.
>
> Before writing any code, list the files you plan to create or modify and
> wait for my confirmation.

**Check:** the two seeded overdue issues are in the alert panel on load.
Chase one and the red line appears on the manager's board within 15 seconds.

---

## Task 5 — Record the fix, and resident confirmation

> Read CLAUDE.md and docs/STATES.md.
>
> Task 5 — closing the loop.
>
> On the manager board, an expanded assigned issue gets a "Record the fix"
> button opening an inline form: what was done, parts used, cost in naira.
> Submitting calls `resolve_issue`.
>
> On the resident screen, an issue with status `resolved` shows what was done
> and two buttons: "Yes, it is fixed" calling `confirm_resolution`, and "No,
> still broken" calling `reopen_issue`. Reopening restarts the countdown —
> the resident screen must reflect the new `sla_due_at` immediately.
>
> Do not add a close button for the facility manager (Rule 15).
>
> Before writing any code, list the files you plan to create or modify and
> wait for my confirmation.

**Check:** record a fix, confirm as the resident, watch it land in Finished.
Then reopen a different one and watch its clock restart from full.

---

## Task 6 — CSV export

> Read CLAUDE.md and docs/STATES.md.
>
> Task 6 — the export button on the CEO screen.
>
> Select from the `issue_export` view, convert to CSV client-side, and
> download it. The view's column names are already the CSV headers — use them
> in the order the view returns them, do not rename or reorder. Quote every
> field and escape embedded quotes by doubling them. Prefix the file with a
> UTF-8 BOM so Excel opens naira signs and long descriptions correctly.
> Filename `wuse-ii-maintenance-YYYY-MM-DD.csv`.
>
> Before writing any code, list the files you plan to create or modify and
> wait for my confirmation.

**Check:** open the file in Excel. The "What was needed" column has real
content on the resolved and closed rows — that column is the reason the
export exists.

---

## Before the client arrives

1. Re-run `002_seed.sql`. It clears and reseeds, so your rehearsal data is
   gone and the board looks fresh. Two issues are already overdue and one is
   eight minutes from turning red.
2. Confirm the cron is alive: `select * from cron.job;` should list
   `escalate-overdue-issues`. If pg_cron was never enabled, run
   `select public.escalate_overdue();` by hand between demo steps — it does
   the same thing, you are just the scheduler.
3. Three browser windows, signed in as the three accounts. Not three tabs —
   windows, so you can put them side by side.
4. Sign in on all three *before* the client sits down. A sign-in screen is a
   bad first impression and Supabase auth on estate wifi is not fast.

## The walkthrough

Report a burst pipe as Emergency on Ngozi's screen. Point at the manager's
board — it lands in *Needs you now* with a 15-minute bar. Leave it alone and
talk about something else for a minute. It goes red, the cron stamps it, and
the CEO's alert band lights up. Chase from the CEO screen. Back on the board,
the red line has appeared — dispatch Kelechi, confirm, clock stops. Record
the fix. Confirm as Ngozi. Finish on the export, opened in Excel, and point
at the "What was needed" column.

Four minutes. Do not narrate the schema.
