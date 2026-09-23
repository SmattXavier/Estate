import { naira } from '../../lib/money'
import type { Bill } from './bills'

/**
 * Absent when nobody is behind. Destructive treatment, but not the CEO's
 * full-bleed red band — money owed is a standing condition, not a live
 * alert, and the band should keep meaning "a fault has gone past target".
 */
export default function Arrears({ bills }: { bills: Bill[] }) {
  if (bills.length === 0) return null

  return (
    <section className="rounded-sm border border-destructive/35 bg-card">
      <h2 className="border-b border-destructive/25 px-4 py-3 text-base text-destructive">
        {bills.length === 1
          ? '1 unit in arrears'
          : `${bills.length} units in arrears`}
      </h2>
      <ul>
        {bills.map((bill) => (
          <li
            key={bill.bill_id}
            className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-subtle px-4 py-3 last:border-0"
          >
            <div className="min-w-0">
              <p className="text-sm">
                {bill.unit_label}
                <span className="ml-3 text-foreground-muted">
                  {bill.resident_name ?? 'No resident on file'}
                </span>
              </p>
              {bill.resident_phone && (
                <p className="num mt-0.5 text-xs text-foreground-faint">
                  {bill.resident_phone}
                </p>
              )}
            </div>
            <p className="flex items-baseline gap-4">
              <span className="num text-base text-destructive">
                {naira(bill.outstanding)}
              </span>
              <span className="num text-xs text-foreground-muted">
                {bill.days_overdue} days overdue
              </span>
            </p>
          </li>
        ))}
      </ul>
    </section>
  )
}
