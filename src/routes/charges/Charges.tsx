import { Fragment, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Empty, ErrorNote, SkeletonList } from '../../components/States'
import { supabase } from '../../lib/supabase'
import { naira } from '../../lib/money'
import { useMediaQuery } from '../../lib/useMediaQuery'
import { useAuth } from '../../auth/context'
import { TONE_CHIP, type Tone } from '../../lib/issues'

const BILLS_KEY = ['estate-bills']

type Bill = {
  bill_id: string
  period_id: string
  unit_label: string
  resident_name: string | null
  resident_phone: string | null
  amount: number | string
  paid: number | string
  outstanding: number | string
  pay_status: 'paid' | 'part paid' | 'unpaid'
  is_overdue: boolean
  days_overdue: number
}

const METHODS = ['Bank transfer', 'Cash', 'Cheque', 'POS']

// text-base, not inherited 15px: a form page keeps the 16px floor at every
// width, not only on a phone. min-h-11 keeps the control a 44px target too.
const field =
  'mt-1.5 min-h-11 w-full rounded-sm border border-subtle bg-card px-3 py-2.5 text-base outline-none focus:border-primary'

/** The chip says how much came in. Being late is a separate marker. */
function statusTone(status: Bill['pay_status']): Tone {
  if (status === 'paid') return 'success'
  if (status === 'part paid') return 'warning'
  return 'neutral'
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

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

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-medium">{label}</span>
      {children}
    </label>
  )
}

function PaymentForm({ bill }: { bill: Bill }) {
  const queryClient = useQueryClient()
  const [amount, setAmount] = useState('')
  const [paidOn, setPaidOn] = useState(today())
  const [method, setMethod] = useState(METHODS[0])
  const [reference, setReference] = useState('')

  const record = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('record_payment', {
        p_bill_id: bill.bill_id,
        p_amount: Number(amount),
        p_paid_on: paidOn,
        p_method: method,
        p_reference: reference,
      })
      if (error) throw error
    },
    onSuccess: async () => {
      setAmount('')
      setReference('')
      await queryClient.invalidateQueries({ queryKey: BILLS_KEY })
    },
  })

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    record.mutate()
  }

  return (
    <form onSubmit={onSubmit} className="mt-3 border-t border-subtle pt-3">
      <p className="text-sm font-medium">Record a payment</p>
      <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Amount">
          <input
            type="number"
            min="1"
            step="1"
            required
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className={`num ${field}`}
          />
        </Field>
        <Field label="Date paid">
          <input
            type="date"
            required
            value={paidOn}
            onChange={(e) => setPaidOn(e.target.value)}
            className={`num ${field}`}
          />
        </Field>
        <Field label="Method">
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value)}
            className={field}
          >
            {METHODS.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </Field>
        <Field label="Reference">
          <input
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            className={field}
          />
        </Field>
      </div>

      {/* The server owns the arithmetic. Pre-empting it client-side would
          give two answers that can disagree, so we submit and say what it
          said — including "that would overpay the bill by …". */}
      {record.isError && (
        <div className="mt-3">
          <ErrorNote error={record.error} what="" />
        </div>
      )}

      <button
        type="submit"
        disabled={record.isPending || !Number(amount)}
        className="mt-3 min-h-11 rounded-sm bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary-hover disabled:opacity-60"
      >
        {record.isPending ? 'Recording…' : 'Record payment'}
      </button>
    </form>
  )
}

