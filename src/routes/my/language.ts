// Everything this screen says, in one place. Mechanics live in
// src/lib/issues.ts; this file is only wording.
//
// The resident screen never says SLA, ticket, escalate, dispatch, priority
// level or status code. If a word like that appears anywhere in the /my
// route, it came from here and it is a bug.

import { gap, windowLeft, type Clocked, type IssueUpdate, type Priority } from '../../lib/issues'

/** The categories double as the artisan trades in `technicians.trade`. */
export const CATEGORIES = [
  'Plumbing',
  'Electrical',
  'Water supply',
  'Generator',
  'Air conditioning',
  'Carpentry',
  'Cleaning',
  'Security',
] as const

// DISPLAY LABELS ONLY. These describe a fault that does not exist yet, so
// there is no row to read them from. Everything computed after submission —
// the countdown, the bar, whether a report is late — reads `sla_due_at` off
// the row and never these strings.
export const PRIORITY_CHOICES: {
  value: Priority
  label: string
  target: string
}[] = [
  { value: 'emergency', label: 'Emergency', target: 'within 15 minutes' },
  { value: 'high', label: 'Urgent', target: 'within 1 hour' },
  { value: 'normal', label: 'Normal', target: 'within 4 hours' },
  { value: 'low', label: 'Whenever', target: 'within 24 hours' },
]

export const PRIORITY_HELP =
  'This is how quickly the estate office aims to have someone on their way to you.'

/**
 * One sentence per status, and never a promise the row does not support.
 *
 * "Someone is on the way" is keyed on status === 'assigned', which is exactly
 * "assigned_technician_id is set": assign_technician writes both in one
 * statement and reopen_issue clears both, so the two cannot drift apart on a
 * submitted or assigned row. Verified against the live data.
 *
 * The artisan's name is deliberately absent. technicians_staff RLS hides the
 * roster from residents — the embed comes back null and a direct read returns
 * nothing — so there is no name to interpolate here. The resident does see it,
 * written out by the manager, in the dispatch entry on the timeline below.
 */
export function statusLine(issue: Clocked, now: number): string {
  switch (issue.status) {
    case 'submitted':
      return windowLeft(issue, now).remaining <= 0
        ? 'Later than we promised. Still waiting on the estate office.'
        : 'Waiting on the estate office.'
    case 'assigned':
      return 'Someone is on the way.'
    case 'resolved':
      return 'The work is done. Please confirm.'
    case 'closed':
      return 'Closed.'
  }
}

export function reportedLine(issue: Clocked, now: number): string {
  return `You told us about this ${gap(now - new Date(issue.clock_started_at).getTime())} ago.`
}

export const ESCALATION_LINE =
  'We passed the time we promised. The estate office has been told.'

/**
 * Translate by kind, never by matching text in the body. The server wording
 * will change and a string match would silently stop working.
 */
export function timelineBody(update: IssueUpdate): string {
  return update.kind === 'escalation' ? ESCALATION_LINE : update.body
}
