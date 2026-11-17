import { describe, expect, it } from 'vitest'
import { navFromState, readNavFrom } from './navFrom'

describe('readNavFrom', () => {
  it('reads where the page was opened from', () => {
    expect(readNavFrom(navFromState('/admin/model-check', 'Model check'))).toEqual({ path: '/admin/model-check', label: 'Model check' })
  })
  it('ignores missing or malformed state', () => {
    expect(readNavFrom(null)).toBeNull()
    expect(readNavFrom(undefined)).toBeNull()
    expect(readNavFrom({})).toBeNull()
    expect(readNavFrom({ from: { path: 3, label: 'x' } })).toBeNull()
    expect(readNavFrom({ from: { path: '/admin/x', label: '' } })).toBeNull()
  })
  it('only returns to a page of this site', () => {
    expect(readNavFrom({ from: { path: 'https://evil.example', label: 'x' } })).toBeNull()
    expect(readNavFrom({ from: { path: '//evil.example', label: 'x' } })).toBeNull()
    expect(readNavFrom({ from: { path: '/admin/model-check?run=1', label: 'Model check' } })?.path).toBe('/admin/model-check?run=1')
  })
})
