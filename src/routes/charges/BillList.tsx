import { Fragment, useState } from 'react'
import type { ReactNode } from 'react'
import { Empty, SkeletonList } from '../../components/States'
import { TONE_CHIP } from '../../lib/issues'
import { naira } from '../../lib/money'
import { useMediaQuery } from '../../lib/useMediaQuery'
import PaymentForm from './PaymentForm'
import { statusTone, type Bill } from './bills'

function Chip({ bill }: { bill: Bill }) {
  return (
    <span
      className={`shrink-0 rounded-sm border px-1.5 py-0.5 text-xs ${TONE_CHIP[statusTone(bill.pay_status)]}`}
    >
      {bill.pay_status}
    </span>
  )
}

/** Separate from the chip, deliberately: a bill can be part paid and late. */
function LateMark({ bill }: { bill: Bill }) {
  if (!bill.is_overdue) return null
  return (
    <span className="num shrink-0 rounded-sm border border-destructive/35 bg-destructive-soft px-1.5 py-0.5 text-xs text-destructive">
      {bill.days_overdue}d late
    </span>
  )
}

function Cell({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return <td className={`px-3 py-2 align-top ${className}`}>{children}</td>
}

export default function BillList({
  bills,
  pending,
  allowPayment,
}: {
  bills: Bill[]
  pending: boolean
  /** The CEO's page is oversight only; the manager's does the entry. */
  allowPayment: boolean
}) {
  const wide = useMediaQuery('(min-width: 768px)')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const toggle = (id: string) => setExpandedId(expandedId === id ? null : id)

  function expanded(bill: Bill) {
    return (
      <>
        <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-foreground-faint">
          <span>{bill.resident_name ?? 'No resident on file'}</span>
          {bill.resident_phone && (
            <span className="num">{bill.resident_phone}</span>
          )}
        </p>
        {Number(bill.outstanding) > 0 ? (
          allowPayment ? (
            <PaymentForm bill={bill} />
          ) : (
            <p className="mt-3 border-t border-subtle pt-3 text-sm text-foreground-muted">
              <span className="num">{naira(bill.outstanding)}</span> still to
              come in. The facility manager records payments.
            </p>
          )
        ) : (
          <p className="mt-3 border-t border-subtle pt-3 text-sm text-foreground-muted">
            Nothing outstanding on this bill.
          </p>
        )}
      </>
    )
  }

  if (pending) return <SkeletonList rows={4} />

  if (bills.length === 0) {
    return (
      <Empty>
        No bills yet. Once a service charge period is issued, every unit on the
        estate appears here with what it owes.
      </Empty>
    )
  }

  if (wide) {
    return (
      <div className="overflow-x-auto rounded-sm border border-subtle bg-card">
        <table className="w-full min-w-[48rem] border-collapse text-sm">
          <thead>
            <tr className="border-b border-subtle text-left text-xs text-foreground-faint">
              <th className="px-3 py-2 font-normal">Unit</th>
              <th className="px-3 py-2 font-normal">Resident</th>
              <th className="px-3 py-2 font-normal">Amount</th>
              <th className="px-3 py-2 font-normal">Paid</th>
              <th className="px-3 py-2 font-normal">Outstanding</th>
              <th className="px-3 py-2 font-normal">Status</th>
              <th className="px-3 py-2 font-normal">Late</th>
            </tr>
          </thead>
          <tbody>
            {bills.map((bill) => {
              const open = expandedId === bill.bill_id
              return (
                <Fragment key={bill.bill_id}>
                  <tr
                    onClick={() => toggle(bill.bill_id)}
                    aria-expanded={open}
                    className="cursor-pointer border-b border-subtle hover:bg-surface-2"
                  >
                    <Cell>{bill.unit_label}</Cell>
                    <Cell>{bill.resident_name ?? '—'}</Cell>
                    <Cell className="num">{naira(bill.amount)}</Cell>
                    <Cell className="num">{naira(bill.paid)}</Cell>
                    <Cell className="num">{naira(bill.outstanding)}</Cell>
                    <Cell>
                      <Chip bill={bill} />
                    </Cell>
                    <Cell>
                      <LateMark bill={bill} />
                    </Cell>
                  </tr>
                  {open && (
                    <tr className="border-b border-subtle bg-surface-2">
                      <td colSpan={7} className="px-3 py-3">
                        {expanded(bill)}
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <ul className="space-y-3">
      {bills.map((bill) => {
        const open = expandedId === bill.bill_id
        return (
          <li
            key={bill.bill_id}
            className="rounded-sm border border-subtle bg-card"
          >
            <button
              type="button"
              onClick={() => toggle(bill.bill_id)}
              aria-expanded={open}
              className="w-full px-3.5 py-3 text-left"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <span className="text-base">{bill.unit_label}</span>
                <span className="flex shrink-0 gap-2">
                  <Chip bill={bill} />
                  <LateMark bill={bill} />
                </span>
              </div>
              <p className="mt-0.5 text-sm text-foreground-muted">
                {bill.resident_name ?? 'No resident on file'}
              </p>
              <p className="num mt-1.5 flex flex-wrap gap-x-4 text-sm">
                <span>{naira(bill.amount)}</span>
                <span className="text-foreground-muted">
                  paid {naira(bill.paid)}
                </span>
                <span
                  className={
                    Number(bill.outstanding) > 0
                      ? 'text-destructive'
                      : 'text-foreground-muted'
                  }
                >
                  out {naira(bill.outstanding)}
                </span>
              </p>
            </button>
            {open && (
              <div className="border-t border-subtle px-3.5 py-3">
                {expanded(bill)}
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}
