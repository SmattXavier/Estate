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

  return (
    <div className="mt-3 flex items-center gap-3">
      <div className="h-1.5 grow overflow-hidden rounded-sm bg-sunk">
        <div
          className={`h-full rounded-sm ${TONE_FILL[tone]} transition-[width] duration-1000 ease-linear`}
          style={{ width: `${fraction * 100}%` }}
        />
      </div>
      <span
        className={`num shrink-0 text-xs ${
          tone === 'red'
            ? 'text-red'
            : tone === 'amber'
              ? 'text-amber'
              : 'text-ink-soft'
        }`}
      >
        {countdownLabel(remaining)}
      </span>
    </div>
  )
}
