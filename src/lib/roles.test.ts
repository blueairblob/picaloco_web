import { describe, expect, it } from 'vitest'
import { menuSections, nextRoleCheck, roleFor, roleStatusFrom, showAdminAnalysis, userChanged, type MyRole } from './roles'

describe('roleStatusFrom', () => {
  it('maps session and role to a status', () => {
    expect(roleStatusFrom(false, undefined)).toBe('signed-out')
    expect(roleStatusFrom(false, { role: 'admin', in_training: false, must_change_password: false })).toBe('signed-out')
    expect(roleStatusFrom(true, undefined)).toBe('loading')
    expect(roleStatusFrom(true, null)).toBe('no-access')
    expect(roleStatusFrom(true, { role: null, in_training: null, must_change_password: null })).toBe('no-access')
    expect(roleStatusFrom(true, { role: 'admin', in_training: false, must_change_password: false })).toBe('admin')
    expect(roleStatusFrom(true, { role: 'volunteer', in_training: true, must_change_password: true })).toBe('volunteer')
  })
})

describe('roleStatusFrom error', () => {
  it('maps a failed my_role answer to error, not no-access', () => {
    expect(roleStatusFrom(true, 'error')).toBe('error')
    expect(roleStatusFrom(false, 'error')).toBe('signed-out')
  })
})

describe('nextRoleCheck', () => {
  const vol: MyRole = { role: 'volunteer', in_training: false, must_change_password: false }
  const adm: MyRole = { role: 'admin', in_training: false, must_change_password: false }
  it('a successful answer replaces the previous one', () => {
    expect(nextRoleCheck({ userId: 'u1', role: vol }, 'u1', { ok: true, role: adm })).toEqual({ userId: 'u1', role: adm })
    expect(nextRoleCheck(null, 'u1', { ok: true, role: null })).toEqual({ userId: 'u1', role: null })
  })
  it('an error during a refresh for the same user keeps the previous answer', () => {
    const prev = { userId: 'u1', role: vol }
    expect(nextRoleCheck(prev, 'u1', { ok: false })).toBe(prev)
  })
  it('an error on first load (or after another user) is an error state', () => {
    expect(nextRoleCheck(null, 'u1', { ok: false })).toEqual({ userId: 'u1', role: 'error' })
    expect(nextRoleCheck({ userId: 'u0', role: vol }, 'u1', { ok: false })).toEqual({ userId: 'u1', role: 'error' })
  })
  it('a retry that succeeds replaces an error', () => {
    expect(nextRoleCheck({ userId: 'u1', role: 'error' }, 'u1', { ok: true, role: vol })).toEqual({ userId: 'u1', role: vol })
  })
})

describe('userChanged', () => {
  it('is false for the first read and for the same user (token refresh)', () => {
    expect(userChanged(undefined, null)).toBe(false)
    expect(userChanged(undefined, 'u1')).toBe(false)
    expect(userChanged('u1', 'u1')).toBe(false)
    expect(userChanged(null, null)).toBe(false)
  })
  it('is true on sign-out, sign-in and switching users', () => {
    expect(userChanged('u1', null)).toBe(true)
    expect(userChanged(null, 'u2')).toBe(true)
    expect(userChanged('u1', 'u2')).toBe(true)
  })
})

describe('roleFor', () => {
  const vol: MyRole = { role: 'volunteer', in_training: true, must_change_password: false }
  it('uses the answer fetched for this user', () => {
    expect(roleFor({ userId: 'u1', role: vol }, 'u1')).toBe(vol)
    expect(roleFor({ userId: 'u1', role: null }, 'u1')).toBeNull()
  })
  it('never reuses an answer fetched for another user (still loading)', () => {
    expect(roleFor({ userId: 'u1', role: vol }, 'u2')).toBeUndefined()
  })
  it('is undefined before any answer or without a user', () => {
    expect(roleFor(null, 'u1')).toBeUndefined()
    expect(roleFor({ userId: 'u1', role: vol }, null)).toBeUndefined()
    expect(roleFor({ userId: 'u1', role: vol }, undefined)).toBeUndefined()
  })
})

describe('menuSections', () => {
  it('admin menu: workflow steps then People', () => {
    const s = menuSections('admin', false)
    expect(s.map((x) => x.title)).toEqual(['Archive workflow', 'People'])
    expect(s[0].items.map((i) => i.path)).toEqual(['/admin', '/admin/fixes', '/admin/model-check'])
    expect(s[1].items.map((i) => i.path)).toEqual(['/admin/volunteers', '/admin/approvals', '/admin/changes'])
    expect(s[1].items.map((i) => i.label)).toEqual(['Volunteers', 'Approvals', 'Changes'])
  })
  it('volunteer menu: only Data fixes and Model check', () => {
    const s = menuSections('volunteer', false)
    expect(s).toHaveLength(1)
    expect(s[0].items.map((i) => i.path)).toEqual(['/admin/fixes', '/admin/model-check'])
    expect(s[0].note).toBeUndefined()
  })
  it('volunteer in training gets the training note', () => {
    const s = menuSections('volunteer', true)
    expect(s[0].note).toBe('In training: your answers are checked before they count')
  })
  it('other statuses have no sections', () => {
    expect(menuSections('signed-out', false)).toEqual([])
    expect(menuSections('no-access', false)).toEqual([])
    expect(menuSections('loading', false)).toEqual([])
  })
})

describe('showAdminAnalysis', () => {
  it('only admins load the confusion table and conflicts (admin-only RPCs)', () => {
    expect(showAdminAnalysis('admin')).toBe(true)
    for (const s of ['volunteer', 'loading', 'signed-out', 'no-access'] as const) {
      expect(showAdminAnalysis(s)).toBe(false)
    }
  })
})
