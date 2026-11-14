import { describe, expect, it } from 'vitest'
import { locoNameTerms, locoNumberOrFilter } from './catalogService'

describe('locoNumberOrFilter', () => {
  it('matches the extracted field, falling back to description when it is null', () => {
    const f = locoNumberOrFilter('42616')
    expect(f).toContain('loco_numbers_text.imatch."(^|[^[:alnum:]])42616([^[:alnum:]]|$)"')
    expect(f).toContain('and(loco_numbers_text.is.null,description.imatch.')
  })
  it('escapes regex metacharacters', () => {
    expect(locoNumberOrFilter('E.113')).toContain('E\\\\.113')
  })
  it('keeps structural characters inside a quoted segment', () => {
    const f = locoNumberOrFilter('a,b(c)')
    const outside = f.replace(/"(?:[^"\\]|\\.)*"/g, '')
    expect(outside).not.toMatch(/a,b|\\\(c/)
    expect(f).toContain('a,b\\\\(c\\\\)')
  })
})

describe('locoNameTerms', () => {
  it('splits on whitespace and drops empties', () => {
    expect(locoNameTerms('  Flying   scotsman ')).toEqual(['Flying', 'scotsman'])
    expect(locoNameTerms('')).toEqual([])
  })
})
