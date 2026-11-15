import { describe, expect, it } from 'vitest'
import { carriedCompanions, companionBlockMessage, isCompanionDirty } from './companionSave'
import type { CompanionValue } from '@/services/dataFixService'

const row = (over: Partial<CompanionValue> = {}): CompanionValue => ({
  fix_id: 'loco_number',
  values: [],
  suggested_values: ['60103'],
  confidence: 'high',
  status: 'extracted',
  needs_recheck: false,
  updated_at: '2026-01-01T00:00:00.123456+00:00',
  ...over,
})

describe('isCompanionDirty', () => {
  it('compares the box with what it starts from', () => {
    expect(isCompanionDirty(row(), '60103')).toBe(false)
    expect(isCompanionDirty(row(), '60103\n4472')).toBe(true)
  })
})

describe('companionBlockMessage', () => {
  it('only blocks while not ready and a draft exists', () => {
    expect(companionBlockMessage('ready', ['Loco name'])).toBeNull()
    expect(companionBlockMessage('loading', [])).toBeNull()
    expect(companionBlockMessage('loading', ['Loco name'])).toBe('Still loading Loco name — try again in a moment.')
    expect(companionBlockMessage('error', ['Loco name'])).toBe(
      "Couldn't load Loco name, which this save would change — use Retry first.",
    )
  })
})

describe('carriedCompanions', () => {
  it('returns dirty companions not edited this visit', () => {
    expect(carriedCompanions(['a', 'b'], new Set(['b']))).toEqual(['a'])
    expect(carriedCompanions(['a'], new Set(['a']))).toEqual([])
    expect(carriedCompanions([], new Set())).toEqual([])
  })
})
