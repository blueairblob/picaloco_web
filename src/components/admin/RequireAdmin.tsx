import type { ReactNode } from 'react'
import { useAdminSession } from '@/hooks/useAdminSession'
import { SignInForm } from '@/components/admin/SignInForm'

const buttonClass =
  'rounded-lg border border-[var(--border)] px-3 py-1 text-sm text-[var(--foreground)] hover:text-[var(--accent)]'

export function RequireAdmin({ children }: { children: ReactNode }) {
  const { status, email, signIn, signOut } = useAdminSession()

  if (status === 'loading') {
    return <div className="p-10 text-center text-[var(--muted)]">Loading…</div>
  }

  if (status === 'signed-out') {
    return (
      <div className="flex flex-1 items-center px-6 py-10">
        <SignInForm onSignIn={signIn} />
      </div>
    )
  }

  if (status === 'not-admin') {
    return (
      <div className="mx-auto flex max-w-sm flex-1 flex-col items-center gap-4 px-6 py-10 text-center">
        <p className="text-[var(--foreground)]">This account isn't an admin.</p>
        <button type="button" onClick={signOut} className={buttonClass}>
          Sign out
        </button>
      </div>
    )
  }

  return (
    <>
      <div className="mx-auto flex w-full max-w-4xl items-center justify-end gap-3 px-6 pt-2 text-sm text-[var(--muted)]">
        <span>{email}</span>
        <button type="button" onClick={signOut} className={buttonClass}>
          Sign out
        </button>
      </div>
      {children}
    </>
  )
}
