import { describe, expect, it } from 'vitest'
import { isCurrent, shouldCloseOnRoute } from './menuPanel'

describe('shouldCloseOnRoute', () => {
  it('is false for the same path and true for a different one', () => {
    expect(shouldCloseOnRoute('/admin', '/admin')).toBe(false)
    expect(shouldCloseOnRoute('/admin', '/admin/fixes')).toBe(true)
  })
  it('is true when only the query string changes', () => {
    expect(shouldCloseOnRoute('/?q=a', '/?q=b')).toBe(true)
  })
})

describe('isCurrent', () => {
  it('matches exactly, ignoring a trailing slash', () => {
    expect(isCurrent('/admin/fixes', '/admin/fixes')).toBe(true)
    expect(isCurrent('/admin/fixes', '/admin/fixes/')).toBe(true)
  })
  it('matches nested pages', () => {
    expect(isCurrent('/admin/fixes', '/admin/fixes/abc')).toBe(true)
  })
  it('rejects look-alike prefixes and other pages', () => {
    expect(isCurrent('/admin/fixes', '/admin/fixesx')).toBe(false)
    expect(isCurrent('/admin/fixes', '/admin/model-check')).toBe(false)
  })
  it('keeps / and /admin exact so they do not light up everywhere', () => {
    expect(isCurrent('/', '/')).toBe(true)
    expect(isCurrent('/', '/admin')).toBe(false)
    expect(isCurrent('/admin', '/admin/fixes')).toBe(false)
  })
})
