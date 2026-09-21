import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../auth/context'
import { useMediaQuery } from '../../lib/useMediaQuery'
import IssueCard, { type Dispatch } from './IssueCard'
import {
  BOARD_ISSUES_KEY,
  BOARD_SELECT,
  isPastTarget,
  type BoardIssue,
} from '../../lib/issues'

function RailClock() {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(id)
  }, [])

  return (
    <span className="num text-lg">
      {new Date(now).toLocaleTimeString('en-NG', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: 'Africa/Lagos',
      })}
    </span>
  )
}

function Count({
  label,
  value,
  alert,
}: {
  label: string
  value: number
  alert?: boolean
}) {
  return (
    <div className="shrink-0">
      <span
        className={`num block text-lg ${alert && value > 0 ? 'text-destructive' : ''}`}
      >
        {value}
      </span>
      <span className="block text-xs whitespace-nowrap text-foreground-muted">
        {label}
      </span>
    </div>
  )
}

type LaneKey = 'needs' | 'out' | 'finished'

function Lane({
  title,
  count,
  alert,
  children,
}: {
  title: string
  count: number
  alert?: boolean
  children: ReactNode
}) {
  return (
    <section className="min-w-0">
      <header
        className={`flex items-baseline justify-between border-b-2 pb-2 ${
          alert ? 'border-destructive' : 'border-foreground'
        }`}
      >
        <h2 className={`text-base ${alert ? 'text-destructive' : 'text-foreground'}`}>{title}</h2>
        <span className="num text-sm text-foreground-muted">{count}</span>
      </header>
      <ul className="mt-3 space-y-3">{children}</ul>
    </section>
  )
}

export default function Board() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [params, setParams] = useSearchParams()
  const expandedId = params.get('issue')

  // The pick handed back by the directory. The expanded issue lives in the
  // URL so it survives a refresh; the draft reply deliberately does not.
  const draft = (location.state as { dispatch?: Dispatch } | null)?.dispatch

  // Below this the three lanes stack into one, chosen by the segmented
  // control; the rail becomes a top bar.
  const wide = useMediaQuery('(min-width: 900px)')
  const [lane, setLane] = useState<LaneKey>('needs')

  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(id)
  }, [])

  const issues = useQuery({
    queryKey: BOARD_ISSUES_KEY,
    queryFn: async (): Promise<BoardIssue[]> => {
      // Explicit estate filter; RLS is the backstop (Rule 13).
      const { data, error } = await supabase
        .from('issues')
        .select(BOARD_SELECT)
        .eq('estate_id', profile!.estate_id)
      if (error) throw error
      return (data ?? []) as unknown as BoardIssue[]
    },
    enabled: !!profile,
    refetchInterval: 15_000,
  })

  const all = issues.data ?? []
  const by = (time: string | null) => (time ? new Date(time).getTime() : 0)

  const needsYouNow = all
    .filter((issue) => issue.status === 'submitted')
    .sort((a, b) => by(a.sla_due_at) - by(b.sla_due_at))

  const artisanOut = all
    .filter((issue) => issue.status === 'assigned')
    .sort((a, b) => by(b.assigned_at) - by(a.assigned_at))

  const finished = all
    .filter((issue) => issue.status === 'resolved' || issue.status === 'closed')
    .sort((a, b) => by(b.resolved_at) - by(a.resolved_at))

  // Live display against sla_due_at, so the rule turns red the moment a
  // target passes rather than waiting on the next sweep. Whether an issue is
  // *escalated* is still escalated_at, and only the chip reads that.
  const pastTarget = all.filter((issue) => isPastTarget(issue, now)).length

  function toggle(id: string) {
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous)
        if (next.get('issue') === id) next.delete('issue')
        else next.set('issue', id)
        return next
      },
      { replace: true, state: location.state },
    )
  }

  function clearDraft() {
    navigate(`/board?issue=${expandedId ?? ''}`, { replace: true })
  }

  function render(issue: BoardIssue) {
    return (
      <IssueCard
        key={issue.id}
        issue={issue}
        expanded={expandedId === issue.id}
        onToggle={() => toggle(issue.id)}
        draft={expandedId === issue.id ? draft : undefined}
        onDispatched={clearDraft}
      />
    )
  }

  const lanes = [
    {
      key: 'needs' as const,
      title: 'Needs you now',
      issues: needsYouNow,
      alert: pastTarget > 0,
    },
    { key: 'out' as const, title: 'Artisan out', issues: artisanOut },
    { key: 'finished' as const, title: 'Finished', issues: finished },
  ]

  // The rail's live counts, now a strip at the top of the board content.
  const summary = (
    <div className="flex gap-6 overflow-x-auto rounded-sm border border-subtle bg-card px-4 py-3">
      <Count label="Past target" value={pastTarget} alert />
      <Count label="Unassigned" value={needsYouNow.length} />
      <Count label="Artisan out" value={artisanOut.length} />
      <Count label="Finished" value={finished.length} />
      <div className="ml-auto shrink-0 self-center">
        <RailClock />
      </div>
    </div>
  )

  if (!wide) {
    const shown = lanes.find((l) => l.key === lane) ?? lanes[0]

    return (
      <div className="p-4">
        {summary}

        <div className="mt-4 flex rounded-sm border border-subtle bg-card">
          {lanes.map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => setLane(option.key)}
              aria-pressed={option.key === lane}
              className={`grow border-b-2 px-2 py-2.5 text-sm ${
                option.key === lane
                  ? 'border-primary text-primary'
                  : 'border-transparent text-foreground-muted'
              }`}
            >
              <span className="block truncate">{option.title}</span>
              <span className="num text-xs">{option.issues.length}</span>
            </button>
          ))}
        </div>

        <div className="mt-4">
          <Lane title={shown.title} count={shown.issues.length} alert={shown.alert}>
            {shown.issues.map(render)}
          </Lane>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      {summary}

      <div className="mt-6 grid grid-cols-3 gap-6">
        {lanes.map((option) => (
          <Lane
            key={option.key}
            title={option.title}
            count={option.issues.length}
            alert={option.alert}
          >
            {option.issues.map(render)}
          </Lane>
        ))}
      </div>
    </div>
  )
}
