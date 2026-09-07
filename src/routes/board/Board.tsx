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
    <span className="num text-2xl">
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
  stacked,
}: {
  label: string
  value: number
  alert?: boolean
  stacked?: boolean
}) {
  const tone = alert && value > 0 ? 'text-red' : ''

  // Stacked in the top bar, where the row scrolls sideways; in a rail there
  // is width to put the number opposite its label.
  if (stacked) {
    return (
      <div className="shrink-0">
        <span className={`num block text-lg ${tone}`}>{value}</span>
        <span className="block text-xs whitespace-nowrap text-surface/60">
          {label}
        </span>
      </div>
    )
  }

  return (
    <div className="flex items-baseline justify-between border-b border-surface/10 py-2">
      <span className="text-sm text-surface/60">{label}</span>
      <span className={`num text-lg ${tone}`}>{value}</span>
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
          alert ? 'border-red' : 'border-ink'
        }`}
      >
        <h2 className={`text-base ${alert ? 'text-red' : 'text-ink'}`}>{title}</h2>
        <span className="num text-sm text-ink-soft">{count}</span>
      </header>
      <ul className="mt-3 space-y-3">{children}</ul>
    </section>
  )
}

export default function Board() {
  const { profile, signOut } = useAuth()
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

  const counts = (
    <>
      <Count label="Past target" value={pastTarget} alert stacked={!wide} />
      <Count label="Unassigned" value={needsYouNow.length} stacked={!wide} />
      <Count label="Artisan out" value={artisanOut.length} stacked={!wide} />
      <Count label="Finished" value={finished.length} stacked={!wide} />
    </>
  )

  const signOutButton = (full: boolean) => (
    <button
      type="button"
      onClick={() => void signOut()}
      className={`shrink-0 rounded-sm border border-surface/25 px-3 py-2 text-sm text-surface/80 hover:border-surface/50 ${
        full ? 'w-full' : ''
      }`}
    >
      Sign out
    </button>
  )

  if (!wide) {
    const shown = lanes.find((l) => l.key === lane) ?? lanes[0]

    return (
      <div className="min-h-dvh bg-bg">
        <header className="bg-ink px-4 py-4 text-surface">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm text-surface/60">
                {estate.data?.name ?? ' '}
              </p>
              <h1 className="mt-0.5 truncate text-lg">{profile?.full_name}</h1>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <RailClock />
              {signOutButton(false)}
            </div>
          </div>

          {/* Four counts on a narrow screen: scroll them rather than wrap
              them into an unreadable grid. */}
          <div className="mt-3 flex gap-6 overflow-x-auto pb-1">{counts}</div>
        </header>

        <main className="p-4">
          <div className="flex rounded-sm border border-line bg-surface">
            {lanes.map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => setLane(option.key)}
                aria-pressed={option.key === lane}
                className={`grow border-b-2 px-2 py-2.5 text-sm ${
                  option.key === lane
                    ? 'border-primary text-primary'
                    : 'border-transparent text-ink-soft'
                }`}
              >
                <span className="block truncate">{option.title}</span>
                <span className="num text-xs">{option.issues.length}</span>
              </button>
            ))}
          </div>

          <div className="mt-4">
            <Lane
              title={shown.title}
              count={shown.issues.length}
              alert={shown.alert}
            >
              {shown.issues.map(render)}
            </Lane>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="flex min-h-dvh bg-bg">
      <aside className="w-60 shrink-0 bg-ink px-5 py-6 text-surface">
        <p className="text-sm text-surface/60">{estate.data?.name ?? ' '}</p>
        <h1 className="mt-1 text-lg">{profile?.full_name}</h1>

        <div className="mt-6">
          <RailClock />
        </div>

        <div className="mt-5">{counts}</div>

        <div className="mt-6">{signOutButton(true)}</div>
      </aside>

      <main className="grid grow grid-cols-3 gap-6 p-6">
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
      </main>
    </div>
  )
}
