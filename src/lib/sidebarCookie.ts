// The cookie shadcn's SidebarProvider writes on every open or close (it never reads it back).
export const SIDEBAR_COOKIE = 'sidebar_state'

// Open unless the stored state says closed; anything unreadable counts as open.
export function sidebarOpenFromCookie(cookie: string): boolean {
  for (const part of cookie.split(';')) {
    const [name, value] = part.trim().split('=')
    if (name === SIDEBAR_COOKIE) return value !== 'false'
  }
  return true
}

// The remembered state, or open when cookies are blocked or unreadable.
export function readSidebarOpen(): boolean {
  try {
    return sidebarOpenFromCookie(document.cookie)
  } catch {
    return true
  }
}
