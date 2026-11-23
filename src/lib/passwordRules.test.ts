import { describe, expect, it } from 'vitest'
import { passwordError } from './passwordRules'

describe('passwordError', () => {
  it('requires 8 characters', () => expect(passwordError('1234567')).toBe('Use at least 8 characters.'))
  it('accepts 8 and 72 bytes', () => {
    expect(passwordError('12345678')).toBeNull()
    expect(passwordError('a'.repeat(72))).toBeNull()
  })
  it('rejects 73 bytes', () => expect(passwordError('a'.repeat(73))).toBe('Use 72 characters or fewer.'))
  it('counts UTF-8 bytes, not characters', () => expect(passwordError('é'.repeat(37))).toBe('Use 72 characters or fewer.'))
})
