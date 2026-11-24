import { ADMIN_STEPS } from '@/lib/adminWorkflow'

export type RoleStatus = 'loading' | 'signed-out' | 'no-access' | 'error' | 'admin' | 'volunteer'

export type MyRole = {
  role: 'admin' | 'volunteer' | null
  in_training: boolean | null
  must_change_password: boolean | null
}

export type MenuSection = {
  title: string
  items: { label: string; hint?: string; path: string }[]
  // A plain line shown under the items (not a link).
  note?: string
}

// What my_role gave: an answer, "no answer yet" (undefined), or 'error' (the call failed, nothing known).
export type RoleAnswer = MyRole | null | undefined | 'error'

// myRole: undefined = not answered yet; null or role null = signed in with no access;
// 'error' = the call failed with no earlier answer to fall back on.
export function roleStatusFrom(hasSession: boolean, myRole: RoleAnswer): RoleStatus {
  if (!hasSession) return 'signed-out'
  if (myRole === undefined) return 'loading'
  if (myRole === 'error') return 'error'
  if (myRole === null || myRole.role === null) return 'no-access'
  return myRole.role
}

// A my_role answer, tagged with the user it was fetched for.
export type RoleCheck = { userId: string; role: MyRole | null | 'error' }

// The my_role answer for this user, or undefined while it isn't in: an answer fetched for an
// earlier user is never reused.
export function roleFor(check: RoleCheck | null, userId: string | null | undefined): RoleAnswer {
  return userId && check && check.userId === userId ? check.role : undefined
}

// Folds a finished my_role call into the stored check. Only a successful answer replaces a
// previous answer for the same user; a failed refresh keeps it, so a network blip never turns a
// working volunteer into "no access". With nothing to keep, a failure is an 'error' state.
export function nextRoleCheck(
  prev: RoleCheck | null,
  userId: string,
  result: { ok: true; role: MyRole | null } | { ok: false },
): RoleCheck {
  if (result.ok) return { userId, role: result.role }
  if (prev && prev.userId === userId && prev.role !== 'error') return prev
  return { userId, role: 'error' }
}

// True when the signed-in user differs from the last one seen (sign-out, sign-in, switch).
// undefined = nothing seen yet, so the first read is not a change. A token refresh keeps the id.
export function userChanged(prev: string | null | undefined, next: string | null): boolean {
  return prev !== undefined && prev !== next
}

// The Model check overview's confusion table and conflicts come from
// admin-only RPCs: load and show them for admins only.
export function showAdminAnalysis(status: RoleStatus): boolean {
  return status === 'admin'
}

const VOLUNTEER_PATHS = ['/admin/fixes', '/admin/model-check']

export function menuSections(status: RoleStatus, inTraining: boolean): MenuSection[] {
  if (status === 'admin') {
    return [
      { title: 'Archive workflow', items: ADMIN_STEPS.map(({ label, hint, path }) => ({ label, hint, path })) },
      {
        title: 'People',
        items: [
          { label: 'Volunteers', path: '/admin/volunteers' },
          { label: 'Approvals', path: '/admin/approvals' },
          { label: 'Changes', path: '/admin/changes' },
        ],
      },
    ]
  }
  if (status === 'volunteer') {
    const section: MenuSection = {
      title: 'Archive workflow',
      items: ADMIN_STEPS.filter((s) => VOLUNTEER_PATHS.includes(s.path)).map(({ label, hint, path }) => ({ label, hint, path })),
    }
    if (inTraining) section.note = 'In training: your answers are checked before they count'
    return [section]
  }
  return []
}
