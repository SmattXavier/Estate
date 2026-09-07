import { Fragment, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import Timeline from '../../components/Timeline'
import {
  TONE_CHIP,
  assignedWithinTarget,
  cardTone,
  isEscalated,
  minutesToAssign,
  naira,
  timeOfDay,
  type BoardIssue,
  type Tone,
} from '../../lib/issues'

function chipLabel(issue: BoardIssue): string {
  if (isEscalated(issue)) return 'Escalated'
  return issue.status.charAt(0).toUpperCase() + issue.status.slice(1)
}

/** "18 min", red when it overran the target, "43 min so far" while waiting. */
function ToAssign({ issue, now }: { issue: BoardIssue; now: number }) {
  const minutes = minutesToAssign(issue)

  if (minutes === null) {
    if (issue.status !== 'submitted') return <span>—</span>
    const waiting = Math.floor(
      (now - new Date(issue.clock_started_at).getTime()) / 60_000,
    )
    return (
      <span className={isEscalated(issue) ? 'text-red' : 'text-ink-soft'}>
        {waiting} min so far
      </span>
    )
  }

  const late = assignedWithinTarget(issue) === false
  return <span className={late ? 'text-red' : undefined}>{minutes} min</span>
}

function Cell({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return <td className={`px-3 py-2.5 align-top ${className}`}>{children}</td>
}

export default function IssueTable({ issues }: { issues: BoardIssue[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="overflow-x-auto rounded-sm border border-line bg-surface">
      <table className="w-full min-w-[54rem] border-collapse text-sm">
        <thead>
          <tr className="border-b border-line text-left text-xs text-ink-faint">
            <th className="px-3 py-2 font-normal">Ref</th>
            <th className="px-3 py-2 font-normal">Issue</th>
            <th className="px-3 py-2 font-normal">Unit</th>
            <th className="px-3 py-2 font-normal">Priority</th>
            <th className="px-3 py-2 font-normal">Status</th>
            <th className="px-3 py-2 font-normal">To assign</th>
            <th className="px-3 py-2 font-normal">Cost</th>
          </tr>
        </thead>
        <tbody>
          {issues.map((issue) => {
            const expanded = expandedId === issue.id
            const tone: Tone = isEscalated(issue) ? 'red' : cardTone(issue, now)

            return (
              <Fragment key={issue.id}>
                <tr
                  onClick={() => setExpandedId(expanded ? null : issue.id)}
                  aria-expanded={expanded}
                  className="cursor-pointer border-b border-line hover:bg-sunk"
                >
                  <Cell className="num text-ink-soft">{issue.ref}</Cell>
                  <Cell>
                    {issue.title}
                    <span className="mt-0.5 block text-xs text-ink-faint">
                      {issue.category}
                    </span>
                  </Cell>
                  <Cell>{issue.unit?.label ?? '—'}</Cell>
                  <Cell>{issue.priority}</Cell>
                  <Cell>
                    <span
                      className={`rounded-sm border px-1.5 py-0.5 text-xs ${TONE_CHIP[tone]}`}
                    >
                      {chipLabel(issue)}
                    </span>
                  </Cell>
                  <Cell className="num">
                    <ToAssign issue={issue} now={now} />
                  </Cell>
                  <Cell className="num">{naira(issue.work_cost)}</Cell>
                </tr>

                {expanded && (
                  <tr className="border-b border-line bg-sunk">
                    <td colSpan={7} className="px-3 py-3">
                      <p className="flex gap-3 text-xs text-ink-faint">
                        <span>{issue.reporter?.full_name ?? 'Unknown'}</span>
                        <span className="num">{timeOfDay(issue.created_at)}</span>
                      </p>
                      <p className="mt-1.5">{issue.description}</p>
                      {/* Verbatim: the CEO reads the record as it was written. */}
                      <Timeline issueId={issue.id} />
                    </td>
                  </tr>
                )}
              </Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
