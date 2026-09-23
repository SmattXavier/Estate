import type { Tone } from './issues'

export type PassState = 'revoked' | 'used' | 'expired' | 'active'

export type Pass = {
  id: string
  code: string
  unit_id: string
  visitor_name: string
  visitor_phone: string | null
  purpose: string | null
  vehicle_plate: string | null
  valid_from: string
  valid_until: string
  status: string
  created_at: string
}

export type GateEvent = {
  id: string
  pass_id: string | null
  direction: 'in' | 'out'
  recorded_at: string
  recorded_name: string
  lat: number | string | null
}

/**
 * What the pass really is, right now.
 *
 * Expiry is never stored: a row can read status 'active' while being long
 * past valid_until — the seed has exactly that case — so the stored column
 * is only ever half the answer. This mirrors the CASE in verify_pass, in
 * the same order, so the screen and the gate cannot disagree.
 *
 * 'not valid yet' exists in the RPC but not here: create_visitor_pass sets
 * valid_from to now(), so a resident can never hold a future-dated pass.
 */
export function passState(
  pass: Pick<Pass, 'status' | 'valid_until'>,
  now: number = Date.now(),
): PassState {
  if (pass.status === 'revoked') return 'revoked'
  if (pass.status === 'used') return 'used'
  if (new Date(pass.valid_until).getTime() < now) return 'expired'
  return 'active'
}

/** Only a working pass is coloured. The rest are simply over. */
export const PASS_TONE: Record<PassState, Tone> = {
  active: 'success',
  used: 'neutral',
  expired: 'neutral',
  revoked: 'neutral',
}
