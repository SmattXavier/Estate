import { useTheme } from '../lib/theme'

/** Two labelled halves rather than an icon: the current mode is readable. */
export default function ThemeToggle() {
  const { theme, setTheme } = useTheme()

  return (
    <div
      role="group"
      aria-label="Colour theme"
      className="flex rounded-sm border border-shell-foreground/20 p-0.5"
    >
      {(['light', 'dark'] as const).map((mode) => (
        <button
          key={mode}
          type="button"
          onClick={() => setTheme(mode)}
          aria-pressed={theme === mode}
          className={`grow rounded-sm px-2 py-1 text-xs capitalize ${
            theme === mode
              ? 'bg-shell-foreground/15 text-shell-foreground'
              : 'text-shell-foreground/60 hover:text-shell-foreground'
          }`}
        >
          {mode}
        </button>
      ))}
    </div>
  )
}
