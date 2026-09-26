import { useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ErrorNote } from '../../components/States'
import { supabase } from '../../lib/supabase'
import { BOARD_ISSUES_KEY, type BoardIssue } from '../../lib/issues'

const field =
  'mt-1.5 min-h-11 w-full rounded-sm border border-subtle bg-card px-3 py-2.5 text-base outline-none focus:border-primary'

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-medium">{label}</span>
      {children}
    </label>
  )
}

/**
 * Inline on an expanded assigned issue, the same shape as the payment form
 * on /board/charges. Recording the fix hands the issue back to the resident,
 * who is the only one who can close it (Rule 15) — there is no close button
 * here and there should not be.
 */
export default function ResolveForm({ issue }: { issue: BoardIssue }) {
  const queryClient = useQueryClient()
  const [workDone, setWorkDone] = useState('')
  const [materials, setMaterials] = useState('')
  const [cost, setCost] = useState('')

  const resolve = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('resolve_issue', {
        p_issue_id: issue.id,
        p_work_done: workDone,
        p_materials: materials,
        // Blank means nothing was spent; the server coalesces null to zero.
        p_cost: cost.trim() === '' ? null : Number(cost),
      })
      if (error) throw error
    },
    onSuccess: async () => {
      setWorkDone('')
      setMaterials('')
      setCost('')
      await queryClient.invalidateQueries({ queryKey: BOARD_ISSUES_KEY })
      await queryClient.invalidateQueries({
        queryKey: ['issue-updates', issue.id],
      })
    },
  })

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    resolve.mutate()
  }

  return (
    <form onSubmit={onSubmit} className="mt-4 border-t border-subtle pt-3">
      <p className="text-sm font-medium">Record the fix</p>

      <div className="mt-2 space-y-3">
        <Field label="What was done">
          <textarea
            rows={3}
            required
            value={workDone}
            onChange={(e) => setWorkDone(e.target.value)}
            placeholder="Replaced the trap assembly and tested the flow."
            className={`resize-none ${field}`}
          />
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Parts used">
            <input
              value={materials}
              onChange={(e) => setMaterials(e.target.value)}
              placeholder="Optional"
              className={field}
            />
          </Field>
          <Field label="Cost in naira">
            <input
              type="number"
              min="0"
              step="1"
              value={cost}
              onChange={(e) => setCost(e.target.value)}
              placeholder="Leave blank if nothing was spent"
              className={`num ${field}`}
            />
          </Field>
        </div>
      </div>

      {/* Only the blank-description rule is mirrored here, because that is
          about the form being incomplete. Whether the issue is still
          assigned, and whether it is on this estate, stay server-owned. */}
      {resolve.isError && (
        <div className="mt-3">
          <ErrorNote error={resolve.error} what="" />
        </div>
      )}

      <button
        type="submit"
        disabled={resolve.isPending || !workDone.trim()}
        className="mt-3 min-h-11 w-full rounded-sm bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary-hover disabled:opacity-60 sm:w-auto"
      >
        {resolve.isPending ? 'Recording…' : 'Record the fix'}
      </button>
    </form>
  )
}
