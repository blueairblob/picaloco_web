import type { ReactNode } from 'react'
import { useAdminSession } from '@/hooks/useAdminSession'
import { SignInForm } from '@/components/admin/SignInForm'
import { ChoosePasswordForm } from '@/components/admin/ChoosePasswordForm'

const buttonClass =
  'rounded-lg border border-[var(--border)] px-3 py-1 text-sm text-[var(--foreground)] hover:text-[var(--accent)]'

export function RequireAdmin({ children, allowVolunteers = false }: { children: ReactNode; allowVolunteers?: boolean }) {
  const { status, mustChangePassword, signIn, signOut, refreshRole } = useAdminSession()

  if (status === 'loading') {
    return <div className="p-10 text-center text-[var(--muted)]">Loading…</div>
  }

  if (status === 'error') {
    return (
      <div className="mx-auto flex max-w-sm flex-1 flex-col items-center gap-4 px-6 py-10 text-center">
        <p className="text-[var(--foreground)]">Couldn't check your account. Try again.</p>
        <button type="button" onClick={refreshRole} className={buttonClass}>
          Try again
        </button>
        <button type="button" onClick={signOut} className={buttonClass}>
          Sign out
        </button>
      </div>
    )
  }

  if (status === 'signed-out') {
    return (
      <div className="flex flex-1 items-center px-6 py-10">
        <SignInForm onSignIn={signIn} />
      </div>
    )
  }

  if (status === 'volunteer' && mustChangePassword) {
    return (
      <div className="flex flex-1 items-center px-6 py-10">
        <ChoosePasswordForm onDone={refreshRole} />
      </div>
    )
  }

  if (status === 'no-access' || (status === 'volunteer' && !allowVolunteers)) {
    return (
      <div className="mx-auto flex max-w-sm flex-1 flex-col items-center gap-4 px-6 py-10 text-center">
        <p className="text-[var(--foreground)]">{status === 'volunteer' ? 'This page is for admins.' : "This account doesn't have access."}</p>
        <button type="button" onClick={signOut} className={buttonClass}>
          Sign out
        </button>
      </div>
    )
  }

  // Signed-in email and Sign out live in the header menu.
  return <>{children}</>
}
