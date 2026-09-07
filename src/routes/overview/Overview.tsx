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

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="grow px-5 py-4">
      <p className="num text-2xl">{value}</p>
      <p className="mt-0.5 text-xs text-ink-soft">{label}</p>
    </div>
  )
}

export default function Overview() {
  const { profile, signOut } = useAuth()

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

  const estate = useQuery({
    queryKey: ['estate', profile?.estate_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('estates')
        .select('name')
        .eq('id', profile!.estate_id)
        .maybeSingle()
      if (error) throw error
      return data
    },
    enabled: !!profile,
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
    <main className="min-h-dvh bg-bg text-ink">
      <header className="bg-ink text-surface">
        <div className="mx-auto flex w-full max-w-5xl items-start justify-between gap-6 px-6 py-6">
          <div>
            <p className="text-sm text-surface/60">{estate.data?.name ?? ' '}</p>
            <h1 className="mt-1 text-xl">{profile?.full_name}</h1>
            <p className="mt-2 max-w-xl text-sm text-surface/70">
              Alerts appear here only when an issue passes its target with
              nobody assigned to it.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void signOut()}
            className="shrink-0 text-sm text-surface/70 underline underline-offset-4 hover:text-surface"
          >
            Sign out
          </button>
        </div>
      </header>

      <AlertPanel issues={all} />

      <div className="mx-auto w-full max-w-5xl px-6 py-6">
        <div className="flex divide-x divide-line rounded-sm border border-line bg-surface">
          <Figure label="Open issues" value={String(open)} />
          <Figure label="Past target now" value={String(pastTarget)} />
          <Figure label="Average time to assign" value={averageToAssign} />
          <Figure label="Assigned within target" value={withinTarget} />
        </div>

        {issues.isError && (
          <p
            role="alert"
            className="mt-6 rounded-sm border border-red/35 bg-red-bg px-3 py-2 text-sm text-red"
          >
            {(issues.error as Error).message}
          </p>
        )}

        <div className="mt-6">
          <IssueTable issues={all} />
        </div>
      </div>
    </main>
  )
}
