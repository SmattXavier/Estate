# Phase 2 — App shell and two authored themes

Read CLAUDE.md and docs/STATES.md before starting.

This replaces the earlier Phase 2 plan. Stage 1 of that plan (full-bleed
headers) stays. Do not do the earlier Stage 2 (tokens) as it was written.

## Direction

A proper app shell, matching the structure of my other production app:
full-viewport layout with sidebar navigation, separate routes per page, and
two authored themes.

**Presentation and routing only.** No schema changes, no query or RPC
changes, no state logic changes.

Four stages. **Stop after each stage, list what changed, and wait for my
approval before starting the next.**

---

## Stage A — Theme system

Rebuild `src/theme.css` as two independently authored modes, light and dark.
Dark is authored on its own — it is **not** a filter, inversion, or opacity
trick applied over light.

- Tailwind `darkMode: 'class'`, toggled by `class="dark"` on `<html>`.
- Preference persisted in localStorage.
- `prefers-color-scheme` respected on first visit, when nothing is saved.
- An inline script in `index.html` applies the saved theme before first
  paint, so there is no flash of the wrong theme on load.

Token families:

- Surfaces: `--background`, `--foreground`, `--card`, `--surface-2`, `--surface-3`
- Borders: `--border-subtle`, `--border-strong`
- Brand: `--primary` — keep the existing teal
- Status: `--success`, `--warning`, `--info`, `--destructive`
- Elevation: `--shadow-e1`, `--shadow-e2`, `--shadow-e3`
- Motion: duration and easing tokens, all collapsing to 1ms under
  `@media (prefers-reduced-motion: reduce)`

Countdown bars, status chips and the CEO alert panel must read correctly in
**both** modes.

Replace every raw colour in components with a semantic token. No hex values
and no raw Tailwind palette classes (`text-red-600`, `bg-emerald-50` etc.)
may remain in components.

Type: switch to **IBM Plex Sans** (400 / 500 / 600) for all text, and
**IBM Plex Mono** (400 / 500) for refs, clocks, countdowns, counts and money.

Before writing any code for Stage A, list the files you plan to create or
modify and wait for my confirmation.

---

## Stage B — The shell

One shared layout used by every signed-in role.

**Desktop, 1024px and up:**
- Fixed left sidebar.
- Estate name at the top.
- Role-specific nav links, with an active rail marking the current page.
- At the bottom: the theme toggle, the signed-in person's name and role,
  and sign-out.
- Content fills the rest of the viewport. The page itself has **no** centred
  max-width column. Wide content such as tables may cap their own width.

**Below 1024px:**
- The sidebar becomes an off-canvas drawer.
- A slim top bar carries the page title and a menu button that opens it.

**Navigation per role**, built from a single config file so later phases
only need to add entries:

- Resident: Report a fault, My reports
- Facility manager: Dispatch board, Artisans
- CEO: Overview

---

## Stage C — Split the resident screen, move everything into the shell

Resident:

- `/my/new` — the report form alone, as a full page. On successful submit,
  navigate to `/my/reports` with the new report highlighted.
- `/my/reports` — the reports list alone, as a full page, keeping the
  existing expand-in-place timeline and confirm / reopen behaviour.
- `/my` redirects to `/my/reports`.
- Remove the tabs and the two-column layout completely.

Everything else:

- `/board`, the artisan directory and `/overview` move inside the shell.
- The board's dark rail is replaced by the shell sidebar. Its live counts
  move to a summary strip at the top of the board content.

---

## Stage D — Density, states, verification

- Tighten card padding and line spacing so more items fit on screen without
  looking crowded.
- Countdowns under one minute read "under a minute", never "0 min".
- One shared loading skeleton component.
- Every list and table gets a real empty-state sentence saying what would
  appear there.
- Query errors show a visible message, never a blank area.

Then run the headless Chrome harness at **390, 768 and 1440**, in **both
light and dark mode**, on every page. Report measured results, including
anything you could not check.

---

## Finally — update CLAUDE.md

- Replace the resident layout rule with the two-route structure described in
  Stage C.
- Add a **Visual Direction** section describing the shell, the two authored
  modes, and the token families.
- Keep the resident plain-language rule exactly as it is: the resident
  screens never say SLA, ticket, escalate or dispatch.
