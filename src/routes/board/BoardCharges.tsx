import { useQuery } from '@tanstack/react-query'
import { ErrorNote } from '../../components/States'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../auth/context'
import Arrears from '../charges/Arrears'
import BillList from '../charges/BillList'
import ExpenseForm from '../charges/ExpenseForm'
import Figures from '../charges/Figures'
import SpendSection from '../charges/SpendSection'
import { useBills } from '../charges/bills'

/**
 * The manager's view. Same numbers as the CEO's — they come from the same
 * hook — but this is the desk where the entry actually happens.
 */
export default function BoardCharges() {
  const { profile } = useAuth()
  const { query, all, arrears, collected, outstanding } = useBills(
    profile?.estate_id,
  )

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

  return (
    <div className="w-full px-4 py-6 sm:px-6 xl:px-8">
      <h1 className="text-xl">Service charge</h1>
      <p className="mt-1 max-w-prose text-sm text-foreground-muted">
        Record what comes in and what goes out. Open a bill to enter a payment.
      </p>

      <div className="mt-5">
        <Figures
          units={all.length}
          collected={collected}
          outstanding={outstanding}
          arrears={arrears.length}
        />
      </div>

      {query.isError && (
        <div className="mt-5">
          <ErrorNote error={query.error} what="We could not load the bills." />
        </div>
      )}

      <div className="mt-6">
        <Arrears bills={arrears} />
      </div>

      <section className="mt-6">
        <h2 className="text-base">Every bill</h2>
        <div className="mt-3">
          <BillList bills={all} pending={query.isPending} allowPayment />
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

      <section className="mt-8">
        <h2 className="text-base">Where the money went</h2>
        <div className="mt-3">
          <SpendSection estateId={profile?.estate_id} />
        </div>
      </section>
    </div>
  )
}
