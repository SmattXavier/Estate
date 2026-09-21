import { useCallback, useSyncExternalStore } from 'react'

export type Theme = 'light' | 'dark'

const KEY = 'estate-theme'
const listeners = new Set<() => void>()

/**
 * The DOM is the source of truth: the inline script in index.html has
 * already resolved saved-choice-then-system and stamped the class before
 * React mounts, so reading the class avoids a second, disagreeing answer.
 */
function current(): Theme {
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light'
}

export function setTheme(next: Theme) {
  document.documentElement.classList.toggle('dark', next === 'dark')
  try {
    localStorage.setItem(KEY, next)
  } catch {
    // Private mode. The class still applied; only the memory is lost.
  }
  listeners.forEach((notify) => notify())
}

export function useTheme() {
  const subscribe = useCallback((notify: () => void) => {
    listeners.add(notify)
    return () => {
      listeners.delete(notify)
    }
  }, [])

  const theme = useSyncExternalStore(subscribe, current, () => 'light' as Theme)

  return {
    theme,
    setTheme,
    toggle: () => setTheme(theme === 'dark' ? 'light' : 'dark'),
  }
}
