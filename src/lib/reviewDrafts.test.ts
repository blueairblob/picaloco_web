import { describe, expect, it } from 'vitest'
import { isDraftOutdated, parseDraft } from './reviewDrafts'

describe('parseDraft', () => {
  it('reads drafts with their base updated_at', () => {
    expect(parseDraft({ text: 'Flying Fox', baseUpdatedAt: '2026-11-14T22:00:48.944469+00:00' })).toEqual({
      text: 'Flying Fox',
      baseUpdatedAt: '2026-11-14T22:00:48.944469+00:00',
    })
  })

  it('treats old text-only drafts as having an unknown base', () => {
    expect(parseDraft('Flying Fox')).toEqual({ text: 'Flying Fox', baseUpdatedAt: null })
  })

  it('rejects anything else', () => {
    expect(parseDraft(undefined)).toBeUndefined()
    expect(parseDraft({ baseUpdatedAt: 'x' })).toBeUndefined()
    expect(parseDraft(42)).toBeUndefined()
  })
})

describe('isDraftOutdated', () => {
  it('compares the exact updated_at strings', () => {
    const at = '2026-11-14T22:00:48.944469+00:00'
    expect(isDraftOutdated({ text: 'a', baseUpdatedAt: at }, at)).toBe(false)
    expect(isDraftOutdated({ text: 'a', baseUpdatedAt: '2026-11-14T22:00:48.944+00:00' }, at)).toBe(true)
    expect(isDraftOutdated({ text: 'a', baseUpdatedAt: null }, at)).toBe(true)
  })
})
