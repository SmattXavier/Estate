import { useQuery } from '@tanstack/react-query'
import Bar from '../../components/Bar'
import { Empty, ErrorNote, SkeletonList } from '../../components/States'
import { supabase } from '../../lib/supabase'
import { naira } from '../../lib/money'

type Spend = {
  period_id: string
  period_label: string
  category: string
  spent: number | string
  share_percent: number | string
}

const NOTHING_YET =
  'Nothing has been recorded against the charge yet. Once it is, every category shows here with its share.'

/**
 * Where the money went. On all three screens: the resident asking what the
 * charge bought, the manager entering it, and the CEO answering for it.
 */
export default function SpendSection({
  estateId,
}: {
  estateId: string | undefined
}) {
  const spend = useQuery({
    queryKey: ['spend-breakdown', estateId],
    queryFn: async (): Promise<Spend[]> => {
      const { data, error } = await supabase
        .from('service_spend_breakdown')
        .select('period_id, period_label, category, spent, share_percent')
        .eq('estate_id', estateId!)
        .order('spent', { ascending: false })
      if (error) throw error
      return (data ?? []) as Spend[]
    },
    enabled: !!estateId,
  })

  if (spend.isPending) return <SkeletonList rows={1} />
  if (spend.isError) {
    return (
      <ErrorNote
        error={spend.error}
        what="We could not load what the charge was spent on."
      />
    )
  }

  const rows = spend.data
  if (!rows.length) return <Empty>{NOTHING_YET}</Empty>

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
