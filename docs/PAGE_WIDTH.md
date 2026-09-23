# Page width on wide screens

Amendment. **Presentation only** — no schema, no query or RPC changes, no
state logic, no routing changes.

## The problem

Inside the shell, pages carry a centred max-width cap. On a 1440px screen
that reads fine. On a wider one it reads as: sidebar, large empty gutter,
narrow column, large empty gutter. The app looks unfinished rather than
spacious.

This was measured at 1440 in Stage B and passed. Measure the widths below
instead.

## The rule

The main area is the viewport minus the sidebar. Content **fills it**, with
padding rather than a centred cap:

- Padding: 24px at all widths, 32px from 1280px up.
- **No centred max-width wrapper on list, board or table pages.** Cards,
  lanes and tables use the width they are given.
- A reading cap belongs on *prose*, not on pages: apply `max-w-prose` (about
  65 characters) to paragraphs a person reads in sequence — an issue
  description, a timeline entry — so long lines don't become unreadable.
  Everything else fills.

## Forms are the exception

A form field 1200px wide is worse than one 600px wide. On `/my/new`:

- Below 1280px: the form fills the content area as it does now.
- From 1280px: the form is capped at 640px and sits at the **left** of the
  content area, not centred. Beside it, in the space that frees up, a
  context panel headed "What happens next" giving three short lines in
  resident language: that the estate office sees it immediately, that the
  time shown against the urgency they pick is when someone should be on
  their way, and that they can follow it under "My reports". Card styling,
  `--surface-2`, no colour.

That panel is not decoration — it answers the question every resident has
when reporting a fault, and it is why the page no longer needs empty space
to breathe.

Apply the same shape to any future form page: capped form on the left,
useful context beside it, never a narrow column floating in the middle.

## Lists on very wide screens

From 1536px, `/my/reports` becomes a two-column card grid. Below that it
stays one column. The board already has three lanes and the CEO table
already fills, so neither changes.

## Verify

Load `/my/reports`, `/my/new`, `/board` and `/overview` at **1280, 1440,
1920 and 2560**, in both themes, and report for each: the left gutter
between the sidebar and the content, the content width, and the right
gutter. A gutter wider than the padding on either side is a failure.

Then confirm 390 and 768 are unchanged from the density pass — this
amendment must not touch phone layout.

Take one screenshot of `/my/new` and one of `/my/reports` at 1920 in dark
mode.
