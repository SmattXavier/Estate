import { useEffect, useState } from 'react'
import Bar from './Bar'
import {
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
    <Bar fraction={filled} tone={tone} animate label={countdownLabel(remaining)} />
  )
}
