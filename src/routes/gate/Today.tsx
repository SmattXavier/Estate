import { useQuery } from '@tanstack/react-query'
import { Empty, ErrorNote, SkeletonList } from '../../components/States'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../auth/context'

type Event = {
  id: string
  direction: 'in' | 'out'
  recorded_at: string
  recorded_name: string
  lat: number | string | null
  pass: {
    code: string
    visitor_name: string
    unit: { label: string } | null
  } | null
}

function clockTime(iso: string): string {
  return new Date(iso)
    .toLocaleTimeString('en-NG', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: 'Africa/Lagos',
    })
    .replace(/\s?([AP]M)/i, (_, m: string) => m.toLowerCase())
}

export default function Today() {
  const { profile } = useAuth()

  const events = useQuery({
    queryKey: ['gate-today', profile?.estate_id],
    queryFn: async (): Promise<Event[]> => {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      // Explicit estate filter; RLS is the backstop (Rule 13).
      const { data, error } = await supabase
        .from('gate_events')
        .select(
          'id, direction, recorded_at, recorded_name, lat, pass:visitor_passes(code, visitor_name, unit:units(label))',
        )
        .eq('estate_id', profile!.estate_id)
        .gte('recorded_at', since)
        .order('recorded_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as unknown as Event[]
    },
    enabled: !!profile,
    refetchInterval: 15_000,
  })

  return (
    <div className="mx-auto w-full max-w-[35rem] px-4 py-6 sm:px-6">
      <h1 className="text-xl">Today</h1>
      <p className="mt-1 text-sm text-foreground-muted">
        Everyone in and out of the gate in the last 24 hours.
      </p>

      <div className="mt-5">
        {events.isPending ? (
          <SkeletonList rows={3} />
        ) : events.isError ? (
          <ErrorNote
            error={events.error}
            what="We could not load the gate log."
          />
        ) : events.data.length === 0 ? (
          <Empty>
            Nobody has come through the gate today. Every arrival and
            departure you log appears here.
          </Empty>
        ) : (
          <ul className="space-y-2.5">
            {events.data.map((event) => (
              <li
                key={event.id}
                className={`rounded-sm border border-subtle border-l-4 bg-card px-4 py-3 ${
                  event.direction === 'in'
                    ? 'border-l-success'
                    : 'border-l-strong'
                }`}
              >
                <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <span className="text-base">
                    {event.pass?.visitor_name ?? 'Unknown visitor'}
                  </span>
                  <span className="num text-sm text-foreground-muted">
                    {clockTime(event.recorded_at)}
                  </span>
                </div>

                <p className="mt-0.5 flex flex-wrap gap-x-3 text-sm text-foreground-muted">
                  <span>{event.direction === 'in' ? 'Came in' : 'Left'}</span>
                  {/* Needs migration 011 (units_security); until then the
                      embed comes back null and this reads as a dash. */}
                  <span>{event.pass?.unit?.label ?? '—'}</span>
                  {event.pass?.code && (
                    <span className="num">{event.pass.code}</span>
                  )}
                </p>

                <p className="mt-1 flex flex-wrap gap-x-3 text-xs text-foreground-faint">
                  <span>Logged by {event.recorded_name}</span>
                  <span>
                    {event.lat === null
                      ? 'No location recorded'
                      : 'Location recorded'}
                  </span>
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
