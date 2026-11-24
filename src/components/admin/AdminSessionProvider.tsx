import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { adminSupabase } from '@/lib/supabase/adminClient'
import { nextRoleCheck, roleFor, roleStatusFrom, userChanged, type MyRole, type RoleCheck, type RoleStatus } from '@/lib/roles'
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
  const queryClient = useQueryClient()
  const lastUserId = useRef<string | null | undefined>(undefined)

  useEffect(() => {
    const { data } = adminSupabase.auth.onAuthStateChange((_event, session) => {
      const next = session?.user.id ?? null
      // Cached queries aren't keyed by user: drop them all when the user changes.
      if (userChanged(lastUserId.current, next)) queryClient.clear()
      lastUserId.current = next
      setUserId(next)
      setEmail(session?.user.email ?? null)
      // Drop the cached answer on sign-out so the next sign-in re-checks the role.
      if (!session) setRoleCheck(null)
    })
    return () => data.subscription.unsubscribe()
  }, [queryClient])

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    adminSupabase
      .rpc('my_role')
      .then(
        ({ data, error }) =>
          error ? ({ ok: false } as const) : ({ ok: true, role: (data as MyRole | null) ?? null } as const),
        () => ({ ok: false }) as const,
      )
      .then((result) => {
        if (!cancelled) setRoleCheck((prev) => nextRoleCheck(prev, userId, result))
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
  const roleObj = myRole && myRole !== 'error' ? myRole : null
  const inTraining = roleObj?.in_training === true
  const mustChangePassword = roleObj?.must_change_password === true
  const value = useMemo<AdminSession>(
    () => ({ status, email, inTraining, mustChangePassword, signIn, signOut, refreshRole }),
    [status, email, inTraining, mustChangePassword, signIn, signOut, refreshRole],
  )
  return <AdminSessionContext.Provider value={value}>{children}</AdminSessionContext.Provider>
}
