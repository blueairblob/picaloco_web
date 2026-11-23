import { describe, expect, it } from 'vitest'
import { dateRangeError, dayStart } from './dateRange'

describe('dayStart', () => {
  it('is undefined for an empty day', () => expect(dayStart('')).toBeUndefined())
  it('is local midnight', () => expect(dayStart('2026-03-15')).toBe(new Date(2026, 2, 15, 0, 0, 0, 0).toISOString()))
  it('plus 1 is the next local midnight', () => expect(dayStart('2026-03-15', 1)).toBe(new Date(2026, 2, 16).toISOString()))
  it('rolls over the month and year', () => {
    expect(dayStart('2026-01-31', 1)).toBe(new Date(2026, 1, 1).toISOString())
    expect(dayStart('2026-12-31', 1)).toBe(new Date(2027, 0, 1).toISOString())
  })
})

describe('dateRangeError', () => {
  it('flags from after to', () => expect(dateRangeError('2026-05-02', '2026-05-01')).toBe("The 'from' date is after the 'to' date."))
  it('accepts equal, ordered and open ranges', () => {
    expect(dateRangeError('2026-05-01', '2026-05-01')).toBeNull()
    expect(dateRangeError('2026-05-01', '2026-06-01')).toBeNull()
    expect(dateRangeError('', '2026-06-01')).toBeNull()
    expect(dateRangeError('2026-05-01', '')).toBeNull()
  })
})
