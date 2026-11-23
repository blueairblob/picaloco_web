import { useCallback, useEffect, useState } from 'react'
import { adminSupabase } from '@/lib/supabase/adminClient'
import { roleStatusFrom, type MyRole, type RoleStatus } from '@/lib/roles'

export function useAdminSession() {
  // undefined = session not read yet; null = signed out.
  const [userId, setUserId] = useState<string | null | undefined>(undefined)
  const [email, setEmail] = useState<string | null>(null)
  // Result of my_role, tagged with the user it was fetched for so a stale answer is never reused.
  const [roleCheck, setRoleCheck] = useState<{ userId: string; role: MyRole | null } | null>(null)
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

  const myRole = roleCheck && roleCheck.userId === userId ? roleCheck.role : undefined

  const signIn = useCallback(async (emailInput: string, password: string) => {
    const { error } = await adminSupabase.auth.signInWithPassword({ email: emailInput, password })
    return error ? error.message : null
  }, [])

  const signOut = useCallback(async () => {
    await adminSupabase.auth.signOut()
  }, [])

  // Re-runs my_role (e.g. after the first password is chosen).
  const refreshRole = useCallback(() => setRefreshCount((n) => n + 1), [])

  const status: RoleStatus = userId === undefined ? 'loading' : roleStatusFrom(!!userId, myRole)
  return {
    status,
    email,
    inTraining: myRole?.in_training === true,
    mustChangePassword: myRole?.must_change_password === true,
    signIn,
    signOut,
    refreshRole,
  }
}
