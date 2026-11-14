import { describe, expect, it } from 'vitest'
import { canUseSuggestion, decideSave, editBaseline, isReviewed, type DecisionRecord } from './reviewDecision'

const rec = (r: Partial<DecisionRecord>): DecisionRecord => ({
  status: 'extracted',
  values: [],
  suggested_values: [],
  ...r,
})

describe('decideSave', () => {
  it('confirms an extracted record with its values as verified', () => {
    expect(decideSave(rec({ values: ['123'], suggested_values: ['123'] }), 'confirm')).toEqual({
      values: ['123'],
      status: 'verified',
    })
  })

  it('confirms an extracted record with no values using the suggestion', () => {
    expect(decideSave(rec({ values: [], suggested_values: ['60103'] }), 'confirm')).toEqual({
      values: ['60103'],
      status: 'verified',
    })
  })

  it('keeps a corrected value flagged for recheck as corrected (Keep current)', () => {
    const r = rec({ status: 'corrected', values: ['X1'], suggested_values: ['Y2'] })
    expect(decideSave(r, 'confirm')).toEqual({ values: ['X1'], status: 'corrected' })
  })

  it('keeps a verified value as verified even when a new suggestion differs', () => {
    const r = rec({ status: 'verified', values: ['X1'], suggested_values: ['Y2'] })
    expect(decideSave(r, 'confirm')).toEqual({ values: ['X1'], status: 'verified' })
  })

  it('replaces the review with the suggestion as verified', () => {
    const r = rec({ status: 'corrected', values: ['X1'], suggested_values: ['Y2'] })
    expect(decideSave(r, 'useSuggestion')).toEqual({ values: ['Y2'], status: 'verified' })
  })

  it('keeps none_visible on a recheck confirm, with no values', () => {
    const r = rec({ status: 'none_visible', values: [], suggested_values: ['4472'] })
    expect(decideSave(r, 'confirm')).toEqual({ values: [], status: 'none_visible' })
  })

  it('keeps no_loco on a recheck confirm, with no values', () => {
    const r = rec({ status: 'no_loco', values: [], suggested_values: ['4472'] })
    expect(decideSave(r, 'confirm')).toEqual({ values: [], status: 'no_loco' })
  })

  it('saves an edit equal to the suggestion as verified', () => {
    const r = rec({ status: 'corrected', values: ['X1'], suggested_values: ['Y2'] })
    expect(decideSave(r, 'edit', ['  Y2 ', ''])).toEqual({ values: ['Y2'], status: 'verified' })
  })

  it('saves an edit different from the suggestion as corrected', () => {
    const r = rec({ status: 'verified', values: ['Y2'], suggested_values: ['Y2'] })
    expect(decideSave(r, 'edit', ['Z3'])).toEqual({ values: ['Z3'], status: 'corrected' })
  })

  it('saves an edit equal to an extracted record’s values but not its suggestion as corrected', () => {
    const r = rec({ status: 'extracted', values: ['X1'], suggested_values: ['Y2'] })
    expect(decideSave(r, 'edit', ['X1'])).toEqual({ values: ['X1'], status: 'corrected' })
  })

  it('treats a reordered list as different from the suggestion', () => {
    const r = rec({ suggested_values: ['1', '2'] })
    expect(decideSave(r, 'edit', ['2', '1'])).toEqual({ values: ['2', '1'], status: 'corrected' })
  })

  it('normalises edited values: trims, drops blanks and duplicates', () => {
    const r = rec({ suggested_values: ['1', '2'] })
    expect(decideSave(r, 'edit', [' 1', '', '2 ', '1'])).toEqual({ values: ['1', '2'], status: 'verified' })
  })
})

describe('canUseSuggestion', () => {
  it('is offered only on a reviewed record whose non-empty suggestion differs', () => {
    expect(canUseSuggestion(rec({ status: 'corrected', values: ['X'], suggested_values: ['Y'] }))).toBe(true)
    expect(canUseSuggestion(rec({ status: 'none_visible', values: [], suggested_values: ['Y'] }))).toBe(true)
    expect(canUseSuggestion(rec({ status: 'verified', values: ['Y'], suggested_values: ['Y'] }))).toBe(false)
    expect(canUseSuggestion(rec({ status: 'corrected', values: ['X'], suggested_values: [] }))).toBe(false)
    expect(canUseSuggestion(rec({ status: 'extracted', values: ['X'], suggested_values: ['Y'] }))).toBe(false)
  })
})

describe('editBaseline / isReviewed', () => {
  it('starts an extracted record’s edit box from its values, else the suggestion', () => {
    expect(editBaseline(rec({ values: ['X'], suggested_values: ['Y'] }))).toEqual(['X'])
    expect(editBaseline(rec({ values: [], suggested_values: ['Y'] }))).toEqual(['Y'])
  })

  it('starts a reviewed record’s edit box from its current review only', () => {
    expect(editBaseline(rec({ status: 'none_visible', values: [], suggested_values: ['Y'] }))).toEqual([])
    expect(editBaseline(rec({ status: 'corrected', values: ['X'], suggested_values: ['Y'] }))).toEqual(['X'])
  })

  it('knows which records are reviewed', () => {
    expect(isReviewed(rec({ status: 'extracted' }))).toBe(false)
    expect(isReviewed(rec({ status: 'no_loco' }))).toBe(true)
  })
})