function ExpenseForm({ periodId }: { periodId: string | null }) {
  const queryClient = useQueryClient()
  const [category, setCategory] = useState('')
  const [amount, setAmount] = useState('')
  const [spentOn, setSpentOn] = useState(today())
  const [description, setDescription] = useState('')

  // Fetched, never hardcoded: the server rejects anything outside this list.
  const categories = useQuery({
    queryKey: ['expense-categories'],
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase.rpc('expense_categories')
      if (error) throw error
      return (data ?? []) as string[]
    },
  })

  const chosen = category || categories.data?.[0] || ''

  const record = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('record_expense', {
        p_period_id: periodId,
        p_category: chosen,
        p_amount: Number(amount),
        p_spent_on: spentOn,
        p_description: description,
      })
      if (error) throw error
    },
    onSuccess: async () => {
      setAmount('')
      setDescription('')
      await queryClient.invalidateQueries({ queryKey: ['spend-breakdown'] })
      await queryClient.invalidateQueries({ queryKey: BILLS_KEY })
    },
  })

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    record.mutate()
  }

  return (
    <form
      onSubmit={onSubmit}
      className="rounded-sm border border-subtle bg-card px-4 py-4"
    >
      {categories.isError && (
        <div className="mb-3">
          <ErrorNote
            error={categories.error}
            what="We could not load the expense categories."
          />
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Category">
          <select
            value={chosen}
            onChange={(e) => setCategory(e.target.value)}
            disabled={categories.isPending}
            className={field}
          >
            {(categories.data ?? []).map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </Field>
        <Field label="Amount">
          <input
            type="number"
            min="1"
            step="1"
            required
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className={`num ${field}`}
          />
        </Field>
        <Field label="Date spent">
          <input
            type="date"
            required
            value={spentOn}
            onChange={(e) => setSpentOn(e.target.value)}
            className={`num ${field}`}
          />
        </Field>
        <Field label="Description">
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className={field}
          />
        </Field>
      </div>

      {record.isError && (
        <div className="mt-3">
          <ErrorNote error={record.error} what="" />
        </div>
      )}

      <button
        type="submit"
        disabled={record.isPending || !Number(amount) || !periodId || !chosen}
        className="mt-3 min-h-11 rounded-sm bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary-hover disabled:opacity-60"
      >
        {record.isPending ? 'Recording…' : 'Record expense'}
      </button>
    </form>
  )
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 px-5 py-4">
      <p className="num text-2xl">{value}</p>
      <p className="mt-0.5 text-xs text-foreground-muted">{label}</p>
    </div>
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

export default function Charges() {
  const { profile } = useAuth()
  const wide = useMediaQuery('(min-width: 768px)')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const bills = useQuery({
    queryKey: BILLS_KEY,
    queryFn: async (): Promise<Bill[]> => {
      // Explicit estate filter; RLS is the backstop (Rule 13).
      const { data, error } = await supabase
        .from('service_bill_status')
        .select(
          'bill_id, period_id, unit_label, resident_name, resident_phone, amount, paid, outstanding, pay_status, is_overdue, days_overdue',
        )
        .eq('estate_id', profile!.estate_id)
        .order('unit_label')
      if (error) throw error
      return (data ?? []) as Bill[]
    },
    enabled: !!profile,
    refetchInterval: 15_000,
  })

  const periods = useQuery({
    queryKey: ['service-periods', profile?.estate_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('service_periods')
        .select('id, label')
        .eq('estate_id', profile!.estate_id)
        .order('service_start', { ascending: false })
      if (error) throw error
      return data ?? []
    },
    enabled: !!profile,
  })

  const all = bills.data ?? []
  const money = (n: number) => (all.length ? naira(n) : '—')
  const collected = all.reduce((t, b) => t + Number(b.paid), 0)
  const outstanding = all.reduce((t, b) => t + Number(b.outstanding), 0)

  // Arrears is is_overdue and nothing else. days_overdue is pure date
  // arithmetic — it reads 12 on a bill that was paid in full weeks ago —
  // so filtering on days_overdue > 0 would put every settled bill in
  // arrears. Only is_overdue accounts for money still owed.
  const arrears = all
    .filter((b) => b.is_overdue)
    .sort(
      (a, b) =>
        b.days_overdue - a.days_overdue ||
        Number(b.outstanding) - Number(a.outstanding),
    )

  const toggle = (id: string) => setExpandedId(expandedId === id ? null : id)

  function expandedBody(bill: Bill) {
    return (
      <>
        <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-foreground-faint">
          <span>{bill.resident_name ?? 'No resident on file'}</span>
          {bill.resident_phone && (
            <span className="num">{bill.resident_phone}</span>
          )}
        </p>
        {Number(bill.outstanding) > 0 ? (
          <PaymentForm bill={bill} />
        ) : (
          <p className="mt-3 border-t border-subtle pt-3 text-sm text-foreground-muted">
            Nothing outstanding on this bill.
          </p>
        )}
      </>
    )
  }

  return (
    <div className="w-full px-4 py-6 sm:px-6 xl:px-8">
      <h1 className="text-xl">Service charge</h1>
      <p className="mt-1 max-w-prose text-sm text-foreground-muted">
        What has been billed, what has come in, and who is behind.
      </p>

      <div className="mt-5 grid grid-cols-2 divide-x divide-y divide-subtle rounded-sm border border-subtle bg-card md:grid-cols-4 md:divide-y-0">
        <Figure label="Units billed" value={all.length ? String(all.length) : '—'} />
        <Figure label="Total collected" value={money(collected)} />
        <Figure label="Total outstanding" value={money(outstanding)} />
        <Figure
          label="Units in arrears"
          value={all.length ? String(arrears.length) : '—'}
        />
      </div>

      {bills.isError && (
        <div className="mt-5">
          <ErrorNote error={bills.error} what="We could not load the bills." />
        </div>
      )}

      {/* Absent when nobody is behind — a standing condition, not a live
          alert, so no full-bleed band. */}
      {arrears.length > 0 && (
        <section className="mt-6 rounded-sm border border-destructive/35 bg-card">
          <h2 className="border-b border-destructive/25 px-4 py-3 text-base text-destructive">
            {arrears.length === 1
              ? '1 unit in arrears'
              : `${arrears.length} units in arrears`}
          </h2>
          <ul>
            {arrears.map((bill) => (
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
      )}

      <section className="mt-6">
        <h2 className="text-base">Every bill</h2>
        <div className="mt-3">
          {bills.isPending ? (
            <SkeletonList rows={4} />
          ) : all.length === 0 ? (
            <Empty>
              No bills yet. Once a service charge period is issued, every unit
              on the estate appears here with what it owes.
            </Empty>
          ) : wide ? (
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
                  {all.map((bill) => {
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
                              {expandedBody(bill)}
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <ul className="space-y-3">
              {all.map((bill) => {
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
                        {expandedBody(bill)}
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-base">Record an expense</h2>
        <p className="mt-1 max-w-prose text-sm text-foreground-muted">
          {periods.data?.[0]
            ? `Against ${periods.data[0].label}. Residents see this on their own charge page.`
            : 'No service charge period exists yet.'}
        </p>
        <div className="mt-3">
          <ExpenseForm periodId={periods.data?.[0]?.id ?? null} />
        </div>
      </section>
    </div>
  )
}
