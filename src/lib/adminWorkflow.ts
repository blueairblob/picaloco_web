// The admin pages, in the order the data flows through them: it arrives from FileMaker, rules pull
// loco numbers and names out of descriptions, then the photo AI's guesses are checked.
export type AdminStep = { label: string; hint: string; path: string }

export const ADMIN_STEPS: readonly AdminStep[] = [
  { label: 'Migration status', hint: 'data in from FileMaker', path: '/admin' },
  { label: 'Data fixes', hint: 'numbers & names from descriptions', path: '/admin/fixes' },
  { label: 'Model check', hint: "AI's photo guesses", path: '/admin/model-check' },
]

// Index of the step a page belongs to (a review page counts as its step), or -1 outside admin.
export function currentAdminStep(pathname: string): number {
  const path = pathname.replace(/\/+$/, '') || '/'
  for (let i = ADMIN_STEPS.length - 1; i >= 1; i--) {
    const p = ADMIN_STEPS[i].path
    if (path === p || path.startsWith(p + '/')) return i
  }
  return path === ADMIN_STEPS[0].path ? 0 : -1
}
