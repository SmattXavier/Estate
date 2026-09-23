# Phase 4 — Access control

Read CLAUDE.md, docs/STATES.md, docs/DENSITY.md and docs/PAGE_WIDTH.md first.

Two new routes, one new role in the shell. **No schema changes** — everything
here is built and verified by `supabase/tests/phase2_lifecycle.sql`,
section C.

Stop after each stage and report.

## What exists already

Tables: `visitor_passes`, `gate_events`.

RPCs:

- `create_visitor_pass(unit_id, visitor_name, visitor_phone, purpose, vehicle_plate, hours_valid)` — resident only, own unit, 1–168 hours
- `revoke_visitor_pass(pass_id)` — only the resident who created it
- `verify_pass(code)` — **read-only**, returns one row: `pass_id`, `code`,
  `visitor_name`, `visitor_phone`, `purpose`, `vehicle_plate`, `unit_label`,
  `resident_name`, `resident_phone`, `valid_until`, `verdict`
- `record_gate_event(code, direction, lat, lng, accuracy, note)` — security
  or manager; `direction` is `in` or `out`

`verdict` is one of: `valid`, `revoked`, `already used`, `expired`,
`not valid yet`. Codes are six characters with no 0, O, 1, I or L, and the
RPC accepts them in any case with surrounding whitespace.

## Expiry is derived, never stored

A pass row can read `status = 'active'` while being long expired — expiry is
`valid_until < now()`, worked out at read time. Nothing writes an expired
status and no scheduled job is involved.

**So never show a pass's stored status directly.** Compute what to display:
revoked, used, expired, or active. A pass that looks active in the table but
would be refused at the gate is the bug this rule prevents.

## Stage 1 — The resident's visitor passes

Route `/my/visitors`, nav entry "Visitors", below "Service charge".

**Create a pass.** Form: which flat (their units), visitor's name, phone
(optional), what they are coming for (optional), vehicle plate (optional,
upper-cased by the server), and how long the pass should last — offer a few
plain choices rather than a number field: "Today only" (12 hours), "24
hours", "3 days", "A week". Calls `create_visitor_pass`.

**The code is the product.** After creating, show it large, in the mono
face, with generous letter spacing so it can be read aloud over a bad phone
line. A copy button. A "Send on WhatsApp" link opening
`https://wa.me/?text=` with a short pre-filled message giving the visitor
their code, the estate name and when it expires — that is how a resident in
Abuja will actually pass this on.

**Their passes.** Newest first: visitor name, code, what for, vehicle,
valid until, and the derived state. An active pass gets a revoke button
calling `revoke_visitor_pass`. Under a used pass, its gate events: arrived
at, left at.

Query with an explicit `.eq('created_by', profile.id)` (Rule 13).

Plain language throughout — this is a resident screen. No "pass status", no
"gate event". Say "Chinedu came in at 4:12pm".

## Stage 2 — The gate screen

Route `/gate`, for the `security` role. Nav entries: "Gate" and "Today".

This is used standing at a barrier, on a phone, at night, often one-handed.
Design for that before anything else: a single large code field, autofocused,
uppercase, numeric-and-letter keyboard, and one large button. Nothing else
above the fold.

**Verify, then admit — two steps, not one.** Submitting the code calls
`verify_pass` only. Show the result as a card: visitor name, what for,
vehicle plate if any, the flat, the resident's name and phone, and the
verdict stated plainly — "Let them in", or "Do not let them in: this pass
expired at 9:40pm". Green for valid, red otherwise, using the semantic
tokens.

Only then, on a valid pass, a "Log the arrival" button calling
`record_gate_event` with direction `in`. A second button logs `out`.

Verification never consumes a pass, so a gateman can check the same code
twice. Do not add a confirmation dialog — it is one more tap at a barrier
with a car waiting.

**Location.** Before calling `record_gate_event`, ask for the device
position with `navigator.geolocation.getCurrentPosition`, a 10-second
timeout, and pass `lat`, `lng` and `accuracy` through.

**If the person denies permission or it times out, log the event anyway with
nulls.** The RPC accepts them and simply records no proof. Never block
admitting a visitor because a phone could not get a fix — but show a small
line saying the location was not recorded, so the manager can see which
entries carry evidence and which do not.

Geolocation needs a secure context. It works on the deployed HTTPS site and
on localhost, and fails silently over a local IP — test on the Vercel URL,
not on a phone pointed at your laptop.

**"Today"** at `/gate/today`: the estate's gate events for the last 24
hours, newest first — visitor, flat, in or out, the time, who logged it, and
whether it carries a location. Plain list.

## The shell gains a role

`security` needs adding to the nav config and to sign-in routing:
`security → /gate`. Use `RequireRole` as the other routes do.

**Check what happens when the artisan account signs in.** That role has no
screens until Phase 5, and it must not land on a blank shell or an error —
if it does, say so and I will decide what to do rather than you inventing a
page.

## Rules that still apply

- Writes through RPCs only.
- Every colour a semantic token. Zero hex, zero raw palette classes.
- Loading, empty and error states on every query, from
  `src/components/States.tsx`.
- Phone floors from docs/DENSITY.md — and on the gate screen exceed them:
  the code field and the main button should be comfortably larger than 44px.
- Page width rules from docs/PAGE_WIDTH.md. The gate screen is the one place
  a narrow centred column is right: cap it around 560px so the code field
  stays reachable with a thumb.

## Verify

At 390, 768 and 1440 in both themes: no horizontal scroll, inputs at 16px or
above, tap targets at 44px or above.

Then, against the database: create a pass through the UI and confirm the row
exists; verify the seeded active code `K7M2QF` and confirm the verdict reads
valid; verify the seeded expired code `H8N3PW` and confirm it reads expired
even though its stored status is still `active` — that is the derived-expiry
rule, and it is the check most likely to catch a real mistake.
