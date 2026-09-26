import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ErrorNote } from '../../components/States'
import { TONE_CHIP } from '../../lib/issues'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../auth/context'
import {
  shiftMinutes,
  siteState,
  spell,
  type Shift,
} from '../../lib/attendance'
import ShiftList from '../attendance/ShiftList'

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 px-5 py-4">
      <p className="num text-2xl">{value}</p>
      <p className="mt-0.5 text-xs text-foreground-muted">{label}</p>
    </div>
  )
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

function OnNow({ shifts }: { shifts: Shift[] }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(id)
  }, [])

  // Absent when nobody is on, rather than an empty box.
  if (shifts.length === 0) return null

  return (
    <section>
      <h2 className="text-base">On now</h2>
      <ul className="mt-3 space-y-2.5">
        {shifts.map((shift) => {
          const where = siteState(shift.clock_in_on_site, shift.clock_in_metres)
          return (
            <li
              key={shift.id}
              className="rounded-sm border border-subtle border-l-4 border-l-success bg-card px-4 py-3"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <span className="text-base">{shift.full_name}</span>
                <span className="num text-sm">
                  {spell(shiftMinutes(shift, now))} so far
                </span>
              </div>
              <p className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm text-foreground-muted">
                <span>{shift.trade ?? shift.staff_kind}</span>
                <span className="num">
                  since {clockTime(shift.clock_in_at)}
                </span>
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
              </p>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

export default function Attendance() {
  const { profile } = useAuth()

  const shifts = useQuery({
    queryKey: ['attendance', profile?.estate_id],
    queryFn: async (): Promise<Shift[]> => {
      const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
      // Explicit estate filter; RLS is the backstop (Rule 13).
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
  const onNow = all.filter((shift) => shift.on_shift)
  // Off site and not recorded both count here: the manager wants to know
  // which clock-ins carry no proof, whatever the reason.
  const unproven = all.filter((shift) => shift.clock_in_on_site !== true)

  return (
    <div className="w-full px-4 py-6 sm:px-6 xl:px-8">
      <h1 className="text-xl">Attendance</h1>
      <p className="mt-1 max-w-prose text-sm text-foreground-muted">
        Who is on, who has been on, and where they were when they clocked in.
      </p>

      <div className="mt-5 grid grid-cols-2 divide-x divide-y divide-subtle rounded-sm border border-subtle bg-card md:grid-cols-3 md:divide-y-0">
        <Figure label="On shift now" value={String(onNow.length)} />
        <Figure label="Shifts in seven days" value={String(all.length)} />
        <Figure
          label="Clock-ins off site or not recorded"
          value={String(unproven.length)}
        />
      </div>

      {shifts.isError && (
        <div className="mt-5">
          <ErrorNote
            error={shifts.error}
            what="We could not load the attendance record."
          />
        </div>
      )}

      <div className="mt-6">
        <OnNow shifts={onNow} />
      </div>

      <section className="mt-8">
        <h2 className="text-base">Recent shifts</h2>
        <div className="mt-3">
          <ShiftList
            shifts={all}
            pending={shifts.isPending}
            showName
            empty="No shifts in the last seven days. Every clock-in and clock-out appears here with where it happened."
          />
        </div>
      </section>
    </div>
  )
}
