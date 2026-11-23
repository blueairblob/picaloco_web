import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { adminSupabase } from '@/lib/supabase/adminClient'
import { roleFor, roleStatusFrom, type MyRole, type RoleCheck, type RoleStatus } from '@/lib/roles'
import { AdminSessionContext, type AdminSession } from '@/hooks/useAdminSession'

// Mounted once (App): owns the one auth subscription and the one my_role call that every
// useAdminSession() reads, so pages, guards and cards always agree on the role.
export function AdminSessionProvider({ children }: { children: ReactNode }) {
  // undefined = session not read yet; null = signed out.
  const [userId, setUserId] = useState<string | null | undefined>(undefined)
  const [email, setEmail] = useState<string | null>(null)
  // Result of my_role, tagged with the user it was fetched for so a stale answer is never reused.
  const [roleCheck, setRoleCheck] = useState<RoleCheck | null>(null)
  const [refreshCount, setRefreshCount] = useState(0)

  useEffect(() => {
    const { data } = adminSupabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user.id ?? null)
      setEmail(session?.user.email ?? null)
      // Drop the cached answer on sign-out so the next sign-in re-checks the role.
      if (!session) setRoleCheck(null)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    adminSupabase
      .rpc('my_role')
      .then(
        ({ data, error }) => (error ? null : ((data as MyRole | null) ?? null)),
        () => null,
      )
      .then((role) => {
        if (!cancelled) setRoleCheck({ userId, role })
      })
    return () => {
      cancelled = true
    }
  }, [userId, refreshCount])

  const signIn = useCallback(async (emailInput: string, password: string) => {
    const { error } = await adminSupabase.auth.signInWithPassword({ email: emailInput, password })
    return error ? error.message : null
  }, [])

  const signOut = useCallback(async () => {
    await adminSupabase.auth.signOut()
  }, [])

  // A refresh keeps the current answer until the new one arrives, so pages stay mounted.
  const refreshRole = useCallback(() => setRefreshCount((n) => n + 1), [])

  const myRole = roleFor(roleCheck, userId)
  const status: RoleStatus = userId === undefined ? 'loading' : roleStatusFrom(!!userId, myRole)
  const inTraining = myRole?.in_training === true
  const mustChangePassword = myRole?.must_change_password === true
  const value = useMemo<AdminSession>(
    () => ({ status, email, inTraining, mustChangePassword, signIn, signOut, refreshRole }),
    [status, email, inTraining, mustChangePassword, signIn, signOut, refreshRole],
  )
  return <AdminSessionContext.Provider value={value}>{children}</AdminSessionContext.Provider>
}
