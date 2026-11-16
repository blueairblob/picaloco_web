import { describe, expect, it } from 'vitest'
import { formatAccuracy, parseCheckParams, serializeCheckParams } from './modelCheckParams'

describe('check params', () => {
  it('defaults', () => {
    expect(parseCheckParams(new URLSearchParams())).toEqual({ run: null, mode: 'sure', answer: null, collection: null })
  })
  it('round-trips', () => {
    const p = { run: 3, mode: 'unsure' as const, answer: 'tram', collection: 'Col A' }
    expect(parseCheckParams(serializeCheckParams(p))).toEqual(p)
  })
  it('unknown mode falls back to sure', () => {
    expect(parseCheckParams(new URLSearchParams('mode=nope')).mode).toBe('sure')
  })
  it('sample mode drops answer and collection', () => {
    const p = parseCheckParams(new URLSearchParams('mode=sample&answer=tram&collection=X'))
    expect(p).toEqual({ run: null, mode: 'sample', answer: null, collection: null })
    expect(serializeCheckParams({ run: 2, mode: 'sample', answer: 'a', collection: 'b' }).toString()).toBe('run=2&mode=sample')
  })
  it('ignores a bad run', () => {
    expect(parseCheckParams(new URLSearchParams('run=abc')).run).toBeNull()
  })
})

describe('formatAccuracy', () => {
  it('formats', () => {
    expect(formatAccuracy(174, 200)).toBe('87% (174 of 200)')
    expect(formatAccuracy(0, 0)).toBe('No blind answers yet')
  })
})
