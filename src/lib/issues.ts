// Shared issue mechanics. How much of a window is left is the same question
// on every screen; what you call it is not. Wording lives with its screen.

export type IssueStatus = 'submitted' | 'assigned' | 'resolved' | 'closed'
export type Priority = 'emergency' | 'high' | 'normal' | 'low'

export type UpdateKind =
  | 'log'
  | 'dispatch'
  | 'resolution'
  | 'confirmation'
  | 'reopen'
  | 'escalation'
  | 'note'

/** The columns every screen selects. */
export type Issue = {
  id: string
  ref: string
  unit_id: string
  title: string
  description: string
  category: string
  priority: Priority
  status: IssueStatus
  created_at: string
  clock_started_at: string
  sla_due_at: string
  escalated_at: string | null
  unit: { label: string } | null
}

export type IssueUpdate = {
  id: string
  author_name: string
  kind: UpdateKind
  body: string
  created_at: string
}

export type Unit = { id: string; label: string }

/** The minimum needed to run the clock, so both issue shapes satisfy it. */
export type Clocked = {
  status: IssueStatus
  clock_started_at: string
  sla_due_at: string
}

export const BOARD_ISSUES_KEY = ['board-issues']
export const OVERVIEW_ISSUES_KEY = ['overview-issues']

/** Semantic, matching the token families. Assigned is info blue (STATES.md). */
export type Tone = 'success' | 'warning' | 'destructive' | 'info' | 'neutral'

export const TONE_BORDER: Record<Tone, string> = {
  success: 'border-l-success',
  warning: 'border-l-warning',
  destructive: 'border-l-destructive',
  info: 'border-l-info',
  neutral: 'border-l-strong',
}

export const TONE_CHIP: Record<Tone, string> = {
  success: 'border-success/35 bg-success-soft text-success',
  warning: 'border-warning/35 bg-warning-soft text-warning',
  destructive: 'border-destructive/35 bg-destructive-soft text-destructive',
  info: 'border-info/35 bg-info-soft text-info',
  neutral: 'border-subtle bg-surface-2 text-foreground-muted',
}

export const TONE_FILL: Record<Tone, string> = {
  success: 'bg-success',
  warning: 'bg-warning',
  destructive: 'bg-destructive',
  info: 'bg-info',
  neutral: 'bg-strong',
}

/**
 * How much of the promised window is left. Display only — whether an issue
 * has actually been escalated is `escalated_at`, stamped by the server
 * (Rule 14).
 */
export function windowLeft(issue: Clocked, now: number) {
  const start = new Date(issue.clock_started_at).getTime()
  const due = new Date(issue.sla_due_at).getTime()
  const total = Math.max(due - start, 1)
  const remaining = due - now
  return { remaining, fraction: Math.min(Math.max(remaining / total, 0), 1) }
}

export function isPastTarget(issue: Clocked, now: number): boolean {
  return issue.status === 'submitted' && windowLeft(issue, now).remaining <= 0
}

export function countdownTone(remaining: number, fraction: number): Tone {
  if (remaining <= 0) return 'destructive'
  if (fraction < 0.25) return 'warning'
  return 'success'
}

export function cardTone(issue: Clocked, now: number): Tone {
  if (issue.status === 'submitted') {
    const { remaining, fraction } = windowLeft(issue, now)
    return countdownTone(remaining, fraction)
  }
  if (issue.status === 'assigned') return 'info'
  if (issue.status === 'resolved') return 'success'
  return 'neutral'
}

function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? '' : 's'}`
}

/** "20 minutes", "3 hours", "2 days". */
export function gap(ms: number): string {
  const minutes = Math.floor(ms / 60_000)
  if (minutes < 1) return 'less than a minute'
  if (minutes < 60) return plural(minutes, 'minute')
  const hours = Math.floor(minutes / 60)
  if (hours < 48) return plural(hours, 'hour')
  return plural(Math.floor(hours / 24), 'day')
}

/** "14 min left", "3 hr 20 min left", "12 min past", "under a minute left". */
export function countdownLabel(remaining: number): string {
  const past = remaining <= 0
  const total = Math.floor(Math.abs(remaining) / 60_000)
  // "0 min" is never the truth: either the last minute is still running or
  // the target has only just gone.
  if (total === 0) return past ? 'under a minute past' : 'under a minute left'
  const hours = Math.floor(total / 60)
  const minutes = total % 60
  const clock = hours > 0 ? `${hours} hr ${minutes} min` : `${minutes} min`
  return past ? `${clock} past` : `${clock} left`
}

export function timeOfDay(iso: string): string {
  return new Date(iso).toLocaleString('en-NG', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Africa/Lagos',
  })
}

/** Everything the manager's board and the CEO's table select on top of the core. */
export type BoardIssue = Issue & {
  access_permission: boolean
  assigned_at: string | null
  assigned_technician_id: string | null
  resolved_at: string | null
  closed_at: string | null
  nudged_at: string | null
  work_cost: number | string | null
  reporter: { full_name: string; phone: string | null } | null
  technician: { full_name: string; trade: string; phone: string } | null
}

export const BOARD_SELECT =
  'id, ref, unit_id, title, description, category, priority, status, created_at, ' +
  'clock_started_at, sla_due_at, escalated_at, access_permission, assigned_at, ' +
  'assigned_technician_id, resolved_at, closed_at, nudged_at, work_cost, ' +
  'unit:units(label), reporter:profiles(full_name, phone), ' +
  'technician:technicians(full_name, trade, phone)'

/**
 * Escalated *and* still nobody's job. This is the CEO's alert set, and it is
 * read off the server stamp only — never from comparing sla_due_at to the
 * browser clock (Rule 14). Both the alert panel and the "past target now"
 * figure call this, so the two can never disagree on screen.
 */
export function isEscalated(issue: {
  status: IssueStatus
  escalated_at: string | null
}): boolean {
  return issue.status === 'submitted' && issue.escalated_at !== null
}

/**
 * Minutes from the clock starting to an artisan being named. Measured from
 * clock_started_at, not created_at, so a reopened fault is not charged for
 * the time it spent correctly closed (STATES.md). Null until assigned.
 */
export function minutesToAssign(issue: {
  assigned_at: string | null
  clock_started_at: string
}): number | null {
  if (!issue.assigned_at) return null
  const start = new Date(issue.clock_started_at).getTime()
  return Math.round((new Date(issue.assigned_at).getTime() - start) / 60_000)
}

/** Did the assignment land inside the promised window? Null until assigned. */
export function assignedWithinTarget(issue: {
  assigned_at: string | null
  sla_due_at: string
}): boolean | null {
  if (!issue.assigned_at) return null
  return new Date(issue.assigned_at).getTime() <= new Date(issue.sla_due_at).getTime()
}
