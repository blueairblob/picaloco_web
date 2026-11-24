export function shouldCloseOnRoute(prevPath: string, nextPath: string): boolean {
  return prevPath !== nextPath
}

const norm = (p: string) => p.replace(/\/+$/, '') || '/'

// Exact match, or a nested page under the item (never a look-alike prefix such as /admin/fixesx).
// '/' and '/admin' are exact-only: every page would otherwise count as inside them.
export function isCurrent(itemPath: string, pathname: string): boolean {
  const item = norm(itemPath)
  const path = norm(pathname)
  if (path === item) return true
  if (item === '/' || item === '/admin') return false
  return path.startsWith(item + '/')
}
