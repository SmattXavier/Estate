import { useEffect, useState } from 'react'
import CountdownBar from '../../components/CountdownBar'
import Timeline from '../../components/Timeline'
import { TONE_BORDER, cardTone, type Issue } from '../../lib/issues'
import { reportedLine, statusLine, timelineBody } from './language'

function Card({ issue }: { issue: Issue }) {
  const [open, setOpen] = useState(false)
  // Same pattern as the bar, one notch slower: the wording only needs to
  // keep up with "20 minutes ago", and a card ticking on its own does not
  // re-render its neighbours.
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(id)
  }, [])

  const tone = cardTone(issue, now)

  return (
    <li
      className={`rounded-sm border border-subtle border-l-4 bg-card ${TONE_BORDER[tone]}`}
    >
      <button
        type="button"
        onClick={() => setOpen((was) => !was)}
        aria-expanded={open}
        className="w-full px-4 py-3.5 text-left"
      >
        {/* No status chip on this screen: it only compressed the sentence
            below it into one word. The 4px left border still carries the
            colour, and the countdown bar carries the urgency. */}
        <h3 className="text-base">{issue.title}</h3>

        <p className="mt-1 flex gap-3 text-xs text-foreground-faint">
          <span className="num">{issue.ref}</span>
          <span>{issue.unit?.label ?? 'Your flat'}</span>
        </p>

        <p className="mt-2 text-sm text-foreground-muted">{statusLine(issue, now)}</p>
        <p className="mt-0.5 text-sm text-foreground-faint">
          {reportedLine(issue, now)}
        </p>

        {issue.status === 'submitted' && <CountdownBar issue={issue} />}
      </button>

      {open && (
        <div className="border-t border-subtle px-4 py-3.5">
          <p className="text-sm">{issue.description}</p>
          <Timeline issueId={issue.id} translate={timelineBody} />
        </div>
      )}
    </li>
  )
}

export default function ReportList({ issues }: { issues: Issue[] }) {
  if (!issues.length) {
    return (
      <p className="rounded-sm border border-subtle bg-card px-5 py-10 text-center text-sm text-foreground-muted">
        You have not told us about anything yet.
      </p>
    )
  }

  return (
    <ul className="space-y-3">
      {issues.map((issue) => (
        <Card key={issue.id} issue={issue} />
      ))}
    </ul>
  )
}
