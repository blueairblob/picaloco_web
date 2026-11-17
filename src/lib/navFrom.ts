// Where a page was opened from, carried in the router's location state so its back link can return
// there (e.g. Data Fixes opened from a Model check conflict shows "← Model check"). History state
// survives reloads and the browser's Back/Forward.

export interface NavFrom {
  path: string
  label: string
}

export function navFromState(path: string, label: string): { from: NavFrom } {
  return { from: { path, label } }
}

export function readNavFrom(state: unknown): NavFrom | null {
  const from = (state as { from?: unknown } | null | undefined)?.from as Partial<NavFrom> | undefined
  if (!from || typeof from.path !== 'string' || typeof from.label !== 'string' || !from.label) return null
  // Only a path on this site: never a full URL or a protocol-relative "//host".
  if (!from.path.startsWith('/') || from.path.startsWith('//')) return null
  return { path: from.path, label: from.label }
}
