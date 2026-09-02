import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../auth/context'
import { BOARD_SELECT, type BoardIssue } from '../../lib/issues'

type Technician = {
  id: string
  full_name: string
  trade: string
  phone: string
  engagement: string
  on_books_since: string | null
}

function onBooks(since: string | null): string {
  const year = Number(since)
  if (!since || Number.isNaN(year)) return 'On the books'
  const years = new Date().getFullYear() - year
  if (years <= 0) return 'On the books since this year'
  return `${years} year${years === 1 ? '' : 's'} on the books`
}

export default function ArtisanDirectory() {
  const { issueId } = useParams()
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [trade, setTrade] = useState<string | null>(null)

  const issue = useQuery({
    queryKey: ['board-issue', issueId],
    queryFn: async (): Promise<BoardIssue | null> => {
      const { data, error } = await supabase
        .from('issues')
        .select(BOARD_SELECT)
        .eq('estate_id', profile!.estate_id)
        .eq('id', issueId!)
        .maybeSingle()
      if (error) throw error
      return data as unknown as BoardIssue | null
    },
    enabled: !!profile && !!issueId,
  })

  const technicians = useQuery({
    queryKey: ['technicians', profile?.estate_id],
    queryFn: async (): Promise<Technician[]> => {
      // Explicit estate filter (Rule 13). Inactive artisans are left out
      // because assign_technician refuses them.
      const { data, error } = await supabase
        .from('technicians')
        .select('id, full_name, trade, phone, engagement, on_books_since')
        .eq('estate_id', profile!.estate_id)
        .eq('active', true)
        .order('full_name')
      if (error) throw error
      return data ?? []
    },
    enabled: !!profile,
    refetchInterval: 15_000,
  })

  // One read for every artisan's workload, tallied here.
  const load = useQuery({
    queryKey: ['artisan-load', profile?.estate_id],
    queryFn: async (): Promise<Record<string, number>> => {
      const { data, error } = await supabase
        .from('issues')
        .select('assigned_technician_id')
        .eq('estate_id', profile!.estate_id)
        .in('status', ['submitted', 'assigned'])
        .not('assigned_technician_id', 'is', null)
      if (error) throw error
      const tally: Record<string, number> = {}
      for (const row of data ?? []) {
        const id = row.assigned_technician_id as string
        tally[id] = (tally[id] ?? 0) + 1
      }
      return tally
    },
    enabled: !!profile,
    refetchInterval: 15_000,
  })

  const back = `/board?issue=${issueId}`
  const all = technicians.data ?? []
  const trades = [...new Set(all.map((one) => one.trade))].sort()
  // Pre-set to the issue's category until the manager picks otherwise.
  const active = trade ?? issue.data?.category ?? 'All'
  const shown = active === 'All' ? all : all.filter((one) => one.trade === active)

  function choose(technician: Technician) {
    navigate(back, {
      state: {
        dispatch: {
          technicianId: technician.id,
          reply: `${technician.full_name} (${technician.trade}) is on the way. You can reach him on ${technician.phone}.`,
        },
      },
    })
  }

  return (
    <div className="min-h-dvh bg-bg">
      <header className="bg-ink px-6 py-4 text-surface">
        <div className="flex items-center justify-between gap-6">
          <div className="min-w-0">
            <p className="flex gap-3 text-xs text-surface/60">
              <span className="num">{issue.data?.ref ?? ''}</span>
              <span>{issue.data?.unit?.label ?? ''}</span>
            </p>
            <h1 className="mt-0.5 truncate text-lg">
              {issue.data?.title ?? 'Choose an artisan'}
            </h1>
          </div>
          <button
            type="button"
            onClick={() => navigate(back)}
            className="shrink-0 rounded-sm border border-surface/25 px-3 py-2 text-sm text-surface/80 hover:border-surface/50"
          >
            Back to the issue
          </button>
        </div>
      </header>

      <main className="p-6">
        <div className="flex flex-wrap gap-2">
          {['All', ...trades].map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setTrade(option)}
              className={`rounded-sm border px-3 py-1.5 text-sm ${
                option === active
                  ? 'border-primary bg-sunk text-primary'
                  : 'border-line bg-surface text-ink-soft hover:border-line-strong'
              }`}
            >
              {option}
            </button>
          ))}
        </div>

        <ul className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map((technician) => {
            const open = load.data?.[technician.id] ?? 0
            const stretched = open >= 2
            return (
              <li
                key={technician.id}
                className="rounded-sm border border-line bg-surface p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-base">{technician.full_name}</h2>
                    <p className="text-sm text-ink-soft">{technician.trade}</p>
                  </div>
                  <span
                    className={`num shrink-0 rounded-sm border px-1.5 py-0.5 text-xs ${
                      stretched
                        ? 'border-amber/35 bg-amber-bg text-amber'
                        : 'border-line bg-sunk text-ink-soft'
                    }`}
                  >
                    {open === 1 ? '1 open job' : `${open} open jobs`}
                    {stretched ? ', stretched' : ''}
                  </span>
                </div>

                <dl className="mt-3 space-y-1 text-sm text-ink-soft">
                  <div className="flex justify-between gap-3">
                    <dt>Phone</dt>
                    <dd className="num text-ink">{technician.phone}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt>Engagement</dt>
                    <dd className="text-ink">{technician.engagement}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt>Experience</dt>
                    <dd className="text-ink">{onBooks(technician.on_books_since)}</dd>
                  </div>
                </dl>

                <button
                  type="button"
                  onClick={() => choose(technician)}
                  className="mt-4 w-full rounded-sm bg-primary px-4 py-2.5 text-sm font-medium text-surface hover:bg-primary-dark"
                >
                  Send {technician.full_name.split(' ')[0]}
                </button>
              </li>
            )
          })}
        </ul>

        {!shown.length && (
          <p className="mt-6 text-sm text-ink-soft">
            No active artisan on the books for {active}.
          </p>
        )}
      </main>
    </div>
  )
}
