import { describe, expect, it } from 'vitest'
import { DEFAULT_QUEUE_PARAMS, parseQueueParams, serializeQueueParams } from './queueParams'

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
})
