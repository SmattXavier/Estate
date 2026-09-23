import type { ReactNode } from 'react'

/**
 * The shared loading placeholder. Deliberately still: the countdown bar is
 * the only thing in this app that moves, and a pulsing skeleton on every
 * screen would break that rule for no information gain.
 */
export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`rounded-sm bg-surface-2 ${className}`}
    />
  )
}

/** A stack of card-shaped placeholders, for a list that is still loading. */
export function SkeletonList({ rows = 3 }: { rows?: number }) {
  return (
    <div role="status" aria-label="Loading" className="space-y-3">
      {Array.from({ length: rows }, (_, i) => (
        <div
          key={i}
          className="rounded-sm border border-subtle border-l-4 border-l-strong bg-card px-4 py-3.5"
        >
          <Skeleton className="h-3 w-24" />
          <Skeleton className="mt-2 h-4 w-3/5" />
          <Skeleton className="mt-2.5 h-3 w-2/5" />
        </div>
      ))}
    </div>
  )
}

/** What would have been here. Never a bare blank area. */
export function Empty({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-sm border border-dashed border-subtle px-4 py-8 text-center text-sm text-foreground-muted">
      {children}
    </p>
  )
}

/**
 * A failed read, said out loud. A query that errors must not look the same
 * as a query that returned nothing.
 */
/**
 * Supabase does not throw Error instances — a PostgrestError is a plain
 * object with a message field, so `String(error)` gives "[object Object]"
 * and the server's actual words ("that would overpay the bill by 50,000")
 * never reach the screen.
 */
function readable(error: unknown): string {
  if (error instanceof Error) return error.message
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message
    if (typeof message === 'string' && message) return message
  }
  return String(error)
}

export function ErrorNote({ error, what }: { error: unknown; what: string }) {
  const message = readable(error)
  return (
    <p
      role="alert"
      className="rounded-sm border border-destructive/35 bg-destructive-soft px-4 py-3 text-sm text-destructive"
    >
      {what} {message}
    </p>
  )
}
