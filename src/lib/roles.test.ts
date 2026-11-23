import { describe, expect, it } from 'vitest'
import { menuSections, roleFor, roleStatusFrom, showAdminAnalysis, type MyRole } from './roles'

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
