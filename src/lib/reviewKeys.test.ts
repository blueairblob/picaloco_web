import { describe, expect, it } from 'vitest'
import { shortcutFor } from './reviewKeys'

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
    expect(shortcutFor('q', div)).toBeNull()
  })

  it('only handles Escape while typing', () => {
    expect(shortcutFor('n', textarea)).toBeNull()
    expect(shortcutFor('Enter', textarea)).toBeNull()
    expect(shortcutFor('Escape', textarea)).toBe('cancelEdit')
    expect(shortcutFor('n', { tagName: 'INPUT', isContentEditable: false })).toBeNull()
    expect(shortcutFor('n', { tagName: 'DIV', isContentEditable: true })).toBeNull()
  })
})
