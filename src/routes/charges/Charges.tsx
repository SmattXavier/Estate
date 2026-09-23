import { ErrorNote } from '../../components/States'
import { useAuth } from '../../auth/context'
import Arrears from './Arrears'
import BillList from './BillList'
import Figures from './Figures'
import SpendSection from './SpendSection'
import { useBills } from './bills'

/**
 * The CEO's view: oversight only. No payment form, no expense form — the
 * manager does the entry at /board/charges. This is a design choice, not a
 * permission one: 010_charge_roles.sql still lets the CEO record either,
 * so he can correct a mistake without waiting for anyone.
 */
export default function Charges() {
  const { profile } = useAuth()
  const { query, all, arrears, collected, outstanding } = useBills(
    profile?.estate_id,
  )

  return (
    <div className="w-full px-4 py-6 sm:px-6 xl:px-8">
      <h1 className="text-xl">Service charge</h1>
      <p className="mt-1 max-w-prose text-sm text-foreground-muted">
        What has been billed, what has come in, and who is behind.
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
          <BillList
            bills={all}
            pending={query.isPending}
            allowPayment={false}
          />
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
