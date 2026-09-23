# Density and mobile scaling

Amendment to Phase 2 Stage D. **Presentation only** — no schema, no query or
RPC changes, no state logic, no routing changes.

Stage D tightened density globally. That was wrong: a facility manager
scanning forty cards on a 1440px monitor and a resident reading about a
burst pipe on a phone want opposite things. Density varies by surface and by
width.

## The rule

| | Phone, under 768px | Desktop, 1024px and up |
|---|---|---|
| Resident screens | Generous. Reading comfort wins. | Comfortable |
| Board and CEO | Comfortable, tap-safe | Dense — keep Stage D |

Tablet, 768–1023px, sits between the two.

## Phone — non-negotiable minimums

- **Every form input, select and textarea: font-size 16px minimum.** Below
  16px, iOS Safari force-zooms the page when the field is focused, which is
  almost certainly part of what currently reads as "poorly scaled". This is
  a hard floor, not a preference.
- **Every tappable thing: 44px minimum height.** Card toggles, priority
  buttons, tabs, nav links, the theme toggle, the chase button.
- **Text floors:** primary and status text 16px, supporting text 14px,
  refs and metadata 13px. Nothing below 13px on a phone.
- **Line-height 1.5** on any paragraph a person actually reads — the
  description, the status line, timeline entries.

## Resident cards on a phone — revert Stage D

Card padding back to roughly `px-4 py-4`, list gap back to `space-y-3`, and
the internal line spacing Stage D tightened restored. Four comfortable
cards beat six cramped ones on a screen someone is reading in a stairwell
with a leak at their feet.

The board and CEO screens may stay denser than this on a phone, since those
are used by staff scanning rather than residents reading — but the 44px tap
target and 13px text floors apply there too.

## Respect the system text size

Where a size is set in px purely for visual rhythm, prefer rem so that a
person who has enlarged text in their phone settings actually gets larger
text. Do not clamp the layout so tightly that a larger system font breaks
it — check one screen at 200% text size and say what happened.

## Verify, and say what you measured

At 390px, in both themes, on `/my/reports`, `/my/new`, `/board` and
`/overview`:

- the computed font-size of every input, select and textarea — list any
  under 16px
- the rendered height of every tappable element — list any under 44px
- the computed font-size of the smallest text on each screen
- no horizontal scroll at any width

Then take a screenshot of `/my/reports` and `/my/new` at 390px in both
themes so I can see the result rather than only the numbers.
