/**
 * Money, in one place. Moved out of issues.ts: a service-charge page
 * importing its formatter from an issues module was the wrong shape, and
 * later phases need it too.
 */

const NAIRA = new Intl.NumberFormat('en-NG', {
  style: 'currency',
  currency: 'NGN',
  maximumFractionDigits: 0,
})

/** numeric(12,2) can arrive as a string; a dash beats "₦NaN". */
export function naira(value: number | string | null): string {
  if (value === null || value === '') return '—'
  const amount = Number(value)
  return Number.isFinite(amount) ? NAIRA.format(amount) : '—'
}
