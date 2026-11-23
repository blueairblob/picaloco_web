import { createContext, useContext } from 'react'
import type { RoleStatus } from '@/lib/roles'

export type AdminSession = {
  status: RoleStatus
  email: string | null
  inTraining: boolean
  mustChangePassword: boolean
  signIn: (email: string, password: string) => Promise<string | null>
  signOut: () => Promise<void>
  // Re-runs my_role (e.g. after the first password is chosen, or a save says the role changed).
  refreshRole: () => void
}

// One shared session and my_role answer for the whole app: see AdminSessionProvider.
export const AdminSessionContext = createContext<AdminSession | null>(null)

export function useAdminSession(): AdminSession {
  const session = useContext(AdminSessionContext)
  if (!session) throw new Error('useAdminSession needs an AdminSessionProvider above it')
  return session
}
