import { describe, expect, it } from 'vitest'
import { personLabel } from './personLabel'

const people = [{ user_id: 'u1', email: 'a@x.org' }]
describe('personLabel', () => {
  it('shows Loading… while people load', () => expect(personLabel(undefined, 'u1', 'Unknown')).toBe('Loading…'))
  it('falls back when loading failed', () => expect(personLabel(undefined, 'u1', 'Unknown', true)).toBe('Unknown'))
  it('finds the email', () => expect(personLabel(people, 'u1', 'Unknown')).toBe('a@x.org'))
  it('falls back for a missing person once loaded', () => expect(personLabel(people, 'u2', 'Unknown')).toBe('Unknown'))
})
