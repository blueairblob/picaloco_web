import { describe, expect, it } from 'vitest'
import { companionBlockMessage, companionDecision, isCompanionDirty } from './companionSave'
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

describe('companion save', () => {
  it('an untouched open row is not dirty and saves nothing', () => {
    expect(isCompanionDirty(row(), '60103')).toBe(false)
    expect(companionDecision(row(), '60103')).toBeNull()
  })

  it('an edited open row is corrected', () => {
    expect(companionDecision(row(), '60103\n4472')).toEqual({ status: 'corrected', values: ['60103', '4472'] })
  })

  it('an open row with values, edited to the suggestion, is verified', () => {
    expect(companionDecision(row({ values: ['4472'] }), '60103')).toEqual({ status: 'verified', values: ['60103'] })
  })

  it('an emptied box is saved as not visible', () => {
    expect(companionDecision(row(), '  \n ')).toEqual({ status: 'none_visible', values: [] })
  })

  it('a reviewed row only saves when changed', () => {
    const r = row({ status: 'corrected', values: ['Doll'], suggested_values: [] })
    expect(companionDecision(r, 'Doll')).toBeNull()
    expect(companionDecision(r, 'Dolly')).toEqual({ status: 'corrected', values: ['Dolly'] })
  })
})

describe('companionBlockMessage', () => {
  it('only blocks while not ready and a draft exists', () => {
    expect(companionBlockMessage('ready', ['Loco name'])).toBeNull()
    expect(companionBlockMessage('loading', [])).toBeNull()
    expect(companionBlockMessage('loading', ['Loco name'])).toBe('Still loading Loco name — try again in a moment.')
    expect(companionBlockMessage('error', ['Loco name'])).toBe(
      "Couldn't load Loco name, which has an unsaved edit — use Retry first.",
    )
  })
})
