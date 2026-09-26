export type Fix = { lat: number; lng: number; accuracy: number } | null

/**
 * A position, or nothing. This never rejects.
 *
 * At a barrier with a car waiting, a refused permission or a slow fix must
 * not stop a visitor being admitted — record_gate_event takes nulls and
 * simply records no proof. Callers get a Fix or null and carry on either
 * way.
 *
 * Geolocation needs a secure context: it works on the deployed HTTPS site
 * and on localhost, and fails on a bare LAN address — which lands here as
 * null, the same as a refusal.
 */
export function getPosition(timeoutMs = 10_000): Promise<Fix> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    return Promise.resolve(null)
  }

  return new Promise<Fix>((resolve) => {
    let settled = false
    const finish = (fix: Fix) => {
      if (settled) return
      settled = true
      resolve(fix)
    }

    // A belt-and-braces timer: some browsers honour the option late or not
    // at all, and a promise that never settles would hang the button.
    const timer = setTimeout(() => finish(null), timeoutMs + 500)

    navigator.geolocation.getCurrentPosition(
      (position) => {
        clearTimeout(timer)
        finish({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
        })
      },
      () => {
        clearTimeout(timer)
        finish(null)
      },
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 0 },
    )
  })
}
