import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Empty, ErrorNote, SkeletonList } from '../../components/States'
import { TONE_CHIP } from '../../lib/issues'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../auth/context'
import { PASS_TONE, passState, type GateEvent, type Pass } from '../../lib/passes'
import PassForm from './PassForm'
import { NO_PASSES_YET, gateLine, passLine } from './language'

const PASSES_KEY = ['my-passes']

function Revoke({ pass }: { pass: Pass }) {
  const queryClient = useQueryClient()

  const revoke = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('revoke_visitor_pass', {
        p_pass_id: pass.id,
      })
      if (error) throw error
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: PASSES_KEY })
    },
  })

  return (
    <>
      <button
        type="button"
        onClick={() => revoke.mutate()}
        disabled={revoke.isPending}
        className="min-h-11 rounded-sm border border-subtle px-3 py-2 text-sm hover:border-destructive hover:text-destructive disabled:opacity-60"
      >
        {revoke.isPending ? 'Cancelling…' : 'Cancel this code'}
      </button>
      {revoke.isError && (
        <div className="mt-2">
          <ErrorNote error={revoke.error} what="" />
        </div>
      )}
    </>
  )
}

function PassCard({ pass, events }: { pass: Pass; events: GateEvent[] }) {
  const state = passState(pass)
  const mine = events
    .filter((event) => event.pass_id === pass.id)
    .sort((a, b) => a.recorded_at.localeCompare(b.recorded_at))

  return (
    <li className="rounded-sm border border-subtle bg-card px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <div className="min-w-0">
          <h3 className="text-base">{pass.visitor_name}</h3>
          {pass.purpose && (
            <p className="mt-0.5 text-sm text-foreground-muted">
              {pass.purpose}
            </p>
          )}
        </div>
        <span
          className={`shrink-0 rounded-sm border px-1.5 py-0.5 text-xs ${TONE_CHIP[PASS_TONE[state]]}`}
        >
          {state === 'active' ? 'Working' : state === 'used' ? 'Used' : state === 'expired' ? 'Run out' : 'Cancelled'}
        </span>
      </div>

      <p className="num mt-3 text-2xl tracking-[0.3em] select-all">
        {pass.code}
      </p>

      <p className="mt-2 max-w-prose text-base text-foreground-muted md:text-sm">
        {passLine(state, pass.valid_until)}
      </p>

      {pass.vehicle_plate && (
        <p className="mt-1 text-sm text-foreground-faint">
          Vehicle <span className="num">{pass.vehicle_plate}</span>
        </p>
      )}

      {/* Whichever of the two actually happened. The gate logs an arrival
          and a departure separately, and one without the other is normal. */}
      {mine.length > 0 && (
        <ul className="mt-3 border-t border-subtle pt-3">
          {mine.map((event) => (
            <li key={event.id} className="text-sm text-foreground-muted">
              {gateLine(pass.visitor_name, event.direction, event.recorded_at)}
            </li>
          ))}
        </ul>
      )}

      {state === 'active' && (
        <div className="mt-4">
          <Revoke pass={pass} />
        </div>
      )}
    </li>
  )
}

export default function Visitors() {
  const { profile } = useAuth()

  const passes = useQuery({
    queryKey: PASSES_KEY,
    queryFn: async (): Promise<Pass[]> => {
      // Explicit creator filter; RLS is the backstop (Rule 13).
      const { data, error } = await supabase
        .from('visitor_passes')
        .select(
          'id, code, unit_id, visitor_name, visitor_phone, purpose, vehicle_plate, valid_from, valid_until, status, created_at',
        )
        .eq('created_by', profile!.id)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as Pass[]
    },
    enabled: !!profile,
  })

  const events = useQuery({
    queryKey: ['my-gate-events', profile?.id],
    queryFn: async (): Promise<GateEvent[]> => {
      const { data, error } = await supabase
        .from('gate_events')
        .select('id, pass_id, direction, recorded_at, recorded_name, lat')
        .order('recorded_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as GateEvent[]
    },
    enabled: !!profile,
  })

  return (
    <div className="w-full px-4 py-6 sm:px-6 xl:px-8">
      <h1 className="text-xl">Visitors</h1>
      <p className="mt-1 max-w-prose text-sm text-foreground-muted">
        Make a code for someone coming to see you, and send it to them. They
        give it at the gate.
      </p>

      <section className="mt-5">
        <h2 className="sr-only">Make a code</h2>
        <PassForm />
      </section>

      <section className="mt-8">
        <h2 className="text-base">Codes you have made</h2>
        <div className="mt-3">
          {passes.isPending ? (
            <SkeletonList rows={2} />
          ) : passes.isError ? (
            <ErrorNote
              error={passes.error}
              what="We could not load your codes."
            />
          ) : passes.data.length === 0 ? (
            <Empty>{NO_PASSES_YET}</Empty>
          ) : (
            <ul className="space-y-3">
              {passes.data.map((pass) => (
                <PassCard
                  key={pass.id}
                  pass={pass}
                  events={events.data ?? []}
                />
              ))}
            </ul>
          )}
          {events.isError && (
            <div className="mt-3">
              <ErrorNote
                error={events.error}
                what="We could not load who has come and gone."
              />
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
