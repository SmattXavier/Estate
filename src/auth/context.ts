import { createContext, useContext } from 'react'

export type Role = 'resident' | 'facility_manager' | 'ceo'

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
