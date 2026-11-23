import { ADMIN_STEPS } from '@/lib/adminWorkflow'

export type RoleStatus = 'loading' | 'signed-out' | 'no-access' | 'admin' | 'volunteer'

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

// myRole: undefined = my_role not answered yet; null or role null = signed in with no access.
export function roleStatusFrom(hasSession: boolean, myRole: MyRole | null | undefined): RoleStatus {
  if (!hasSession) return 'signed-out'
  if (myRole === undefined) return 'loading'
  if (myRole === null || myRole.role === null) return 'no-access'
  return myRole.role
}

// A my_role answer, tagged with the user it was fetched for.
export type RoleCheck = { userId: string; role: MyRole | null }

// The my_role answer for this user, or undefined while it isn't in: an answer fetched for an
// earlier user is never reused.
export function roleFor(check: RoleCheck | null, userId: string | null | undefined): MyRole | null | undefined {
  return userId && check && check.userId === userId ? check.role : undefined
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
