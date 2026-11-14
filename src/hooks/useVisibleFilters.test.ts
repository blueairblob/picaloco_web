import { describe, expect, it } from 'vitest'
import { migrateLegacy } from './useVisibleFilters'

describe('migrateLegacy', () => {
  it('appends locoName to a v1 list', () => {
    expect(migrateLegacy('["country","loco"]')).toEqual(['country', 'loco', 'locoName'])
  })
  it('does not duplicate locoName', () => {
    expect(migrateLegacy('["locoName"]')).toEqual(['locoName'])
  })
  it('returns null for missing or invalid input', () => {
    expect(migrateLegacy('junk')).toBeNull()
    expect(migrateLegacy(null)).toBeNull()
  })
})
