import { describe, expect, it } from 'vitest'
import { chunk, sumBatchResults } from './chunk'

describe('chunk', () => {
  it('throws for size < 1', () => expect(() => chunk([1], 0)).toThrow())
  it('size 1', () => expect(chunk([1, 2], 1)).toEqual([[1], [2]]))
  it('exact', () => expect(chunk([1, 2, 3, 4], 2)).toEqual([[1, 2], [3, 4]]))
  it('remainder', () => expect(chunk([1, 2, 3], 2)).toEqual([[1, 2], [3]]))
  it('empty', () => expect(chunk([], 3)).toEqual([]))
})

describe('sumBatchResults', () => {
  it('sums undo and withdraw results', () => {
    expect(
      sumBatchResults([
        { undone: 3, changed_since: [1], skipped: [{}] },
        { withdrawn: 2, fills_left: [1, 2], skipped: [{}, {}] },
        {},
      ]),
    ).toEqual({ done: 5, changedSince: 3, skipped: 3 })
  })
})
