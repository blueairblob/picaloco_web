import { describe, expect, it } from 'vitest'
import { ctrlEnterAction, shortcutFor } from './reviewKeys'

const div = { tagName: 'DIV', isContentEditable: false }
const textarea = { tagName: 'TEXTAREA', isContentEditable: false }

describe('shortcutFor', () => {
  it('maps review keys outside text fields', () => {
    expect(shortcutFor('n', div)).toBe('notVisible')
    expect(shortcutFor('E', div)).toBe('edit')
    expect(shortcutFor('ArrowRight', div)).toBe('skip')
    expect(shortcutFor('s', div)).toBe('skip')
    expect(shortcutFor('ArrowLeft', div)).toBe('back')
    expect(shortcutFor('Enter', div)).toBe('confirm')
    expect(shortcutFor('X', div)).toBe('noLoco')
    expect(shortcutFor('u', div)).toBe('useSuggestion')
    expect(shortcutFor('U', div)).toBe('useSuggestion')
    expect(shortcutFor('q', div)).toBeNull()
    // Escape only discards an edit from inside the edit box.
    expect(shortcutFor('Escape', div)).toBeNull()
  })

  it('only handles Escape while typing', () => {
    expect(shortcutFor('n', textarea)).toBeNull()
    expect(shortcutFor('Enter', textarea)).toBeNull()
    expect(shortcutFor('Escape', textarea)).toBe('cancelEdit')
    expect(shortcutFor('u', textarea)).toBeNull()
    expect(shortcutFor('U', { tagName: 'INPUT', isContentEditable: false })).toBeNull()
    expect(shortcutFor('n', { tagName: 'INPUT', isContentEditable: false })).toBeNull()
    expect(shortcutFor('n', { tagName: 'DIV', isContentEditable: true })).toBeNull()
  })
})

describe('ctrlEnterAction', () => {
  it('is Save & next', () => {
    expect(ctrlEnterAction(false, false, false)).toBe('confirm')
    expect(ctrlEnterAction(true, false, false)).toBe('confirm')
    expect(ctrlEnterAction(false, false, true)).toBe('confirm')
    expect(ctrlEnterAction(true, true, true)).toBe('confirm')
  })

  it('makes the reviewer look at an untouched main record that needs a recheck', () => {
    expect(ctrlEnterAction(true, false, true)).toBe('chooseMain')
  })
})
