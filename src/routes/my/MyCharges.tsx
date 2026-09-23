import { useQuery } from '@tanstack/react-query'
import Bar from '../../components/Bar'
import { Empty, ErrorNote, SkeletonList } from '../../components/States'
import { supabase } from '../../lib/supabase'
import { naira } from '../../lib/money'
import { useAuth } from '../../auth/context'
import type { Tone } from '../../lib/issues'
import {
  NO_BILLS_YET,
  NO_PAYMENTS_YET,
  NO_SPEND_YET,
  billLine,
  dueDay,
} from './language'

type Bill = {
  bill_id: string
  period_id: string
  unit_label: string
  period_label: string
  due_date: string
  amount: number | string
  paid: number | string
  outstanding: number | string
  pay_status: 'paid' | 'part paid' | 'unpaid'
  is_overdue: boolean
  percent_paid: number | string
  days_overdue: number
}

type Payment = {
  id: string
  bill_id: string
  amount: number | string
  paid_on: string
  method: string
  reference: string | null
}

type Spend = {
  period_id: string
  period_label: string
  category: string
  spent: number | string
  share_percent: number | string
}

/**
 * Paid in full is settled, part paid is in progress, and nothing paid is
 * only a problem once the date has gone — an unpaid bill that is not yet
 * due is neutral, because nothing is wrong yet.
 */
function billTone(bill: Bill): Tone {
  if (bill.pay_status === 'paid') return 'success'
  if (bill.pay_status === 'part paid') return 'warning'
  return bill.is_overdue ? 'destructive' : 'neutral'
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-foreground-muted">{label}</p>
      <p className="num mt-0.5 text-base">{value}</p>
    </div>
  )
}

