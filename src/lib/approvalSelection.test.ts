import { describe, expect, it } from 'vitest'
import { clearNoteIfSent, removeKeys } from './approvalSelection'

describe('removeKeys', () => {
  it('removes only the given keys', () => {
    const s = new Set(['fix:1', 'fix:2', 'answer:3'])
    expect([...removeKeys(s, ['fix:2'])]).toEqual(['fix:1', 'answer:3'])
    expect(s.size).toBe(3)
  })
  it('ignores keys that are not selected', () => expect(removeKeys(new Set(['a']), ['b']).size).toBe(1))
})

describe('clearNoteIfSent', () => {
  it('clears an unchanged note', () => expect(clearNoteIfSent('Not a tram', 'Not a tram')).toBe(''))
  it('keeps text typed meanwhile', () => expect(clearNoteIfSent('Not a tram, sorry', 'Not a tram')).toBe('Not a tram, sorry'))
  it('treats undefined as empty', () => expect(clearNoteIfSent(undefined, undefined)).toBe(''))
})
