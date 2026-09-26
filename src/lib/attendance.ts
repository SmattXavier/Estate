import type { Tone } from './issues'

export type Shift = {
  id: string
  full_name: string
  trade: string | null
  staff_kind: string | null
  clock_in_at: string
  clock_out_at: string | null
  clock_in_on_site: boolean | null
  clock_out_on_site: boolean | null
  clock_in_metres: number | string | null
  minutes: number | string | null
  on_shift: boolean
}

export type SiteState = {
  label: string
  tone: Tone
  /** Absent when there is no location to report. */
  distance: string | null
}

/** "18m", "2.4km" — a figure a person can picture. */
export function distance(metres: number | string | null): string | null {
  if (metres === null || metres === '') return null
  const m = Number(metres)
  if (!Number.isFinite(m)) return null
  return m >= 1000 ? `${(m / 1000).toFixed(1)}km` : `${Math.round(m)}m`
}

/**
 * Three states, not two.
 *
 * null is NOT off site. A phone with its location off is not the same as a
 * person who clocked in from home, and rendering them alike accuses someone
 * of something they did not do. Same shape of trap as derived expiry and
 * days_overdue; it lives here once so both screens answer identically.
 *
 * Off site is information, not a verdict — warning, never destructive, and
 * never the word "violation". The manager decides what it means.
 */
export function siteState(
  onSite: boolean | null,
  metres: number | string | null,
): SiteState {
  if (onSite === null) {
    return { label: 'Not recorded', tone: 'neutral', distance: null }
  }
  if (onSite) {
    return { label: 'On site', tone: 'success', distance: distance(metres) }
  }
  return { label: 'Off site', tone: 'warning', distance: distance(metres) }
}

/** "7 hr 20 min", "45 min" — the same shape as the countdown label. */
export function spell(minutes: number): string {
  const total = Math.max(Math.floor(minutes), 0)
  if (total < 1) return 'under a minute'
  const hours = Math.floor(total / 60)
  const rest = total % 60
  return hours > 0 ? `${hours} hr ${rest} min` : `${rest} min`
}

/**
 * How long the shift has run. The view's `minutes` is computed at read time,
 * so an open shift would sit frozen between refetches — measure from
 * clock_in_at instead and let the caller tick.
 */
export function shiftMinutes(shift: Shift, now: number): number {
  const start = new Date(shift.clock_in_at).getTime()
  const end = shift.clock_out_at
    ? new Date(shift.clock_out_at).getTime()
    : now
  return Math.round((end - start) / 60_000)
}
