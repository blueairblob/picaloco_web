import { describe, expect, it } from 'vitest'
import { roleStatusFrom } from '@/lib/roles'

// The hook derives its status through roleStatusFrom; its cases live in src/lib/roles.test.ts.
describe('useAdminSession status', () => {
  it('is loading while my_role is pending', () => {
    expect(roleStatusFrom(true, undefined)).toBe('loading')
  })
  it('is no-access when my_role has no role', () => {
    expect(roleStatusFrom(true, { role: null, in_training: null, must_change_password: null })).toBe('no-access')
  })
})
