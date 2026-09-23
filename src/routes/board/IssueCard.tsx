import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import CountdownBar from '../../components/CountdownBar'
import Timeline from '../../components/Timeline'
import { supabase } from '../../lib/supabase'
import {
  BOARD_ISSUES_KEY,
  TONE_BORDER,
  TONE_CHIP,
  cardTone,
  timeOfDay,
  type BoardIssue,
  type Tone,
} from '../../lib/issues'

/** The draft handed back by the artisan directory. */
export type Dispatch = { technicianId: string; reply: string }

function chipLabel(issue: BoardIssue): string {
  switch (issue.status) {
    case 'submitted':
      // The stamp, not the clock (Rule 14).
      return issue.escalated_at ? 'Escalated' : 'Submitted'
    case 'assigned':
      return 'Assigned'
    case 'resolved':
      return 'Resolved'
    case 'closed':
      return 'Closed'
  }
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-foreground-faint">{label}</dt>
      <dd className="mt-0.5">{value}</dd>
    </div>
  )
}

function DispatchForm({
  issue,
  draft,
  onDispatched,
  onRechoose,
}: {
  issue: BoardIssue
  draft: Dispatch
  onDispatched: () => void
  onRechoose: () => void
}) {
  const queryClient = useQueryClient()
  const [reply, setReply] = useState(draft.reply)

  const dispatch = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('assign_technician', {
        p_issue_id: issue.id,
        p_technician_id: draft.technicianId,
        p_reply: reply,
      })
      if (error) throw error
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: BOARD_ISSUES_KEY })
      await queryClient.invalidateQueries({
        queryKey: ['issue-updates', issue.id],
      })
      onDispatched()
    },
  })

  return (
    <div className="mt-4 border-t border-subtle pt-3">
      <label className="block text-sm font-medium">
        Reply to the resident
        <textarea
          rows={3}
          value={reply}
          onChange={(event) => setReply(event.target.value)}
          className="mt-1.5 w-full resize-none rounded-sm border border-subtle bg-card px-3 py-2 font-normal outline-none focus:border-primary"
        />
      </label>

      {dispatch.isError && (
        <p
          role="alert"
          className="mt-2 rounded-sm border border-destructive/35 bg-destructive-soft px-3 py-2 text-sm text-destructive"
        >
          {(dispatch.error as Error).message}
        </p>
      )}

      <div className="mt-2 flex gap-2">
        <button
          type="button"
          onClick={() => dispatch.mutate()}
          disabled={!reply.trim() || dispatch.isPending}
          className="grow rounded-sm bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary-hover disabled:opacity-60"
        >
          {dispatch.isPending ? 'Dispatching…' : 'Confirm dispatch'}
        </button>
        <button
          type="button"
          onClick={onRechoose}
          className="rounded-sm border border-subtle px-3 py-2.5 text-sm hover:border-primary hover:text-primary"
        >
          Someone else
        </button>
      </div>
    </div>
  )
}

export default function IssueCard({
  issue,
  expanded,
  onToggle,
  draft,
  onDispatched,
}: {
  issue: BoardIssue
  expanded: boolean
  onToggle: () => void
  draft?: Dispatch
  onDispatched: () => void
}) {
  const navigate = useNavigate()
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(id)
  }, [])

  // An escalated issue is red regardless of where the countdown got to.
  const tone: Tone =
    issue.escalated_at && issue.status === 'submitted'
      ? 'destructive'
      : cardTone(issue, now)

  return (
    <li
      className={`rounded-sm border border-subtle border-l-4 bg-card ${TONE_BORDER[tone]}`}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="w-full px-3.5 py-3 text-left lg:px-3 lg:py-2.5"
      >
        <div className="flex items-start justify-between gap-3">
          <span className="num text-xs text-foreground-faint">{issue.ref}</span>
          <span
            className={`shrink-0 rounded-sm border px-1.5 py-0.5 text-xs ${TONE_CHIP[tone]}`}
          >
            {chipLabel(issue)}
          </span>
        </div>

        <h3 className="mt-0.5 text-base">{issue.title}</h3>

        <p className="mt-0.5 flex gap-3 text-xs text-foreground-muted">
          <span>{issue.unit?.label ?? 'Unknown unit'}</span>
          <span>{issue.category}</span>
        </p>

        {issue.status === 'submitted' && <CountdownBar issue={issue} />}

        {issue.nudged_at && (
          <p className="mt-2.5 border-t border-destructive/25 pt-2 text-sm text-destructive">
            The CEO has asked about this one.
          </p>
        )}
      </button>

      {expanded && (
        <div className="border-t border-subtle px-3.5 py-3 lg:px-3 lg:py-2.5">
          <dl className="grid grid-cols-2 gap-2.5 text-sm">
            <Detail
              label="Resident"
              value={issue.reporter?.full_name ?? 'Unknown'}
            />
            <Detail label="Phone" value={issue.reporter?.phone ?? 'Not on file'} />
            <Detail
              label="Entry when out"
              value={issue.access_permission ? 'Permitted' : 'Not permitted'}
            />
            <Detail
              label="Target"
              value={timeOfDay(issue.sla_due_at)}
            />
            {issue.technician && (
              <Detail
                label="Artisan"
                value={`${issue.technician.full_name} (${issue.technician.trade})`}
              />
            )}
          </dl>

          <p className="mt-3 border-t border-subtle pt-3 text-sm">
            {issue.description}
          </p>

          <Timeline issueId={issue.id} />

          {issue.status === 'submitted' && !draft && (
            <button
              type="button"
              onClick={() => navigate(`/board/artisans/${issue.id}`)}
              className="mt-4 w-full rounded-sm bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary-hover"
            >
              Choose an artisan
            </button>
          )}

          {issue.status === 'submitted' && draft && (
            <DispatchForm
              key={draft.technicianId}
              issue={issue}
              draft={draft}
              onDispatched={onDispatched}
              onRechoose={() => navigate(`/board/artisans/${issue.id}`)}
            />
          )}
        </div>
      )}
    </li>
  )
}
