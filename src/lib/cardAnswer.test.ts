import { describe, expect, it } from 'vitest'
import {
  NO_TOGGLES,
  clearMarks,
  companionTarget,
  fieldMark,
  mainDecision,
  mainTouched,
  noLocoOn,
  toggleNoLoco,
  toggleNotVisible,
  type FieldState,
} from './cardAnswer'
import type { DecisionRecord } from './reviewDecision'

const field = (status: FieldState['status'], fixId = 'loco_number', dirty = false): FieldState => ({ fixId, status, dirty })
const rec = (over: Partial<DecisionRecord> = {}): DecisionRecord => ({
  status: 'extracted',
  values: [],
  suggested_values: ['60103'],
  ...over,
})

describe('lit buttons', () => {
  it('follow the saved answer until pressed', () => {
    expect(noLocoOn(field('no_loco'), NO_TOGGLES)).toBe(true)
    expect(fieldMark(field('none_visible'), NO_TOGGLES)).toBe('none_visible')
    expect(fieldMark(field('verified'), NO_TOGGLES)).toBeNull()
  })

  it('a typed edit beats a saved mark', () => {
    expect(noLocoOn(field('no_loco', 'loco_number', true), NO_TOGGLES)).toBe(false)
    expect(fieldMark(field('none_visible', 'loco_number', true), NO_TOGGLES)).toBeNull()
  })

  it('X marks every field', () => {
    const t = toggleNoLoco(field('extracted'), NO_TOGGLES)
    expect(fieldMark(field('verified', 'loco_name'), t)).toBe('no_loco')
  })
})

describe('toggles', () => {
  it('X and N switch on and off', () => {
    const main = field('extracted')
    const on = toggleNoLoco(main, NO_TOGGLES)
    expect(noLocoOn(main, on)).toBe(true)
    expect(noLocoOn(main, toggleNoLoco(main, on))).toBe(false)
    const nv = toggleNotVisible(main, NO_TOGGLES)
    expect(fieldMark(main, nv)).toBe('none_visible')
    expect(fieldMark(main, toggleNotVisible(main, nv))).toBeNull()
  })

  it('N on a no-loco field switches X off', () => {
    const main = field('no_loco')
    const t = toggleNotVisible(main, NO_TOGGLES)
    expect(noLocoOn(main, t)).toBe(false)
    expect(fieldMark(main, t)).toBe('none_visible')
  })

  it('a saved not-visible can be switched off', () => {
    const main = field('none_visible')
    expect(fieldMark(main, toggleNotVisible(main, NO_TOGGLES))).toBeNull()
  })

  it('typing clears the field marks and X', () => {
    const main = field('extracted')
    const t = clearMarks(main, toggleNotVisible(main, toggleNoLoco(main, NO_TOGGLES)))
    expect(fieldMark(main, t)).toBeNull()
    expect(noLocoOn(main, t)).toBe(false)
  })

  it('mainTouched notices any change', () => {
    const main = field('verified')
    expect(mainTouched(main, NO_TOGGLES)).toBe(false)
    expect(mainTouched(field('verified', 'loco_number', true), NO_TOGGLES)).toBe(true)
    expect(mainTouched(main, toggleNoLoco(main, NO_TOGGLES))).toBe(true)
    expect(mainTouched(main, { notVisible: { loco_name: true } })).toBe(false)
  })
})

describe('mainDecision', () => {
  it('a mark wins', () => {
    expect(mainDecision(rec(), '60103', false, 'no_loco')).toEqual({ status: 'no_loco', values: [] })
    expect(mainDecision(rec(), '60103', true, 'none_visible')).toEqual({ status: 'none_visible', values: [] })
  })

  it('confirms the suggestion on an open record', () => {
    expect(mainDecision(rec(), '60103', false, null)).toEqual({ status: 'verified', values: ['60103'] })
  })

  it('saves a typed edit', () => {
    expect(mainDecision(rec(), '4472', true, null)).toEqual({ status: 'corrected', values: ['4472'] })
  })

  it('keeps a reviewed record as it is', () => {
    const r = rec({ status: 'corrected', values: ['741'] })
    expect(mainDecision(r, '741', false, null)).toEqual({ status: 'corrected', values: ['741'] })
  })

  it('nothing to save: empty box, no mark', () => {
    expect(mainDecision(rec({ suggested_values: [] }), '', false, null)).toBe('empty')
    expect(mainDecision(rec(), '  ', true, null)).toBe('empty')
    // A saved mark switched off with nothing typed.
    expect(mainDecision(rec({ status: 'none_visible' }), '', false, null)).toBe('empty')
  })

  it('a saved mark switched off saves what was typed', () => {
    expect(mainDecision(rec({ status: 'no_loco' }), '60103', true, null)).toEqual({ status: 'verified', values: ['60103'] })
  })
})

describe('companionTarget', () => {
  it('an untouched field saves nothing', () => {
    expect(companionTarget(rec(), undefined, false, null)).toBeNull()
    expect(companionTarget(rec({ status: 'none_visible' }), undefined, false, 'none_visible')).toBeNull()
  })

  it('a newly selected mark is saved', () => {
    expect(companionTarget(rec(), undefined, false, 'no_loco')).toEqual({ status: 'no_loco', values: [] })
    expect(companionTarget(rec({ status: 'verified', values: ['60103'] }), undefined, false, 'none_visible')).toEqual({
      status: 'none_visible',
      values: [],
    })
  })

  it('a typed edit is saved; an emptied box is not visible', () => {
    expect(companionTarget(rec(), 'Dolly', true, null)).toEqual({ status: 'corrected', values: ['Dolly'] })
    expect(companionTarget(rec(), ' ', true, null)).toEqual({ status: 'none_visible', values: [] })
  })

  it('a mark switched off with nothing typed is left alone', () => {
    expect(companionTarget(rec({ status: 'no_loco' }), undefined, false, null)).toBeNull()
  })

  it('a change that lands on the saved answer saves nothing', () => {
    const r = rec({ status: 'corrected', values: ['Doll'], suggested_values: [] })
    expect(companionTarget(r, 'Doll', true, null)).toBeNull()
  })
})
