import type { ReactNode } from 'react'
import { useAuth } from '../auth/context'

// Task 1 stubs. Tasks 2, 3 and 4 replace these with the real screens.
function Shell({ title, children }: { title: string; children?: ReactNode }) {
  const { profile, signOut } = useAuth()

  return (
    <main className="min-h-dvh bg-bg px-6 py-10 text-ink">
      <div className="mx-auto flex w-full max-w-3xl items-start justify-between gap-6">
        <div>
          <h1 className="text-2xl font-semibold">{title}</h1>
          <p className="mt-1 text-sm text-ink-soft">
            Signed in as {profile?.full_name}
          </p>
          {children}
        </div>
        <button
          type="button"
          onClick={() => void signOut()}
          className="rounded-sm border border-line bg-surface px-3 py-2 text-sm font-medium hover:border-primary hover:text-primary"
        >
          Sign out
        </button>
      </div>
    </main>
  )
}

export function Overview() {
  return <Shell title="Estate overview" />
}
