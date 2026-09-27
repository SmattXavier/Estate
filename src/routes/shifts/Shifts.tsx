import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ErrorNote, SkeletonList } from '../../components/States'
import { TONE_CHIP } from '../../lib/issues'
import { supabase } from '../../lib/supabase'
import { getPosition } from '../../lib/geo'
import { useAuth } from '../../auth/context'
import {
  shiftMinutes,
  siteState,
  spell,
  type Shift,
} from '../../lib/attendance'
import ShiftList from '../attendance/ShiftList'

const SHIFTS_KEY = ['my-shifts']

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

function Card({
  me,
  open,
}: {
  me: { full_name: string; trade: string | null } | null
  open: Shift | null
}) {
  const queryClient = useQueryClient()
  const [now, setNow] = useState(() => Date.now())
  const [noFix, setNoFix] = useState(false)

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(id)
  }, [])

  const punch = useMutation({
    mutationFn: async (direction: 'in' | 'out') => {
      // Ask, but never wait on the answer to decide anything. A refused or
      // slow fix must not stop someone starting their shift.
      const fix = await getPosition()
      const { error } = await supabase.rpc(
        direction === 'in' ? 'clock_in' : 'clock_out',
        {
          p_lat: fix?.lat ?? null,
          p_lng: fix?.lng ?? null,
          p_accuracy: fix?.accuracy ?? null,
        },
      )
      if (error) throw error
      return fix
    },
    onSuccess: async (fix) => {
      setNoFix(fix === null)
      await queryClient.invalidateQueries({ queryKey: SHIFTS_KEY })
    },
  })

  const where = open
    ? siteState(open.clock_in_on_site, open.clock_in_metres)
    : null

  return (
    <div className="rounded-sm border border-subtle bg-card px-5 py-5">
      <p className="text-base">{me?.full_name ?? ' '}</p>
      <p className="mt-0.5 text-sm text-foreground-muted">{me?.trade ?? ''}</p>

      {open ? (
        <>
          <p className="num mt-4 text-3xl">
            {spell(shiftMinutes(open, now))}
          </p>
          <p className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm text-foreground-muted">
            <span className="num">Since {clockTime(open.clock_in_at)}</span>
            {where && (
              <>
                <span
                  className={`rounded-sm border px-1.5 py-0.5 text-xs ${TONE_CHIP[where.tone]}`}
                >
                  {where.label}
                </span>
                {where.distance && (
                  <span className="num text-xs text-foreground-faint">
                    {where.distance}
                  </span>
                )}
              </>
            )}
          </p>
        </>
      ) : (
        <p className="mt-4 text-base text-foreground-muted">
          You are not on shift.
        </p>
      )}

      {/* The server owns the rules — one shift at a time, nothing to clock
          out of. Its refusal is what the person reads. */}
      {punch.isError && (
        <div className="mt-4">
          <ErrorNote error={punch.error} what="" />
        </div>
      )}

      <button
        type="button"
        onClick={() => punch.mutate(open ? 'out' : 'in')}
        disabled={punch.isPending}
        className="mt-5 min-h-14 w-full rounded-sm bg-primary px-4 text-lg font-medium text-primary-foreground hover:bg-primary-hover disabled:opacity-60"
      >
        {punch.isPending
          ? 'Saving…'
          : open
            ? 'Clock out'
            : 'Clock in'}
      </button>

      {noFix && !punch.isError && (
        <p className="mt-3 text-sm text-foreground-muted">
          Your location was not recorded. The shift is saved either way.
        </p>
      )}
    </div>
  )
}

export default function Shifts() {
  const { profile } = useAuth()

  const me = useQuery({
    queryKey: ['me-technician', profile?.id],
    queryFn: async () => {
      // technicians_self scopes this to their own row.
      const { data, error } = await supabase
        .from('technicians')
        .select('full_name, trade')
        .eq('profile_id', profile!.id)
        .maybeSingle()
      if (error) throw error
      return data
    },
    enabled: !!profile,
  })

  const shifts = useQuery({
    queryKey: SHIFTS_KEY,
    queryFn: async (): Promise<Shift[]> => {
      const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
      // Explicit estate filter; RLS scopes it to their own rows (Rule 13).
      const { data, error } = await supabase
        .from('staff_attendance')
        .select(
          'id, full_name, trade, staff_kind, clock_in_at, clock_out_at, clock_in_on_site, clock_out_on_site, clock_in_metres, minutes, on_shift',
        )
        .eq('estate_id', profile!.estate_id)
        .gte('clock_in_at', since)
        .order('clock_in_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as Shift[]
    },
    enabled: !!profile,
    refetchInterval: 15_000,
  })

  const all = shifts.data ?? []
  const open = all.find((shift) => shift.on_shift) ?? null

  return (
    <div className="w-full px-4 py-6 sm:px-6 xl:px-8">
      <h1 className="text-xl">My shifts</h1>

      {/* Stacked on a phone. From 1280px the card caps at 640px and sits
          left, with the history beside it rather than empty space
          (docs/PAGE_WIDTH.md, the form exception). */}
      <div className="mt-5 flex flex-col gap-6 xl:flex-row xl:items-start">
        <div className="w-full xl:max-w-[40rem] xl:shrink-0">
          {shifts.isPending ? (
            <SkeletonList rows={1} />
          ) : (
            <Card me={me.data ?? null} open={open} />
          )}
          {shifts.isError && (
            <div className="mt-4">
              <ErrorNote
                error={shifts.error}
                what="We could not load your shifts."
              />
            </div>
          )}
        </div>

        <section className="w-full min-w-0">
          <h2 className="text-base">Your recent shifts</h2>
          <div className="mt-3">
            <ShiftList
              shifts={all}
              pending={shifts.isPending}
              showName={false}
              empty="No shifts in the last seven days. Clock in and it will appear here."
            />
          </div>
        </section>
      </div>
    </div>
  )
}
