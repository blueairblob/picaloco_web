import { describe, expect, it } from 'vitest'
import {
  DEFAULT_QUEUE_PARAMS,
  emptyQueueMessage,
  gridQueueParams,
  parseQueueParams,
  serializeQueueParams,
} from './queueParams'

const roundTrip = (qs: string) => serializeQueueParams(parseQueueParams(new URLSearchParams(qs))).toString()

describe('queueParams', () => {
  it('round-trips canonical query strings', () => {
    for (const qs of [
      '',
      'confidence=high',
      'confidence=low,med',
      'status=verified,corrected&recheck=0',
      'status=',
      'collection=Ian+Allan&q=Flying+Fox',
    ]) {
      expect(roundTrip(qs)).toBe(new URLSearchParams(qs).toString())
    }
  })

  it('serialises defaults to an empty string', () => {
    expect(serializeQueueParams(DEFAULT_QUEUE_PARAMS).toString()).toBe('')
  })

  it('drops unknown confidence values', () => {
    expect(parseQueueParams(new URLSearchParams('confidence=high,bogus')).confidence).toEqual(['high'])
  })

  it('reads recheck=0 as includeRecheck false', () => {
    expect(parseQueueParams(new URLSearchParams('recheck=0')).includeRecheck).toBe(false)
  })

  it('treats an absent status key as the default and an empty one as no statuses', () => {
    expect(parseQueueParams(new URLSearchParams('')).status).toEqual(['extracted'])
    const recheckOnly = parseQueueParams(new URLSearchParams('status=&recheck=1'))
    expect(recheckOnly.status).toEqual([])
    expect(recheckOnly.includeRecheck).toBe(true)
    expect(parseQueueParams(serializeQueueParams(recheckOnly))).toEqual(recheckOnly)
  })

  it('says a filter matched nothing only when a collection or text filter loaded nothing', () => {
    const typo = { ...DEFAULT_QUEUE_PARAMS, collection: 'Colection X' }
    expect(emptyQueueMessage(typo, false)).toBe('No records match this filter — check the collection name or text.')
    expect(emptyQueueMessage({ ...DEFAULT_QUEUE_PARAMS, text: 'zzz' }, false)).toMatch(/No records match/)
    // Worked through everything that loaded: that's a finished batch, not a typo.
    expect(emptyQueueMessage(typo, true)).toBe('Nothing left for this filter')
    expect(emptyQueueMessage(DEFAULT_QUEUE_PARAMS, false)).toBe('Nothing left for this filter')
  })

  it('limits the grid to open records, never recheck-only reviewed ones', () => {
    const p = { ...DEFAULT_QUEUE_PARAMS, confidence: ['high' as const], status: ['extracted' as const, 'verified' as const] }
    expect(gridQueueParams(p)).toEqual({ ...p, status: ['extracted'], includeRecheck: false })
    expect(gridQueueParams({ ...p, status: ['verified'] }).status).toEqual([])
  })
})
