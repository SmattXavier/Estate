import { naira } from '../../lib/money'

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 px-5 py-4">
      <p className="num text-2xl">{value}</p>
      <p className="mt-0.5 text-xs text-foreground-muted">{label}</p>
    </div>
  )
}

export default function Figures({
  units,
  collected,
  outstanding,
  arrears,
}: {
  units: number
  collected: number
  outstanding: number
  arrears: number
}) {
  // A dash rather than a confident ₦0 when there is nothing to total.
  const money = (value: number) => (units ? naira(value) : '—')

  return (
    <div className="grid grid-cols-2 divide-x divide-y divide-subtle rounded-sm border border-subtle bg-card md:grid-cols-4 md:divide-y-0">
      <Figure label="Units billed" value={units ? String(units) : '—'} />
      <Figure label="Total collected" value={money(collected)} />
      <Figure label="Total outstanding" value={money(outstanding)} />
      <Figure label="Units in arrears" value={units ? String(arrears) : '—'} />
    </div>
  )
}
