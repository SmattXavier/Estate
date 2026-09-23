import { useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ErrorNote } from '../../components/States'
import { supabase } from '../../lib/supabase'
import { BILLS_KEY, today, type Bill } from './bills'

const METHODS = ['Bank transfer', 'Cash', 'Cheque', 'POS']

// text-base, not inherited 15px: a form page keeps the 16px floor at every
// width, not only on a phone. min-h-11 keeps the control a 44px target too.
export const field =
  'mt-1.5 min-h-11 w-full rounded-sm border border-subtle bg-card px-3 py-2.5 text-base outline-none focus:border-primary'

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-medium">{label}</span>
      {children}
    </label>
  )
}

export default function PaymentForm({ bill }: { bill: Bill }) {
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
