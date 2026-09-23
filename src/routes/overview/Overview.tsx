import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../../auth/context'
import { supabase } from '../../lib/supabase'
import {
  BOARD_SELECT,
  OVERVIEW_ISSUES_KEY,
  assignedWithinTarget,
  isEscalated,
  minutesToAssign,
  type BoardIssue,
} from '../../lib/issues'
import AlertPanel from './AlertPanel'
import IssueTable from './IssueTable'
import { ErrorNote, SkeletonList } from '../../components/States'

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 px-5 py-4">
      <p className="num text-2xl">{value}</p>
      <p className="mt-0.5 text-xs text-foreground-muted">{label}</p>
    </div>
  )
}

export default function Overview() {
  const { profile } = useAuth()

  const issues = useQuery({
    queryKey: OVERVIEW_ISSUES_KEY,
    queryFn: async (): Promise<BoardIssue[]> => {
      // Explicit estate filter; RLS is the backstop (Rule 13).
      const { data, error } = await supabase
        .from('issues')
        .select(BOARD_SELECT)
        .eq('estate_id', profile!.estate_id)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as unknown as BoardIssue[]
    },
    enabled: !!profile,
    refetchInterval: 15_000,
  })

  const all = issues.data ?? []

  const open = all.filter(
    (issue) => issue.status === 'submitted' || issue.status === 'assigned',
  ).length

  // The same predicate the alert panel filters on, so this figure and that
  // list can never disagree. Server stamp only, never the browser clock
  // (Rule 14).
  const pastTarget = all.filter(isEscalated).length

  // Both averages share one denominator: issues that have actually been
  // assigned. Resolved and closed ones count — dropping them would make the
  // average improve every time work finished.
  const assigned = all.filter((issue) => issue.assigned_at !== null)
  const averageToAssign = assigned.length
    ? `${Math.round(
        assigned.reduce((total, issue) => total + (minutesToAssign(issue) ?? 0), 0) /
          assigned.length,
      )} min`
    : '—'
  const withinTarget = assigned.length
    ? `${Math.round(
        (assigned.filter((issue) => assignedWithinTarget(issue)).length /
          assigned.length) *
          100,
      )}%`
    : '—'

  return (
    <div>
      <div className="w-full px-4 pt-6 sm:px-6 xl:px-8">
        <h1 className="text-xl">Overview</h1>
        <p className="mt-1 max-w-xl text-sm text-foreground-muted">
          Alerts appear here only when an issue passes its target with nobody
          assigned to it.
        </p>
      </div>

      <div className="mt-5">
        <AlertPanel issues={all} />
      </div>

      <div className="w-full px-4 py-5 sm:px-6 xl:px-8">
        <div className="grid grid-cols-2 divide-x divide-y divide-subtle rounded-sm border border-subtle bg-card md:grid-cols-4 md:divide-y-0">
          <Figure label="Open issues" value={String(open)} />
          <Figure label="Past target now" value={String(pastTarget)} />
          <Figure label="Average time to assign" value={averageToAssign} />
          <Figure label="Assigned within target" value={withinTarget} />
        </div>

        {issues.isError && (
          <div className="mt-6">
            <ErrorNote
              error={issues.error}
              what="We could not load the estate's issues."
            />
          </div>
        )}

        <div className="mt-6">
          {issues.isPending ? (
            <SkeletonList rows={4} />
          ) : (
            <IssueTable issues={all} />
          )}
        </div>
      </div>
    </div>
  )
}
