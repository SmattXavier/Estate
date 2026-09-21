# Dark theme — Graphite palette

Amendment to Phase 2 Stage A. **Change only the dark-mode block in
`src/theme.css`.** The light theme, every component, every token name and
every class stay exactly as they are. Stage A routed all colour through
tokens, so no component file should need editing — if one does, stop and
tell me which and why.

## Why

The current dark theme tints background, cards and borders the same
blue-green as the teal accent, so buttons and status colours have nothing to
stand apart from. Graphite is a neutral base: the only colour on screen is
colour that carries meaning — red for late, blue for someone on the way,
teal for the action to press.

## Values — dark mode only

| Token | Value |
|---|---|
| `--background` | `#111214` |
| `--card` | `#1A1B1E` |
| `--surface-2` | `#222327` |
| `--surface-3` | `#2A2C30` |
| `--border-subtle` | `#2C2E33` |
| `--border-strong` | `#3D4046` |
| `--foreground` | `#ECECEE` |
| `--foreground-muted` | `#A1A3A9` |
| `--foreground-faint` | `#84878F` |
| `--shell` | `#0B0B0D` |
| `--shell-foreground` | `#E4E4E7` |
| `--primary` | `#3FA3BD` (unchanged teal) |
| `--primary-hover` | `#57B6CE` |
| `--primary-foreground` | `#06212A` |
| `--success` | `#5FBE8C` |
| `--success-soft` | `#15271E` |
| `--warning` | `#E0A94A` |
| `--warning-soft` | `#2E2512` |
| `--destructive` | `#F07167` |
| `--destructive-soft` | `#33191A` |
| `--destructive-surface` | `#451A17` |
| `--destructive-on-surface` | `#F8DCD7` |
| `--info` | `#6BB3DE` |
| `--info-soft` | `#16242F` |

Soft backgrounds are deliberately neutral-leaning, not teal-tinted.

Shadows in dark mode: keep them, deepened to near-black, since elevation
barely reads on dark surfaces — the alert panel and expanded cards should
still lift slightly off the page.

## Verify

Re-run the contrast pass in dark mode on every screen and report measured
ratios for: body text, muted text, faint text (refs and metadata), status
chips, the countdown label, and the alert panel. Everything must reach
4.5:1. If `--foreground-faint` falls short on any surface it sits on, lift it
just enough to pass and tell me the value you used.

Take one dark-mode screenshot each of `/my`, `/board` and `/overview`.
