import { useCallback, useSyncExternalStore } from 'react'

/**
 * A layout breakpoint as state, for the cases CSS cannot express: a screen
 * that renders genuinely different markup either side of a width, rather
 * than rendering both and hiding one.
 *
 * useSyncExternalStore rather than useState + useEffect — the first paint
 * already knows the width, so nothing flashes and no effect writes state.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = window.matchMedia(query)
      list.addEventListener('change', onChange)
      return () => list.removeEventListener('change', onChange)
    },
    [query],
  )

  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  )
}
