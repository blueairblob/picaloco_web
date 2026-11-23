import { describe, expect, it } from 'vitest'
import { ROLE_CHANGED_MESSAGE, roleChangedMessage } from './roleChange'

// The server's own 42501 messages (rat schema guards on the save and submit_* RPCs).
const HELD = 'trainee work is held for approval: use submit_*'
const NOT_TRAINEE = 'only a volunteer in training submits work for approval'

describe('roleChangedMessage', () => {
  it('a plain save refused because the account is now in training', () => {
    expect(roleChangedMessage(true, HELD, false)).toBe(ROLE_CHANGED_MESSAGE)
  })
  it('a submit_* refused because the account is no longer in training', () => {
    expect(roleChangedMessage(true, NOT_TRAINEE, true)).toBe(ROLE_CHANGED_MESSAGE)
  })
  it('the message is the agreed copy', () => {
    expect(ROLE_CHANGED_MESSAGE).toBe('Your role changed — please try again.')
  })
  it('only for a forbidden (42501) answer', () => {
    expect(roleChangedMessage(false, HELD, false)).toBeNull()
    expect(roleChangedMessage(false, NOT_TRAINEE, true)).toBeNull()
  })
  it('not for a 42501 that does not match the RPC that was called', () => {
    // A trainee calls submit_*, which never raises the "held for approval" guard, and vice versa.
    expect(roleChangedMessage(true, HELD, true)).toBeNull()
    expect(roleChangedMessage(true, NOT_TRAINEE, false)).toBeNull()
  })
  it('not for any other 42501, such as no access at all', () => {
    expect(roleChangedMessage(true, 'permission denied for function review_fix_value', false)).toBeNull()
    expect(roleChangedMessage(true, 'permission denied for function submit_fix_review', true)).toBeNull()
    expect(roleChangedMessage(true, undefined, false)).toBeNull()
  })
})
