import { TONE_FILL, type Tone } from '../lib/issues'

/**
 * A filled track. The countdown bar and the service-charge progress bar are
 * the same object wearing different meanings, so they share this rather
 * than being written twice and drifting apart.
 *
 * `fraction` is clamped here, so callers pass a ratio and do not each
 * reinvent the guard.
 */
export default function Bar({
  fraction,
  tone,
  animate,
  label,
}: {
  fraction: number
  tone: Tone
  /** Only the countdown drains; everything else is static (theme.css). */
  animate?: boolean
  label?: string
}) {
  const filled = Math.min(Math.max(fraction, 0), 1)

  return (
    <div className="mt-3 flex items-center gap-3">
      <div className="h-1.5 grow overflow-hidden rounded-sm bg-surface-2">
        <div
          className={`h-full rounded-sm ${TONE_FILL[tone]} ${
            animate ? 'transition-[width] ease-linear' : ''
          }`}
          style={{
            width: `${filled * 100}%`,
            // Collapses to 1ms under prefers-reduced-motion, via the token.
            ...(animate ? { transitionDuration: 'var(--motion-slow)' } : {}),
          }}
        />
      </div>
      {label && (
        <span
          className={`num shrink-0 text-xs ${
            tone === 'destructive'
              ? 'text-destructive'
              : tone === 'warning'
                ? 'text-warning'
                : tone === 'success'
                  ? 'text-success'
                  : 'text-foreground-muted'
          }`}
        >
          {label}
        </span>
      )}
    </div>
  )
}
