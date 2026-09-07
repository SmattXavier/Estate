import { useState } from 'react'
import type { FormEvent } from 'react'
import { useAuth } from '../auth/context'

export default function SignIn() {
  const { signIn, error } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    await signIn(email.trim(), password)
    setSubmitting(false)
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-bg px-4 py-12 text-ink min-[400px]:px-5">
      <div className="w-full max-w-[380px]">
        <p className="text-xs uppercase tracking-[0.14em] text-primary">
          Wuse II Estate, Abuja
        </p>
        <h1 className="mt-2 text-2xl font-semibold">Maintenance desk</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Sign in to report a fault or pick up where you left off.
        </p>

        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          <label className="block">
            <span className="text-sm font-medium">Email</span>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-sm border border-line bg-surface px-3 py-2.5 outline-none focus:border-primary"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium">Password</span>
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-sm border border-line bg-surface px-3 py-2.5 outline-none focus:border-primary"
            />
          </label>

          {error && (
            <p
              role="alert"
              className="rounded-sm border border-red/35 bg-red-bg px-3 py-2 text-sm text-red"
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-sm bg-primary px-4 py-2.5 font-medium text-surface hover:bg-primary-dark disabled:opacity-60"
          >
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </main>
  )
}
