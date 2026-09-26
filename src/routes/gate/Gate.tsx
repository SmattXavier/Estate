import { useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ErrorNote } from '../../components/States'
import { supabase } from '../../lib/supabase'
import { getPosition } from '../../lib/geo'

type Verified = {
  pass_id: string
  code: string
  visitor_name: string
  visitor_phone: string | null
  purpose: string | null
  vehicle_plate: string | null
  unit_label: string
  resident_name: string | null
  resident_phone: string | null
  valid_until: string
  verdict: string
}

function clockTime(iso: string): string {
  return new Date(iso)
    .toLocaleTimeString('en-NG', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: 'Africa/Lagos',
    })
    .replace(/\s?([AP]M)/i, (_, m: string) => m.toLowerCase())
}

/** The verdict is the server's word. This only turns it into a sentence. */
function ruling(row: Verified): string {
  switch (row.verdict) {
    case 'valid':
      return 'Let them in'
    case 'expired':
      return `Do not let them in: this pass expired at ${clockTime(row.valid_until)}`
    case 'revoked':
      return 'Do not let them in: the resident cancelled this pass'
    case 'already used':
      return 'Do not let them in: this pass has already been used'
    case 'not valid yet':
      return 'Do not let them in: this pass has not started yet'
    default:
      return `Do not let them in: ${row.verdict}`
  }
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap justify-between gap-x-4 border-b border-subtle py-2 last:border-0">
      <span className="text-sm text-foreground-muted">{label}</span>
      <span className="text-base">{value}</span>
    </div>
  )
}

export default function Gate() {
  const queryClient = useQueryClient()
  const codeRef = useRef<HTMLInputElement>(null)
  const [code, setCode] = useState('')
  const [result, setResult] = useState<Verified | null | 'none'>(null)
  const [logged, setLogged] = useState<string[]>([])

  const verify = useMutation({
    mutationFn: async (): Promise<Verified | 'none'> => {
      // Read-only. A gateman can check the same code as many times as he
      // likes; nothing is consumed until he logs the arrival.
      const { data, error } = await supabase.rpc('verify_pass', {
        p_code: code,
      })
      if (error) throw error
      const row = (Array.isArray(data) ? data[0] : data) as Verified | undefined
      return row ?? 'none'
    },
    onSuccess: (row) => {
      setResult(row)
      setLogged([])
    },
  })

  const log = useMutation({
    mutationFn: async (direction: 'in' | 'out') => {
      // Ask for a position, but never wait on it to decide anything.
      const fix = await getPosition()
      const { error } = await supabase.rpc('record_gate_event', {
        p_code: code,
        p_direction: direction,
        p_lat: fix?.lat ?? null,
        p_lng: fix?.lng ?? null,
        p_accuracy: fix?.accuracy ?? null,
        p_note: null,
      })
      if (error) throw error
      return { direction, fix }
    },
    onSuccess: async ({ direction, fix }) => {
      const who = (result as Verified).visitor_name.split(' ')[0]
      setLogged((was) => [
        ...was,
        direction === 'in'
          ? `${who} came in at ${clockTime(new Date().toISOString())}.${fix ? '' : ' Location was not recorded.'}`
          : `${who} left at ${clockTime(new Date().toISOString())}.${fix ? '' : ' Location was not recorded.'}`,
      ])
      await queryClient.invalidateQueries({ queryKey: ['gate-today'] })
    },
  })

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (code.trim()) verify.mutate()
  }

  function next() {
    setCode('')
    setResult(null)
    setLogged([])
    verify.reset()
    log.reset()
    codeRef.current?.focus()
  }

  const row = result && result !== 'none' ? result : null
  const good = row?.verdict === 'valid'

  return (
    // The one screen that should be a narrow centred column: it is held in
    // one hand at a barrier, and the field must stay under a thumb.
    <div className="mx-auto w-full max-w-[35rem] px-4 py-6 sm:px-6">
      <form onSubmit={onSubmit}>
        <label className="block">
          <span className="text-base font-medium">Visitor&rsquo;s code</span>
          <input
            ref={codeRef}
            autoFocus
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            inputMode="text"
            enterKeyHint="go"
            maxLength={10}
            placeholder="K7M2QF"
            className="num mt-2 min-h-16 w-full rounded-sm border border-strong bg-card px-4 text-center text-3xl tracking-[0.3em] uppercase outline-none focus:border-primary"
          />
        </label>

        <button
          type="submit"
          disabled={verify.isPending || !code.trim()}
          className="mt-3 min-h-14 w-full rounded-sm bg-primary px-4 text-lg font-medium text-primary-foreground hover:bg-primary-hover disabled:opacity-60"
        >
          {verify.isPending ? 'Checking…' : 'Check the code'}
        </button>
      </form>

      {verify.isError && (
        <div className="mt-4">
          <ErrorNote error={verify.error} what="" />
        </div>
      )}

      {result === 'none' && (
        <div className="mt-5 rounded-sm border-l-4 border-destructive border-subtle bg-card px-4 py-4">
          <p className="text-lg text-destructive">
            No pass with that code
          </p>
          <p className="mt-1 text-sm text-foreground-muted">
            Check the spelling, or ask the resident to send a new one.
          </p>
        </div>
      )}

      {row && (
        <div
          className={`mt-5 rounded-sm border border-subtle border-l-4 bg-card px-4 py-4 ${
            good ? 'border-l-success' : 'border-l-destructive'
          }`}
        >
          <p
            className={`text-lg ${good ? 'text-success' : 'text-destructive'}`}
          >
            {ruling(row)}
          </p>

          <div className="mt-3">
            <Line label="Visitor" value={row.visitor_name} />
            {row.purpose && <Line label="Coming for" value={row.purpose} />}
            {row.vehicle_plate && (
              <Line label="Vehicle" value={row.vehicle_plate} />
            )}
            <Line label="Flat" value={row.unit_label} />
            <Line label="Resident" value={row.resident_name ?? 'Not on file'} />
            {row.resident_phone && (
              <Line label="Phone" value={row.resident_phone} />
            )}
          </div>

          {good && (
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => log.mutate('in')}
                disabled={log.isPending}
                className="min-h-14 rounded-sm bg-primary px-4 text-base font-medium text-primary-foreground hover:bg-primary-hover disabled:opacity-60"
              >
                {log.isPending ? 'Saving…' : 'Log the arrival'}
              </button>
              <button
                type="button"
                onClick={() => log.mutate('out')}
                disabled={log.isPending}
                className="min-h-14 rounded-sm border border-subtle px-4 text-base hover:border-primary hover:text-primary disabled:opacity-60"
              >
                Log them leaving
              </button>
            </div>
          )}

          {log.isError && (
            <div className="mt-3">
              <ErrorNote error={log.error} what="" />
            </div>
          )}

          {logged.map((line) => (
            <p key={line} className="mt-3 text-base text-foreground-muted">
              {line}
            </p>
          ))}
        </div>
      )}

      {result !== null && (
        <button
          type="button"
          onClick={next}
          className="mt-4 min-h-11 w-full rounded-sm border border-subtle px-4 py-2.5 text-sm hover:border-primary hover:text-primary"
        >
          Next visitor
        </button>
      )}
    </div>
  )
}
