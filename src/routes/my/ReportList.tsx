import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import CountdownBar from '../../components/CountdownBar'
import Timeline from '../../components/Timeline'
import { TONE_BORDER, cardTone, type Issue } from '../../lib/issues'
import { Empty, ErrorNote } from '../../components/States'
import {
  FIX_ASK,
  FIX_DID,
  FIX_NO,
  FIX_USED,
  FIX_YES,
  reportedLine,
  statusLine,
  timelineBody,
} from './language'

/** "Just reported" is a claim about time, so it expires. */
const JUST_REPORTED_MS = 5 * 60_000

/**
 * Shown on a report the manager has finished with. Two answers, no form:
 * the resident is already inconvenienced, and reopen_issue writes its own
 * timeline wording when no reason is given.
 *
 * Saying "No" restarts clock_started_at and sla_due_at server-side, so the
 * refetch below is what makes the countdown reappear from full.
 */
function Outcome({ issue }: { issue: Issue }) {
  const queryClient = useQueryClient()

  const answer = useMutation({
    mutationFn: async (fixed: boolean) => {
      const { error } = fixed
        ? await supabase.rpc('confirm_resolution', { p_issue_id: issue.id })
        : await supabase.rpc('reopen_issue', { p_issue_id: issue.id })
      if (error) throw error
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['my-issues'] })
      await queryClient.invalidateQueries({
        queryKey: ['issue-updates', issue.id],
      })
    },
  })

  return (
    <div className="border-t border-subtle px-4 py-4">
      {issue.work_done && (
        <>
          <p className="text-sm font-medium">{FIX_DID}</p>
          <p className="mt-1 max-w-prose text-base leading-normal md:text-sm">
            {issue.work_done}
          </p>
        </>
      )}

      {issue.work_materials && (
        <>
          <p className="mt-3 text-sm font-medium">{FIX_USED}</p>
          <p className="mt-1 max-w-prose text-base leading-normal md:text-sm">
            {issue.work_materials}
          </p>
        </>
      )}

      <p className="mt-4 text-base text-foreground-muted md:text-sm">
        {FIX_ASK}
      </p>

      {answer.isError && (
        <div className="mt-3">
          <ErrorNote error={answer.error} what="" />
        </div>
      )}

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => answer.mutate(true)}
          disabled={answer.isPending}
          className="min-h-11 rounded-sm bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary-hover disabled:opacity-60"
        >
          {answer.isPending ? 'Sending…' : FIX_YES}
        </button>
        <button
          type="button"
          onClick={() => answer.mutate(false)}
          disabled={answer.isPending}
          className="min-h-11 rounded-sm border border-subtle px-4 py-2.5 text-sm hover:border-destructive hover:text-destructive disabled:opacity-60"
        >
          {FIX_NO}
        </button>
      </div>
    </div>
  )
}

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

      {issue.status === 'resolved' && <Outcome issue={issue} />}

      {open && (
        <div className="border-t border-subtle px-4 py-4 md:py-3.5">
          <p className="max-w-prose text-base leading-normal md:text-sm">
            {issue.description}
          </p>
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

  // One column until there is genuinely room for two.
  return (
    <ul className="space-y-3 2xl:grid 2xl:grid-cols-2 2xl:gap-3 2xl:space-y-0">
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
