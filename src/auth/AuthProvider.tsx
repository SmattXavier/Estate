import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { AuthContext } from './context'
import type { AuthValue, Profile } from './context'

/** What we know about the profile of one particular user id. */
type Resolved = { userId: string; profile: Profile | null }

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [sessionReady, setSessionReady] = useState(false)
  const [resolved, setResolved] = useState<Resolved | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Session only. Never touch the database from inside onAuthStateChange:
  // supabase-js holds an internal lock for the duration of the callback and
  // an await in here can hang with no error and no timeout.
  useEffect(() => {
    let cancelled = false

    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return
      setSession(data.session)
      setSessionReady(true)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
      setSessionReady(true)
    })

    return () => {
      cancelled = true
      sub.subscription.unsubscribe()
    }
  }, [])

  // The profile read lives here, keyed on the user id, well clear of the lock.
  const userId = session?.user.id

  useEffect(() => {
    if (!userId) return

    let cancelled = false

    void (async () => {
      const { data, error: selectError } = await supabase
        .from('profiles')
        .select('id, full_name, role, estate_id')
        .eq('id', userId)
        .maybeSingle()

      if (cancelled) return

      // Either way the gate opens: a failure here must show the sign-in page
      // with a reason, never a blank screen that waits forever.
      if (selectError || !data) {
        setResolved({ userId, profile: null })
        setError(
          selectError
            ? `Could not load your account: ${selectError.message}`
            : 'That sign-in worked, but this account is not set up on the estate yet.',
        )
        void supabase.auth.signOut()
        return
      }

      setResolved({ userId, profile: data as Profile })
      setError(null)
    })()

    return () => {
      cancelled = true
    }
  }, [userId])

  // Anything we know about a previous user id does not count for this one.
  const matched = resolved?.userId === userId ? resolved : null
  const profileReady = !userId || matched !== null

  const signIn = useCallback(async (email: string, password: string) => {
    setError(null)
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    // On success onAuthStateChange delivers the session and the profile
    // effect takes over; nothing to do here.
    if (signInError) setError(signInError.message)
  }, [])

  const signOut = useCallback(async () => {
    setError(null)
    await supabase.auth.signOut()
  }, [])

  const value = useMemo<AuthValue>(
    () => ({
      profile: matched?.profile ?? null,
      loading: !sessionReady || !profileReady,
      error,
      signIn,
      signOut,
    }),
    [matched, sessionReady, profileReady, error, signIn, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