function BillCard({ bill, payments }: { bill: Bill; payments: Payment[] }) {
  const tone = billTone(bill)
  const mine = payments.filter((p) => p.bill_id === bill.bill_id)

  return (
    <li className="rounded-sm border border-subtle bg-card">
      <div className="px-4 py-4">
        <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
          <div className="min-w-0">
            <h2 className="text-base">{bill.period_label}</h2>
            <p className="mt-0.5 text-sm text-foreground-faint">
              {bill.unit_label}
            </p>
          </div>
          {/* Being late is its own fact, kept apart from how much has been
              paid — a bill can be both at once. */}
          {bill.is_overdue && (
            <span className="shrink-0 rounded-sm border border-destructive/35 bg-destructive-soft px-1.5 py-0.5 text-xs text-destructive">
              Late
            </span>
          )}
        </div>

        <Bar
          fraction={Number(bill.percent_paid) / 100}
          tone={tone}
          label={`${Number(bill.percent_paid)}%`}
        />

        <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Figure label="The charge" value={naira(bill.amount)} />
          <Figure label="You have paid" value={naira(bill.paid)} />
          <Figure label="Still to pay" value={naira(bill.outstanding)} />
          <Figure label="Due by" value={dueDay(bill.due_date)} />
        </dl>

        <p className="mt-3 max-w-prose text-base text-foreground-muted md:text-sm">
          {billLine(bill)}
        </p>
      </div>

      <div className="border-t border-subtle px-4 py-4">
        <h3 className="text-sm font-medium">Payments</h3>
        {mine.length === 0 ? (
          <p className="mt-2 max-w-prose text-sm text-foreground-muted">
            {NO_PAYMENTS_YET}
          </p>
        ) : (
          <ul className="mt-2 space-y-2">
            {mine.map((payment) => (
              <li
                key={payment.id}
                className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 border-b border-subtle pb-2 last:border-0 last:pb-0"
              >
                <span className="num text-sm">{dueDay(payment.paid_on)}</span>
                <span className="num text-base">{naira(payment.amount)}</span>
                <span className="w-full text-xs text-foreground-faint">
                  <span className="mr-3">{payment.method}</span>
                  {payment.reference && (
                    <span className="num">{payment.reference}</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </li>
  )
}

function SpendSection({ rows }: { rows: Spend[] }) {
  if (!rows.length) return <Empty>{NO_SPEND_YET}</Empty>

  const period = rows[0].period_label
  const total = rows.reduce((sum, row) => sum + Number(row.spent), 0)
  const biggest = Math.max(...rows.map((row) => Number(row.spent)), 1)

  return (
    <div className="rounded-sm border border-subtle bg-card px-4 py-4">
      <p className="max-w-prose text-base md:text-sm">
        Across {period} the estate spent{' '}
        <span className="num">{naira(total)}</span> keeping the place running.
        This is where it went.
      </p>

      <ul className="mt-4 space-y-3">
        {rows.map((row) => (
          <li key={row.category}>
            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
              <span className="text-sm">{row.category}</span>
              <span className="text-sm text-foreground-muted">
                <span className="num">{naira(row.spent)}</span>
                <span className="num ml-3 text-foreground-faint">
                  {Number(row.share_percent)}%
                </span>
              </span>
            </div>
            {/* Share of the largest line, so the bars compare against each
                other rather than all sitting near zero. */}
            <Bar fraction={Number(row.spent) / biggest} tone="neutral" />
          </li>
        ))}
      </ul>
    </div>
  )
}

export default function MyCharges() {
  const { profile } = useAuth()

  const bills = useQuery({
    queryKey: ['my-bills', profile?.id],
    queryFn: async (): Promise<Bill[]> => {
      // Explicit resident filter; RLS is the backstop (Rule 13).
      const { data, error } = await supabase
        .from('service_bill_status')
        .select(
          'bill_id, period_id, unit_label, period_label, due_date, amount, paid, outstanding, pay_status, is_overdue, percent_paid, days_overdue',
        )
        .eq('resident_id', profile!.id)
        .order('unit_label')
      if (error) throw error
      return (data ?? []) as Bill[]
    },
    enabled: !!profile,
  })

  const payments = useQuery({
    queryKey: ['my-payments', profile?.id],
    queryFn: async (): Promise<Payment[]> => {
      const { data, error } = await supabase
        .from('service_payments')
        .select('id, bill_id, amount, paid_on, method, reference')
        .order('paid_on', { ascending: false })
      if (error) throw error
      return (data ?? []) as Payment[]
    },
    enabled: !!profile,
  })

  const spend = useQuery({
    queryKey: ['spend-breakdown', profile?.estate_id],
    queryFn: async (): Promise<Spend[]> => {
      const { data, error } = await supabase
        .from('service_spend_breakdown')
        .select('period_id, period_label, category, spent, share_percent')
        .eq('estate_id', profile!.estate_id)
        .order('spent', { ascending: false })
      if (error) throw error
      return (data ?? []) as Spend[]
    },
    enabled: !!profile,
  })

  return (
    <div className="w-full px-4 py-6 sm:px-6 xl:px-8">
      <h1 className="text-xl">Service charge</h1>
      <p className="mt-1 max-w-prose text-sm text-foreground-muted">
        What you owe, what you have paid, and what the estate spent it on.
      </p>

      <section className="mt-5">
        <h2 className="sr-only">Your bills</h2>
        {bills.isPending ? (
          <SkeletonList rows={2} />
        ) : bills.isError ? (
          <ErrorNote error={bills.error} what="We could not load your bill." />
        ) : bills.data.length === 0 ? (
          <Empty>{NO_BILLS_YET}</Empty>
        ) : (
          <ul className="space-y-3">
            {bills.data.map((bill) => (
              <BillCard
                key={bill.bill_id}
                bill={bill}
                payments={payments.data ?? []}
              />
            ))}
          </ul>
        )}
        {payments.isError && (
          <div className="mt-3">
            <ErrorNote
              error={payments.error}
              what="We could not load your payments."
            />
          </div>
        )}
      </section>

      <section className="mt-8">
        <h2 className="text-base">Where the money went</h2>
        <div className="mt-3">
          {spend.isPending ? (
            <SkeletonList rows={1} />
          ) : spend.isError ? (
            <ErrorNote
              error={spend.error}
              what="We could not load what the charge was spent on."
            />
          ) : (
            <SpendSection rows={spend.data} />
          )}
        </div>
      </section>
    </div>
  )
}
