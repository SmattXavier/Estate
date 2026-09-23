import { useState } from 'react'
import type { FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ErrorNote } from '../../components/States'
import { supabase } from '../../lib/supabase'
import { BILLS_KEY, today } from './bills'
import { Field, field } from './PaymentForm'

export default function ExpenseForm({ periodId }: { periodId: string | null }) {
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
