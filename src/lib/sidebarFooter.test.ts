import { describe, expect, it } from 'vitest'
import { footerAccount } from './sidebarFooter'

describe('footerAccount', () => {
  it('offers sign-in when signed out', () => {
    expect(footerAccount('signed-out', null)).toEqual({ kind: 'signin' })
  })
  it('shows the email and Sign out for every signed-in state, including error', () => {
    for (const status of ['admin', 'volunteer', 'no-access', 'error'] as const) {
      expect(footerAccount(status, 'a@b.org')).toEqual({ kind: 'account', email: 'a@b.org' })
    }
  })
  it('keeps Sign out when the email is unknown', () => {
    expect(footerAccount('error', null)).toEqual({ kind: 'account', email: null })
  })
  it('shows nothing while the role is loading', () => {
    expect(footerAccount('loading', 'a@b.org')).toEqual({ kind: 'none' })
  })
})
