import { useEffect, useState } from 'react'
import CountdownBar from '../../components/CountdownBar'
import Timeline from '../../components/Timeline'
import { TONE_BORDER, cardTone, type Issue } from '../../lib/issues'
import { Empty } from '../../components/States'
import { reportedLine, statusLine, timelineBody } from './language'

/** "Just reported" is a claim about time, so it expires. */
const JUST_REPORTED_MS = 5 * 60_000

function Card({ issue, marked }: { issue: Issue; marked: boolean }) {
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
  // The id arrives in location state, which React Router stores in
  // history.state and therefore restores on reload. Bounding it by the
  // report's own age keeps a stale reload from claiming "just".
  const highlight =
    marked && now - new Date(issue.created_at).getTime() < JUST_REPORTED_MS

  return (
    <li
      className={`rounded-sm border border-l-4 bg-card ${TONE_BORDER[tone]} ${
        highlight ? 'border-primary shadow-e2' : 'border-subtle'
      }`}
    >
      <button
        type="button"
        onClick={() => setOpen((was) => !was)}
        aria-expanded={open}
        className="w-full px-4 py-4 text-left md:py-3.5"
      >
        {/* No status chip on this screen: it only compressed the sentence
            below it into one word. The 4px left border still carries the
            colour, and the countdown bar carries the urgency. */}
        {highlight && (
          <p className="mb-1 text-xs text-primary">Just reported.</p>
        )}

        <h3 className="text-base">{issue.title}</h3>

        <p className="mt-1 flex gap-3 text-xs text-foreground-faint">
          <span className="num">{issue.ref}</span>
          <span>{issue.unit?.label ?? 'Your flat'}</span>
        </p>

        <p className="mt-2 text-base text-foreground-muted md:text-sm">
          {statusLine(issue, now)}
        </p>
        <p className="mt-1 text-sm text-foreground-faint">
          {reportedLine(issue, now)}
        </p>

        {issue.status === 'submitted' && <CountdownBar issue={issue} />}
      </button>

      {open && (
        <div className="border-t border-subtle px-4 py-4 md:py-3.5">
          <p className="text-base leading-normal md:text-sm">{issue.description}</p>
          <Timeline issueId={issue.id} translate={timelineBody} />
        </div>
      )}
    </li>
  )
}

export default function ReportList({
  issues,
  highlightId = null,
}: {
  issues: Issue[]
  highlightId?: string | null
}) {
  if (!issues.length) {
    return (
      <Empty>
        Nothing reported yet. Anything you send to the estate office shows up
        here, with how long it has been waiting.
      </Empty>
    )
  }

  return (
    <ul className="space-y-3">
      {issues.map((issue) => (
        <Card
          key={issue.id}
          issue={issue}
          marked={issue.id === highlightId}
        />
      ))}
    </ul>
  )
}
