import { createContext, useContext } from 'react'

/**
 * Every role the database can hand back. security and artisan have real
 * accounts in the seed, so leaving them out of this union did not stop them
 * signing in — it only stopped the app knowing where to put them.
 */
export type Role =
  | 'resident'
  | 'facility_manager'
  | 'ceo'
  | 'security'
  | 'artisan'

export type Profile = {
  id: string
  full_name: string
  role: Role
  estate_id: string
}

export type AuthValue = {
  profile: Profile | null
  /** True only while we do not yet know whether there is a usable profile. */
  loading: boolean
  /** Set when sign-in failed, or when a session exists but its profile does not. */
  error: string | null
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthValue | null>(null)

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside AuthProvider')
  return value
}
