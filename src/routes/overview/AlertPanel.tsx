import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import {
  OVERVIEW_ISSUES_KEY,
  countdownLabel,
  gap,
  isEscalated,
  windowLeft,
  type BoardIssue,
} from '../../lib/issues'

function ChaseButton({ issue, now }: { issue: BoardIssue; now: number }) {
  const queryClient = useQueryClient()

  const chase = useMutation({
    mutationFn: async () => {
      // The note is optional; the server writes a sensible default and the
      // timeline row in the same transaction (Rule 12).
      const { error } = await supabase.rpc('nudge_facility_manager', {
        p_issue_id: issue.id,
      })
      if (error) throw error
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: OVERVIEW_ISSUES_KEY })
      await queryClient.invalidateQueries({
        queryKey: ['issue-updates', issue.id],
      })
    },
  })

  if (issue.nudged_at) {
    return (
      <button
        type="button"
        disabled
        className="w-full shrink-0 rounded-sm border border-destructive-on-surface/30 px-3 py-1.5 text-sm text-destructive-on-surface/60 md:w-auto"
      >
        Chased{' '}
        <span className="num">
          {gap(now - new Date(issue.nudged_at).getTime())}
        </span>{' '}
        ago
      </button>
    )
  }

  return (
    <div className="w-full shrink-0 md:w-auto md:text-right">
      <button
        type="button"
        onClick={() => chase.mutate()}
        disabled={chase.isPending}
        className="w-full rounded-sm border border-destructive-on-surface bg-destructive-on-surface px-3 py-1.5 text-sm font-medium text-destructive-surface hover:bg-transparent hover:text-destructive-on-surface disabled:opacity-60 md:w-auto"
      >
        {chase.isPending ? 'Chasing…' : 'Chase the manager'}
      </button>
      {chase.isError && (
        <p role="alert" className="mt-1 text-xs text-destructive-on-surface/85">
          {(chase.error as Error).message}
        </p>
      )}
    </div>
  )
}

/** Two lines: what it is, then what it is called and how late it is. */
function Row({ issue, now }: { issue: BoardIssue; now: number }) {
  return (
    <li className="flex flex-col gap-2 border-t border-destructive-on-surface/20 py-2 md:flex-row md:items-center md:justify-between md:gap-6">
      <div className="min-w-0">
        <p className="flex gap-3 text-xs text-destructive-on-surface/70">
          <span className="num">{issue.ref}</span>
          <span>{issue.unit?.label ?? 'Unknown unit'}</span>
          <span>{issue.priority}</span>
        </p>
        <p className="mt-0.5 flex items-baseline gap-3">
          <span className="min-w-0 truncate">{issue.title}</span>
          <span className="num shrink-0 text-sm text-destructive-on-surface/85">
            {countdownLabel(windowLeft(issue, now).remaining)} target
          </span>
        </p>
      </div>
      <ChaseButton issue={issue} now={now} />
    </li>
  )
}

/**
 * Shown only when something has actually escalated. The empty state is
 * absence — no green "all clear" box, because a panel that is always on
 * screen stops being an alert.
 */
export default function AlertPanel({ issues }: { issues: BoardIssue[] }) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(id)
  }, [])

  const alerts = issues.filter(isEscalated)
  if (alerts.length === 0) return null

  return (
    <section className="bg-destructive-surface text-destructive-on-surface shadow-e2">
      <div className="w-full px-4 py-3 sm:px-6">
        <h2 className="text-base">
          {alerts.length === 1
            ? '1 issue has passed its target with nobody assigned'
            : `${alerts.length} issues have passed their targets with nobody assigned`}
        </h2>
        <ul className="mt-1">
          {alerts.map((issue) => (
            <Row key={issue.id} issue={issue} now={now} />
          ))}
        </ul>
      </div>
    </section>
  )
}
