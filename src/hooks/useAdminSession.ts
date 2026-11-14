import { useCallback, useEffect, useState } from 'react'
import { adminSupabase } from '@/lib/supabase/adminClient'

export type AdminStatus = 'loading' | 'signed-out' | 'not-admin' | 'admin'

export function adminStatusFrom(hasSession: boolean, isAdmin: boolean | null): AdminStatus {
  if (!hasSession) return 'signed-out'
  if (isAdmin === null) return 'loading'
  return isAdmin ? 'admin' : 'not-admin'
}

export function useAdminSession() {
  // undefined = session not read yet; null = signed out.
  const [userId, setUserId] = useState<string | null | undefined>(undefined)
  const [email, setEmail] = useState<string | null>(null)
  // Result of is_admin, tagged with the user it was fetched for so a stale answer is never reused.
  const [adminCheck, setAdminCheck] = useState<{ userId: string; isAdmin: boolean } | null>(null)

  useEffect(() => {
    const { data } = adminSupabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user.id ?? null)
      setEmail(session?.user.email ?? null)
      // Drop the cached answer on sign-out so the next sign-in re-checks is_admin.
      if (!session) setAdminCheck(null)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    adminSupabase
      .rpc('is_admin')
      .then(
        ({ data, error }) => !error && data === true,
        () => false,
      )
      .then((isAdmin) => {
        if (!cancelled) setAdminCheck({ userId, isAdmin })
      })
    return () => {
      cancelled = true
    }
  }, [userId])

  const isAdmin = adminCheck && adminCheck.userId === userId ? adminCheck.isAdmin : null

  const signIn = useCallback(async (emailInput: string, password: string) => {
    const { error } = await adminSupabase.auth.signInWithPassword({ email: emailInput, password })
    return error ? error.message : null
  }, [])

  const signOut = useCallback(async () => {
    await adminSupabase.auth.signOut()
  }, [])

  const status: AdminStatus = userId === undefined ? 'loading' : adminStatusFrom(!!userId, isAdmin)
  return { status, email, signIn, signOut }
}
