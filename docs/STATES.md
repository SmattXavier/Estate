# Issue states

Four states. Read this before touching anything that moves an issue.

```
                  log_issue
                      |
                      v
   +------------> submitted ------------------+
   |                  |                       |
   |                  | assign_technician     | sla_due_at passes,
   |                  | (stops the clock)     | nobody assigned
   |                  v                       v
   |              assigned              escalated_at set
   |                  |                  (still submitted)
   |                  | resolve_issue          |
   |                  v                        | nudge_facility_manager
   |              resolved                     | (CEO, optional)
   |               /      \                    |
   | reopen_issue /        \ confirm_resolution
   +-------------+          \
                             v
                          closed
```

## The table

| From | To | Function | Who | Refused when |
|---|---|---|---|---|
| — | submitted | `log_issue` | resident | not your unit; blank title or description |
| submitted | assigned | `assign_technician` | facility manager | already assigned; empty reply; artisan not on this estate |
| assigned | resolved | `resolve_issue` | facility manager | not assigned yet; blank work description |
| resolved | closed | `confirm_resolution` | resident who reported it | anyone else, including the facility manager |
| resolved | submitted | `reopen_issue` | resident who reported it | anyone else |

No other transition exists. There is no cancel, no delete, no manager-side
close, no direct submitted → resolved.

## Escalation is not a state

`escalated_at` is a **stamp on a submitted issue**, not a fifth state. An
escalated issue is still `submitted` and still appears in the manager's
*Needs you now* lane. It just also appears in the CEO's alert band.

Set by `escalate_overdue()`, which the cron runs every minute:

```
status = 'submitted' AND escalated_at IS NULL AND sla_due_at < now()
```

The sweep is idempotent — running it twice escalates nothing twice and writes
no second timeline entry. This is tested in `full_lifecycle.sql` step 3.

Cleared only by `reopen_issue`, which also restarts `clock_started_at` and
`sla_due_at`. A reopened fault can escalate again on its own merits.

`nudged_at` is a second, separate stamp: the CEO has chased the manager about
this one. It requires `escalated_at` to be set already, and it writes a
permanent `escalation` row to the timeline. That permanence is the point — a
phone call leaves no trace, this does.

## The clock

`clock_started_at` is **not** `created_at`. They match on first submission and
diverge after a reopen. Every "how long did this take" calculation uses
`clock_started_at`, so a reopened fault is not penalised for the hours it
spent correctly closed.

`sla_due_at` is written once at log time and once at reopen time, from
`sla_minutes(priority)`. Nothing else moves it.

## Lane mapping for the manager's board

| Lane | Filter | Sort |
|---|---|---|
| Needs you now | `status = 'submitted'` | `sla_due_at` ascending — most overdue at the top |
| Artisan out | `status = 'assigned'` | `assigned_at` descending |
| Finished | `status in ('resolved','closed')` | `resolved_at` descending |

## Colour

| Condition | Colour |
|---|---|
| submitted, `sla_due_at` passed | red |
| submitted, under 25% of the window left | amber |
| submitted, otherwise | green |
| assigned | blue |
| resolved | green |
| closed | grey |

Countdown display is browser-clock, and that is fine. Escalation state is
`escalated_at`, and that is never browser-clock (CLAUDE.md Rule 14).
