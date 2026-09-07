import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../auth/context'
import ReportForm from './ReportForm'
import ReportList from './ReportList'
import type { Issue, Unit } from '../../lib/issues'

type Tab = 'report' | 'reports'

export default function MyIssues() {
  const { profile, signOut } = useAuth()
  const [tab, setTab] = useState<Tab>('report')

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

  const units = useQuery({
    queryKey: ['my-units', profile?.id],
    queryFn: async (): Promise<Unit[]> => {
      const { data, error } = await supabase
        .from('units')
        .select('id, label')
        .eq('resident_id', profile!.id)
        .order('label')
      if (error) throw error
      return data ?? []
    },
    enabled: !!profile,
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

  const open = issues.data?.filter((issue) => issue.status !== 'closed').length ?? 0
  const flats = units.data ?? []
  const where = flats.length === 1 ? flats[0].label : `${flats.length} flats`

  return (
    <div className="min-h-screen bg-bg">
      {/* The hairline arrives exactly when there is background beside the
          column to read it against; below 440px it is edge to edge. */}
      <div className="mx-auto min-h-screen w-full max-w-[440px] border-line bg-surface min-[441px]:border-x">
        <header className="bg-ink px-5 py-6 text-surface">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm text-surface/60">
                {estate.data?.name ?? ' '}
              </p>
              <h1 className="mt-1 text-xl">{profile?.full_name}</h1>
              <p className="mt-0.5 text-sm text-surface/60">{where}</p>
            </div>
            <button
              type="button"
              onClick={() => void signOut()}
              className="shrink-0 rounded-sm border border-surface/25 px-2.5 py-1.5 text-sm text-surface/80 hover:border-surface/50"
            >
              Sign out
            </button>
          </div>
          <p className="num mt-4 text-sm text-surface/75">
            {open === 1 ? '1 report still open' : `${open} reports still open`}
          </p>
        </header>

        <nav className="flex border-b border-line">
          {(
            [
              ['report', 'Report a fault'],
              ['reports', 'Your reports'],
            ] as [Tab, string][]
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setTab(value)}
              className={`grow border-b-2 px-4 py-3 text-sm font-medium ${
                tab === value
                  ? 'border-primary text-primary'
                  : 'border-transparent text-ink-soft'
              }`}
            >
              {label}
            </button>
          ))}
        </nav>

        {tab === 'report' ? (
          <ReportForm onLogged={() => setTab('reports')} />
        ) : (
          <ReportList issues={issues.data ?? []} />
        )}
      </div>
    </div>
  )
}
