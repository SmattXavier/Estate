import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { timeOfDay, type IssueUpdate } from '../lib/issues'

/**
 * The audit trail for one issue. `translate` lets the resident screen soften
 * server wording it is not allowed to show; the board passes nothing and
 * gets the body verbatim.
 */
export default function Timeline({
  issueId,
  translate,
}: {
  issueId: string
  translate?: (update: IssueUpdate) => string
}) {
  const updates = useQuery({
    queryKey: ['issue-updates', issueId],
    queryFn: async (): Promise<IssueUpdate[]> => {
      const { data, error } = await supabase
        .from('issue_updates')
        .select('id, author_name, kind, body, created_at')
        .eq('issue_id', issueId)
        .order('created_at')
      if (error) throw error
      return data ?? []
    },
  })

  if (!updates.data?.length) return null

  return (
    <ol className="mt-4 border-l border-line pl-4">
      {updates.data.map((update) => (
        <li key={update.id} className="relative pb-3.5 last:pb-0">
          <span className="absolute top-1.5 -left-[21px] h-2 w-2 rounded-sm border border-line-strong bg-surface" />
          <p className="text-sm">
            {translate ? translate(update) : update.body}
          </p>
          <p className="mt-0.5 flex gap-3 text-xs text-ink-faint">
            <span>{update.author_name}</span>
            <span className="num">{timeOfDay(update.created_at)}</span>
          </p>
        </li>
      ))}
    </ol>
  )
}
