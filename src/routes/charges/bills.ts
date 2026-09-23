import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import type { Tone } from '../../lib/issues'

export const BILLS_KEY = ['estate-bills']

export type Bill = {
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

/** The chip says how much came in. Being late is a separate marker. */
export function statusTone(status: Bill['pay_status']): Tone {
  if (status === 'paid') return 'success'
  if (status === 'part paid') return 'warning'
  return 'neutral'
}

export function today() {
  return new Date().toISOString().slice(0, 10)
}

/**
 * One home for the estate's bills and everything derived from them, so the
 * manager's page and the CEO's page cannot answer the same question
 * differently.
 */
export function useBills(estateId: string | undefined) {
  const query = useQuery({
    queryKey: BILLS_KEY,
    queryFn: async (): Promise<Bill[]> => {
      // Explicit estate filter; RLS is the backstop (Rule 13).
      const { data, error } = await supabase
        .from('service_bill_status')
        .select(
          'bill_id, period_id, unit_label, resident_name, resident_phone, amount, paid, outstanding, pay_status, is_overdue, days_overdue',
        )
        .eq('estate_id', estateId!)
        .order('unit_label')
      if (error) throw error
      return (data ?? []) as Bill[]
    },
    enabled: !!estateId,
    refetchInterval: 15_000,
  })

  const all = query.data ?? []

  // Arrears is is_overdue and nothing else. days_overdue is pure date
  // arithmetic — it reads 12 on a bill that was paid in full weeks ago — so
  // filtering on days_overdue > 0 would put every settled bill in arrears.
  // Only is_overdue accounts for money still owed. This lives here, once,
  // so neither page can reintroduce the trap on its own.
  const arrears = all
    .filter((bill) => bill.is_overdue)
    .sort(
      (a, b) =>
        b.days_overdue - a.days_overdue ||
        Number(b.outstanding) - Number(a.outstanding),
    )

  return {
    query,
    all,
    arrears,
    collected: all.reduce((total, bill) => total + Number(bill.paid), 0),
    outstanding: all.reduce((total, bill) => total + Number(bill.outstanding), 0),
  }
}
