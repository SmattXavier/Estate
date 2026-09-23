import { useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../auth/context'
import ReportList from './ReportList'
import { ErrorNote, SkeletonList } from '../../components/States'
import type { Issue } from '../../lib/issues'

/** The list alone, as a page. */
export default function MyReports() {
  const { profile } = useAuth()
  const location = useLocation()
  const highlightId =
    (location.state as { highlight?: string } | null)?.highlight ?? null

  const issues = useQuery({
    queryKey: ['my-issues', profile?.id],
    queryFn: async (): Promise<Issue[]> => {
      // The explicit reported_by filter is the mechanism; RLS is the
      // backstop (Rule 13).
      const { data, error } = await supabase
        .from('issues')
        .select(
          'id, ref, unit_id, title, description, category, priority, status, created_at, clock_started_at, sla_due_at, escalated_at, unit:units(label)',
        )
        .eq('reported_by', profile!.id)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as unknown as Issue[]
    },
    enabled: !!profile,
    refetchInterval: 15_000,
  })

  const open = issues.data?.filter((issue) => issue.status !== 'closed').length ?? 0

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
      <h1 className="text-xl">Your reports</h1>
      <p className="mt-1 text-sm text-foreground-muted">
        <span className="num">{open}</span>
        {open === 1 ? ' report still open' : ' reports still open'}
      </p>

      <div className="mt-5">
        {issues.isPending ? (
          <SkeletonList />
        ) : issues.isError ? (
          <ErrorNote
            error={issues.error}
            what="We could not load your reports."
          />
        ) : (
          <ReportList issues={issues.data ?? []} highlightId={highlightId} />
        )}
      </div>
    </div>
  )
}
