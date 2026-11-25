import { describe, expect, it } from 'vitest'
import { sidebarOpenFromCookie } from './sidebarCookie'

describe('sidebarOpenFromCookie', () => {
  it('is open when nothing is stored', () => {
    expect(sidebarOpenFromCookie('')).toBe(true)
    expect(sidebarOpenFromCookie('theme=dark')).toBe(true)
  })
  it('reads the stored state', () => {
    expect(sidebarOpenFromCookie('sidebar_state=false')).toBe(false)
    expect(sidebarOpenFromCookie('a=1; sidebar_state=true; b=2')).toBe(true)
    expect(sidebarOpenFromCookie('a=1; sidebar_state=false')).toBe(false)
  })
  it('ignores a look-alike name and an unreadable value', () => {
    expect(sidebarOpenFromCookie('old_sidebar_state=false')).toBe(true)
    expect(sidebarOpenFromCookie('sidebar_state=maybe')).toBe(true)
  })
})
