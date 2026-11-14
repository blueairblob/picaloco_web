import { describe, expect, it } from 'vitest'
import { adminStatusFrom } from './useAdminSession'

describe('adminStatusFrom', () => {
  it('is signed-out without a session', () => {
    expect(adminStatusFrom(false, null)).toBe('signed-out')
  })
  it('is loading while the admin check is pending', () => {
    expect(adminStatusFrom(true, null)).toBe('loading')
  })
  it('is not-admin when is_admin is false', () => {
    expect(adminStatusFrom(true, false)).toBe('not-admin')
  })
  it('is admin when is_admin is true', () => {
    expect(adminStatusFrom(true, true)).toBe('admin')
  })
})
