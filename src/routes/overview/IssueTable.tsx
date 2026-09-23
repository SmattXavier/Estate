import { Fragment, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import Timeline from '../../components/Timeline'
import { useMediaQuery } from '../../lib/useMediaQuery'
import { Empty } from '../../components/States'
import {
  TONE_BORDER,
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
      <span className={isEscalated(issue) ? 'text-destructive' : 'text-foreground-muted'}>
        <span className="num">{waiting}</span> min so far
      </span>
    )
  }

  const late = assignedWithinTarget(issue) === false
  return (
    <span className={late ? 'text-destructive' : undefined}>
      <span className="num">{minutes}</span> min
    </span>
  )
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

function Expanded({ issue }: { issue: BoardIssue }) {
  return (
    <>
      <p className="flex gap-3 text-xs text-foreground-faint">
        <span>{issue.reporter?.full_name ?? 'Unknown'}</span>
        <span className="num">{timeOfDay(issue.created_at)}</span>
      </p>
      <p className="mt-1.5">{issue.description}</p>
      {/* Verbatim: the CEO reads the record as it was written. */}
      <Timeline issueId={issue.id} />
    </>
  )
}

export default function IssueTable({ issues }: { issues: BoardIssue[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [now, setNow] = useState(() => Date.now())
  // A table needs width it does not have on a phone. Cards below, table
  // above — one or the other, never both rendered and one hidden.
  const wide = useMediaQuery('(min-width: 768px)')

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(id)
  }, [])

  if (!issues.length) {
    return (
      <Empty>
        No issues on this estate yet. Every fault a resident reports appears
        here, newest first, with what it cost to put right.
      </Empty>
    )
  }

  if (!wide) {
    return (
      <ul className="space-y-3">
        {issues.map((issue) => {
          const expanded = expandedId === issue.id
          const tone: Tone = isEscalated(issue) ? 'destructive' : cardTone(issue, now)

          return (
            <li
              key={issue.id}
              className={`rounded-sm border border-subtle border-l-4 bg-card ${TONE_BORDER[tone]}`}
            >
              <button
                type="button"
                onClick={() => setExpandedId(expanded ? null : issue.id)}
                aria-expanded={expanded}
                className="w-full px-3.5 py-3 text-left"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="num text-xs text-foreground-faint">{issue.ref}</span>
                  <span
                    className={`shrink-0 rounded-sm border px-1.5 py-0.5 text-xs ${TONE_CHIP[tone]}`}
                  >
                    {chipLabel(issue)}
                  </span>
                </div>

                <h3 className="mt-1 text-base">{issue.title}</h3>

                <p className="mt-1 flex flex-wrap gap-x-3 text-xs text-foreground-muted">
                  <span>{issue.unit?.label ?? 'Unknown unit'}</span>
                  <span>{issue.category}</span>
                </p>

                <p className="mt-1.5 text-sm">
                  <ToAssign issue={issue} now={now} /> to assign
                </p>
              </button>

              {expanded && (
                <div className="border-t border-subtle px-3.5 py-3">
                  <Expanded issue={issue} />
                </div>
              )}
            </li>
          )
        })}
      </ul>
    )
  }

  return (
    <div className="overflow-x-auto rounded-sm border border-subtle bg-card">
      <table className="w-full min-w-[54rem] border-collapse text-sm">
        <thead>
          <tr className="border-b border-subtle text-left text-xs text-foreground-faint">
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
            const tone: Tone = isEscalated(issue) ? 'destructive' : cardTone(issue, now)

            return (
              <Fragment key={issue.id}>
                <tr
                  onClick={() => setExpandedId(expanded ? null : issue.id)}
                  aria-expanded={expanded}
                  className="cursor-pointer border-b border-subtle hover:bg-surface-2"
                >
                  <Cell className="num text-foreground-muted">{issue.ref}</Cell>
                  <Cell>
                    {issue.title}
                    <span className="mt-0.5 block text-xs text-foreground-faint">
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
                  <tr className="border-b border-subtle bg-surface-2">
                    <td colSpan={7} className="px-3 py-3">
                      <Expanded issue={issue} />
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
