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

export type Tone = 'green' | 'amber' | 'red' | 'primary' | 'grey'

export const TONE_BORDER: Record<Tone, string> = {
  green: 'border-l-green',
  amber: 'border-l-amber',
  red: 'border-l-red',
  primary: 'border-l-primary',
  grey: 'border-l-line-strong',
}

export const TONE_CHIP: Record<Tone, string> = {
  green: 'border-green/35 bg-green-bg text-green',
  amber: 'border-amber/35 bg-amber-bg text-amber',
  red: 'border-red/35 bg-red-bg text-red',
  primary: 'border-primary/30 bg-sunk text-primary',
  grey: 'border-line bg-sunk text-ink-soft',
}

export const TONE_FILL: Record<Tone, string> = {
  green: 'bg-green',
  amber: 'bg-amber',
  red: 'bg-red',
  primary: 'bg-primary',
  grey: 'bg-line-strong',
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
  if (remaining <= 0) return 'red'
  if (fraction < 0.25) return 'amber'
  return 'green'
}

export function cardTone(issue: Clocked, now: number): Tone {
  if (issue.status === 'submitted') {
    const { remaining, fraction } = windowLeft(issue, now)
    return countdownTone(remaining, fraction)
  }
  if (issue.status === 'assigned') return 'primary'
  if (issue.status === 'resolved') return 'green'
  return 'grey'
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

/** "14 min left", "3 hr 20 min left", "12 min past". */
export function countdownLabel(remaining: number): string {
  const past = remaining <= 0
  const total = Math.floor(Math.abs(remaining) / 60_000)
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
  reporter: { full_name: string; phone: string | null } | null
  technician: { full_name: string; trade: string; phone: string } | null
}

export const BOARD_SELECT =
  'id, ref, unit_id, title, description, category, priority, status, created_at, ' +
  'clock_started_at, sla_due_at, escalated_at, access_permission, assigned_at, ' +
  'assigned_technician_id, resolved_at, closed_at, nudged_at, ' +
  'unit:units(label), reporter:profiles(full_name, phone), ' +
  'technician:technicians(full_name, trade, phone)'
