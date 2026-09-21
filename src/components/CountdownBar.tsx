import { useEffect, useState } from 'react'
import {
  TONE_FILL,
  countdownLabel,
  countdownTone,
  windowLeft,
  type Clocked,
} from '../lib/issues'

/**
 * The only animated thing in the app. The interval lives here, on the one
 * bar it drives, so a screen showing forty cards starts and stops forty
 * independent timers rather than re-rendering the whole list every second.
 */
export default function CountdownBar({ issue }: { issue: Clocked }) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const { remaining, fraction } = windowLeft(issue, now)
  const tone = countdownTone(remaining, fraction)
  // Past the target the window is spent, not absent: a full red bar. The
  // fraction clamps to 0 at the deadline, which would otherwise leave an
  // empty grey track exactly when the bar matters most.
  const filled = remaining <= 0 ? 1 : fraction

  return (
    <div className="mt-3 flex items-center gap-3">
      <div className="h-1.5 grow overflow-hidden rounded-sm bg-surface-2">
        <div
          className={`h-full rounded-sm ${TONE_FILL[tone]} transition-[width] ease-linear`}
          style={{
            width: `${filled * 100}%`,
            // Collapses to 1ms under prefers-reduced-motion, via the token.
            transitionDuration: 'var(--motion-slow)',
          }}
        />
      </div>
      <span
        className={`num shrink-0 text-xs ${
          tone === 'destructive'
            ? 'text-destructive'
            : tone === 'warning'
              ? 'text-warning'
              : 'text-foreground-muted'
        }`}
      >
        {countdownLabel(remaining)}
      </span>
    </div>
  )
}
