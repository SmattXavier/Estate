import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Empty, SkeletonList } from '../../components/States'
import { useMediaQuery } from '../../lib/useMediaQuery'
import { TONE_CHIP } from '../../lib/issues'
import { shiftMinutes, siteState, spell, type Shift } from '../../lib/attendance'

function Where({
  onSite,
  metres,
}: {
  onSite: boolean | null
  metres: number | string | null
}) {
  const state = siteState(onSite, metres)
  return (
    <span className="inline-flex flex-wrap items-baseline gap-2">
      <span
        className={`shrink-0 rounded-sm border px-1.5 py-0.5 text-xs ${TONE_CHIP[state.tone]}`}
      >
        {state.label}
      </span>
      {state.distance && (
        <span className="num text-xs text-foreground-faint">
          {state.distance}
        </span>
      )}
    </span>
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

function day(iso: string): string {
  return new Date(iso).toLocaleDateString('en-NG', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'Africa/Lagos',
  })
}

function Cell({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return <td className={`px-3 py-2 align-top ${className}`}>{children}</td>
}

/**
 * Recent shifts. Shared by the manager's view and the artisan's own screen,
 * so the three location states can only ever be rendered one way.
 */
export default function ShiftList({
  shifts,
  pending,
  showName,
  empty,
}: {
  shifts: Shift[]
  pending: boolean
  showName: boolean
  empty: string
}) {
  // Same 30s beat as the resident cards and the rail clock: a running shift
  // should not sit frozen between refetches.
  const wide = useMediaQuery('(min-width: 768px)')
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(id)
  }, [])

  if (pending) return <SkeletonList rows={3} />
  if (shifts.length === 0) return <Empty>{empty}</Empty>

  if (!wide) {
    return (
      <ul className="space-y-2.5">
        {shifts.map((shift) => (
          <li
            key={shift.id}
            className="rounded-sm border border-subtle bg-card px-3.5 py-3"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
              <span className="text-base">
                {showName ? shift.full_name : day(shift.clock_in_at)}
              </span>
              <span className="num text-sm text-foreground-muted">
                {spell(shiftMinutes(shift, now))}
                {shift.on_shift && ' so far'}
              </span>
            </div>
            {showName && (
              <p className="mt-0.5 flex flex-wrap gap-x-3 text-sm text-foreground-muted">
                <span>{shift.trade ?? shift.staff_kind}</span>
                <span>{day(shift.clock_in_at)}</span>
              </p>
            )}

            <p className="mt-2 flex flex-wrap items-baseline gap-x-2 text-sm">
              <span className="num">{clockTime(shift.clock_in_at)}</span>
              <Where
                onSite={shift.clock_in_on_site}
                metres={shift.clock_in_metres}
              />
            </p>
            <p className="mt-1 flex flex-wrap items-baseline gap-x-2 text-sm">
              <span className="num">
                {shift.clock_out_at ? clockTime(shift.clock_out_at) : 'Still on'}
              </span>
              {shift.clock_out_at && (
                <Where onSite={shift.clock_out_on_site} metres={null} />
              )}
            </p>
          </li>
        ))}
      </ul>
    )
  }

  return (
    <div className="overflow-x-auto rounded-sm border border-subtle bg-card">
        <table className="w-full min-w-[44rem] border-collapse text-sm">
          <thead>
            <tr className="border-b border-subtle text-left text-xs text-foreground-faint">
              {showName && <th className="px-3 py-2 font-normal">Who</th>}
              <th className="px-3 py-2 font-normal">Day</th>
              <th className="px-3 py-2 font-normal">Clocked in</th>
              <th className="px-3 py-2 font-normal">Clocked out</th>
              <th className="px-3 py-2 font-normal">Hours</th>
            </tr>
          </thead>
          <tbody>
            {shifts.map((shift) => (
              <tr key={shift.id} className="border-b border-subtle last:border-0">
                {showName && (
                  <Cell>
                    {shift.full_name}
                    <span className="mt-0.5 block text-xs text-foreground-faint">
                      {shift.trade ?? shift.staff_kind}
                    </span>
                  </Cell>
                )}
                <Cell className="num">{day(shift.clock_in_at)}</Cell>
                <Cell>
                  <span className="num">{clockTime(shift.clock_in_at)}</span>
                  <span className="mt-1 block">
                    <Where
                      onSite={shift.clock_in_on_site}
                      metres={shift.clock_in_metres}
                    />
                  </span>
                </Cell>
                <Cell>
                  <span className="num">
                    {shift.clock_out_at
                      ? clockTime(shift.clock_out_at)
                      : 'Still on'}
                  </span>
                  {shift.clock_out_at && (
                    <span className="mt-1 block">
                      <Where onSite={shift.clock_out_on_site} metres={null} />
                    </span>
                  )}
                </Cell>
                <Cell className="num">
                  {spell(shiftMinutes(shift, now))}
                  {shift.on_shift && (
                    <span className="block text-xs text-foreground-faint">
                      so far
                    </span>
                  )}
                </Cell>
              </tr>
            ))}
          </tbody>
        </table>
    </div>
  )
}
