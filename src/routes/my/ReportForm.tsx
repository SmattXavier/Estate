import { useState } from 'react'
import type { FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../auth/context'
import type { Priority, Unit } from '../../lib/issues'
import { CATEGORIES, PRIORITY_CHOICES, PRIORITY_HELP } from './language'

const field =
  'mt-1.5 w-full rounded-sm border border-subtle bg-card px-3 py-2.5 outline-none focus:border-primary'

export default function ReportForm({ onLogged }: { onLogged: () => void }) {
  const { profile } = useAuth()
  const queryClient = useQueryClient()

  const [unitId, setUnitId] = useState('')
  const [category, setCategory] = useState<string>(CATEGORIES[0])
  const [priority, setPriority] = useState<Priority>('normal')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [access, setAccess] = useState(false)

  const units = useQuery({
    queryKey: ['my-units', profile?.id],
    queryFn: async (): Promise<Unit[]> => {
      const { data, error } = await supabase
        .from('units')
        .select('id, label')
        .eq('resident_id', profile!.id)
        .order('label')
      if (error) throw error
      return data ?? []
    },
    enabled: !!profile,
  })

  const chosenUnit = unitId || units.data?.[0]?.id || ''

  const log = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('log_issue', {
        p_unit_id: chosenUnit,
        p_category: category,
        p_priority: priority,
        p_title: title,
        p_description: description,
        p_access_permission: access,
      })
      if (error) throw error
    },
    onSuccess: async () => {
      setTitle('')
      setDescription('')
      setAccess(false)
      setPriority('normal')
      await queryClient.invalidateQueries({ queryKey: ['my-issues'] })
      onLogged()
    },
  })

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    log.mutate()
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5 px-5 py-6">
      <label className="block">
        <span className="text-sm font-medium">Which flat?</span>
        <select
          value={chosenUnit}
          onChange={(e) => setUnitId(e.target.value)}
          className={field}
        >
          {units.data?.map((unit) => (
            <option key={unit.id} value={unit.id}>
              {unit.label}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="text-sm font-medium">What is the trouble with?</span>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className={field}
        >
          {CATEGORIES.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>

      <fieldset>
        <legend className="text-sm font-medium">How bad is it?</legend>
        <div className="mt-1.5 grid grid-cols-2 gap-2">
          {PRIORITY_CHOICES.map((choice) => {
            const chosen = choice.value === priority
            return (
              <button
                key={choice.value}
                type="button"
                onClick={() => setPriority(choice.value)}
                aria-pressed={chosen}
                className={`rounded-sm border px-3 py-2.5 text-left ${
                  chosen
                    ? 'border-primary bg-surface-2 text-primary'
                    : 'border-subtle bg-card text-foreground'
                }`}
              >
                <span className="block font-medium">{choice.label}</span>
                <span className="mt-0.5 block text-xs text-foreground-muted">
                  {choice.target}
                </span>
              </button>
            )
          })}
        </div>
        <p className="mt-2 text-xs text-foreground-muted">{PRIORITY_HELP}</p>
      </fieldset>

      <label className="block">
        <span className="text-sm font-medium">In one line</span>
        <input
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Burst pipe under the kitchen sink"
          className={field}
        />
      </label>

      <label className="block">
        <span className="text-sm font-medium">Tell us more</span>
        <textarea
          required
          rows={4}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What is happening, and since when?"
          className={`${field} resize-none`}
        />
      </label>

      <label className="flex items-start gap-2.5 rounded-sm border border-subtle bg-surface-2 px-3 py-3">
        <input
          type="checkbox"
          checked={access}
          onChange={(e) => setAccess(e.target.checked)}
          className="mt-0.5 accent-primary"
        />
        <span className="text-sm">
          Someone may enter the flat while I am out.
        </span>
      </label>

      {log.isError && (
        <p
          role="alert"
          className="rounded-sm border border-destructive/35 bg-destructive-soft px-3 py-2 text-sm text-destructive"
        >
          {(log.error as Error).message}
        </p>
      )}

      <button
        type="submit"
        disabled={log.isPending || !chosenUnit}
        className="w-full rounded-sm bg-primary px-4 py-3 font-medium text-primary-foreground hover:bg-primary-hover disabled:opacity-60"
      >
        {log.isPending ? 'Sending…' : 'Send to the estate office'}
      </button>
    </form>
  )
}
