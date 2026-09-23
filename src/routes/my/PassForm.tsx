import { useState } from 'react'
import type { FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ErrorNote } from '../../components/States'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../auth/context'
import type { Pass } from '../../lib/passes'
import type { Unit } from '../../lib/issues'
import { PASS_DURATIONS, untilWhen, whatsAppMessage } from './language'

const field =
  'mt-1.5 min-h-11 w-full rounded-sm border border-subtle bg-card px-3 py-2.5 text-base outline-none focus:border-primary'

function Made({ pass, estate }: { pass: Pass; estate: string }) {
  const [copied, setCopied] = useState<boolean | null>(null)

  async function copy() {
    try {
      await navigator.clipboard.writeText(pass.code)
      setCopied(true)
    } catch {
      // Needs a secure context; over a bare LAN address it rejects. The
      // code stays selectable, so say so rather than pretending.
      setCopied(false)
    }
  }

  const message = whatsAppMessage(
    pass.visitor_name,
    pass.code,
    estate,
    pass.valid_until,
  )

  return (
    <div className="rounded-sm border border-success/35 bg-success-soft px-4 py-5">
      <p className="text-sm text-foreground-muted">
        {pass.visitor_name}&rsquo;s code
      </p>

      {/* Large, spaced and monospaced: this gets read aloud down a bad line. */}
      <p className="num mt-2 text-3xl tracking-[0.35em] text-foreground select-all">
        {pass.code}
      </p>

      <p className="mt-2 max-w-prose text-sm text-foreground-muted">
        Works until {untilWhen(pass.valid_until)}.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void copy()}
          className="min-h-11 rounded-sm border border-subtle bg-card px-4 py-2.5 text-sm hover:border-primary hover:text-primary"
        >
          {copied ? 'Copied' : 'Copy the code'}
        </button>
        <a
          href={`https://wa.me/?text=${encodeURIComponent(message)}`}
          target="_blank"
          rel="noreferrer"
          className="flex min-h-11 items-center rounded-sm bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary-hover"
        >
          Send on WhatsApp
        </a>
      </div>

      {copied === false && (
        <p className="mt-2 text-xs text-foreground-muted">
          Your browser would not let us copy it. Tap the code to select it.
        </p>
      )}
    </div>
  )
}

export default function PassForm() {
  const { profile } = useAuth()
  const queryClient = useQueryClient()

  const [unitId, setUnitId] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [purpose, setPurpose] = useState('')
  const [plate, setPlate] = useState('')
  const [hours, setHours] = useState(PASS_DURATIONS[1].hours)
  const [made, setMade] = useState<Pass | null>(null)

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

  const estate = useQuery({
    queryKey: ['estate', profile?.estate_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('estates')
        .select('name')
        .eq('id', profile!.estate_id)
        .maybeSingle()
      if (error) throw error
      return data
    },
    enabled: !!profile,
  })

  const chosenUnit = unitId || units.data?.[0]?.id || ''

  const create = useMutation({
    mutationFn: async (): Promise<Pass> => {
      const { data, error } = await supabase.rpc('create_visitor_pass', {
        p_unit_id: chosenUnit,
        p_visitor_name: name,
        p_visitor_phone: phone,
        p_purpose: purpose,
        p_vehicle_plate: plate,
        p_hours_valid: hours,
      })
      if (error) throw error
      return (Array.isArray(data) ? data[0] : data) as Pass
    },
    onSuccess: async (pass) => {
      setMade(pass)
      setName('')
      setPhone('')
      setPurpose('')
      setPlate('')
      await queryClient.invalidateQueries({ queryKey: ['my-passes'] })
    },
  })

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    create.mutate()
  }

  return (
    <div className="space-y-4">
      {made && <Made pass={made} estate={estate.data?.name ?? 'the estate'} />}

      <form
        onSubmit={onSubmit}
        className="rounded-sm border border-subtle bg-card px-4 py-4"
      >
        {units.isError && (
          <div className="mb-3">
            <ErrorNote
              error={units.error}
              what="We could not load your flats, so this cannot be sent."
            />
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-medium">Which flat?</span>
            <select
              value={chosenUnit}
              onChange={(e) => setUnitId(e.target.value)}
              className={field}
            >
              {(units.data ?? []).map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-sm font-medium">Who is coming?</span>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Chinedu Eze"
              className={field}
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium">Their phone</span>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Optional"
              className={`num ${field}`}
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium">What for?</span>
            <input
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder="Optional"
              className={field}
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium">Vehicle plate</span>
            <input
              value={plate}
              onChange={(e) => setPlate(e.target.value)}
              placeholder="Optional"
              className={`num ${field}`}
            />
          </label>
        </div>

        <fieldset className="mt-4">
          <legend className="text-sm font-medium">
            How long should it work for?
          </legend>
          <div className="mt-1.5 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {PASS_DURATIONS.map((choice) => (
              <button
                key={choice.hours}
                type="button"
                onClick={() => setHours(choice.hours)}
                aria-pressed={hours === choice.hours}
                className={`min-h-11 rounded-sm border px-3 py-2.5 text-sm ${
                  hours === choice.hours
                    ? 'border-primary bg-surface-2 text-primary'
                    : 'border-subtle bg-card text-foreground'
                }`}
              >
                {choice.label}
              </button>
            ))}
          </div>
        </fieldset>

        {create.isError && (
          <div className="mt-3">
            <ErrorNote error={create.error} what="" />
          </div>
        )}

        <button
          type="submit"
          disabled={create.isPending || !name.trim() || !chosenUnit}
          className="mt-4 min-h-11 w-full rounded-sm bg-primary px-4 py-3 font-medium text-primary-foreground hover:bg-primary-hover disabled:opacity-60 sm:w-auto"
        >
          {create.isPending ? 'Making the code…' : 'Make a code'}
        </button>
      </form>
    </div>
  )
}
