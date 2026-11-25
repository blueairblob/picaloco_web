import type { RoleStatus } from '@/lib/roles'

export type FooterAccount = { kind: 'signin' } | { kind: 'account'; email: string | null } | { kind: 'none' }

// The account line at the foot of the sidebar. Every signed-in state, 'error' included, keeps the
// email and Sign out; nothing shows while the role is still loading.
export function footerAccount(status: RoleStatus, email: string | null): FooterAccount {
  if (status === 'signed-out') return { kind: 'signin' }
  if (status === 'loading') return { kind: 'none' }
  return { kind: 'account', email }
}
