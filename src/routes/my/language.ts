// Everything the resident screens say, in one place. Mechanics live in
// src/lib/issues.ts and src/lib/money.ts; this file is only wording.
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

/** The panel beside the form from 1280px. Three lines, resident language. */
export const WHAT_HAPPENS_NEXT = [
  'The estate office sees this the moment you send it.',
  'The time shown against the urgency you choose is when someone should be on their way to you.',
  'You can follow it any time under "My reports".',
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

// ---------------------------------------------------------------------
// Service charge
// ---------------------------------------------------------------------

/** "12 September", and the year too when it is not this one. */
export function dueDay(iso: string): string {
  const date = new Date(iso + 'T00:00:00')
  const sameYear = date.getFullYear() === new Date().getFullYear()
  return date.toLocaleDateString('en-NG', {
    day: 'numeric',
    month: 'long',
    ...(sameYear ? {} : { year: 'numeric' }),
    timeZone: 'Africa/Lagos',
  })
}

/**
 * What the bill is doing, in one sentence. pay_status and is_overdue are
 * two separate facts and a bill can carry both, so a part paid bill that is
 * also late says both things rather than picking one.
 */
export function billLine(bill: {
  pay_status: string
  is_overdue: boolean
  days_overdue: number
}): string {
  if (bill.pay_status === 'paid') return 'Paid in full. Thank you.'
  const late = `It is ${bill.days_overdue} ${
    bill.days_overdue === 1 ? 'day' : 'days'
  } past the date it was due.`
  if (bill.pay_status === 'part paid') {
    return bill.is_overdue
      ? `You have paid part of this. ${late}`
      : 'You have paid part of this.'
  }
  return bill.is_overdue ? `Nothing paid yet. ${late}` : 'Nothing paid yet.'
}

export const NO_PAYMENTS_YET =
  'No payments yet. Anything the estate office records against this bill will appear here.'

export const NO_BILLS_YET =
  'No service charge has been raised for your flat yet. When it is, you will see what is owed and what has been paid.'
