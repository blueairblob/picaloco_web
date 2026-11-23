import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const rpc = vi.fn()
const getSession = vi.fn()
vi.mock('@/lib/supabase/adminClient', () => ({
  adminSupabase: {
    rpc: (...a: unknown[]) => rpc(...a),
    auth: { getSession: () => getSession() },
  },
}))

import { addVolunteer, formatAddedAt, listPeople, resetPassword, setVolunteer } from './volunteerService'

const fetchMock = vi.fn()

beforeEach(() => {
  rpc.mockReset()
  fetchMock.mockReset()
  getSession.mockResolvedValue({ data: { session: { access_token: 'tok-1' } } })
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => vi.unstubAllGlobals())

const reply = (status: number, body: unknown) =>
  ({ ok: status >= 200 && status < 300, status, json: async () => body }) as Response

describe('addVolunteer', () => {
  it('posts action create with the bearer token', async () => {
    fetchMock.mockResolvedValue(reply(200, { user_id: 'u1', email: 'a@b.org', temp_password: 'Abc234xyzQ5m' }))
    const r = await addVolunteer('a@b.org')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/volunteers')
    expect(init.method).toBe('POST')
    expect(init.headers.Authorization).toBe('Bearer tok-1')
    expect(JSON.parse(init.body)).toEqual({ action: 'create', email: 'a@b.org' })
    expect(r).toEqual({ ok: true, email: 'a@b.org', tempPassword: 'Abc234xyzQ5m' })
  })

  it('returns the server message on 409', async () => {
    fetchMock.mockResolvedValue(reply(409, { error: 'that email already has an account' }))
    expect(await addVolunteer('a@b.org')).toEqual({ ok: false, message: 'that email already has an account' })
  })

  it('does not call the server when signed out', async () => {
    getSession.mockResolvedValue({ data: { session: null } })
    expect(await addVolunteer('a@b.org')).toEqual({ ok: false, message: 'You are signed out. Sign in again.' })
    expect(await resetPassword('u1')).toEqual({ ok: false, message: 'You are signed out. Sign in again.' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('returns a generic message when fetch throws', async () => {
    fetchMock.mockRejectedValue(new Error('net'))
    expect(await addVolunteer('a@b.org')).toEqual({ ok: false, message: 'Something went wrong. Try again.' })
  })
})

describe('resetPassword', () => {
  it('posts action reset and returns the password', async () => {
    fetchMock.mockResolvedValue(reply(200, { temp_password: 'Zzz234xyzQ5m' }))
    const r = await resetPassword('u1')
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ action: 'reset', user_id: 'u1' })
    expect(r).toEqual({ ok: true, email: '', tempPassword: 'Zzz234xyzQ5m' })
  })

  it('returns the server message on 404', async () => {
    fetchMock.mockResolvedValue(reply(404, { error: 'not found' }))
    expect(await resetPassword('u1')).toEqual({ ok: false, message: 'not found' })
  })
})

describe('setVolunteer', () => {
  it('sends only the given fields', async () => {
    rpc.mockResolvedValue({ error: null })
    await setVolunteer('u1', { inTraining: true })
    expect(rpc).toHaveBeenCalledWith('set_volunteer', { p_user_id: 'u1', p_in_training: true, p_active: null })
    await setVolunteer('u1', { active: false })
    expect(rpc).toHaveBeenLastCalledWith('set_volunteer', { p_user_id: 'u1', p_in_training: null, p_active: false })
  })

  it('throws on rpc error', async () => {
    rpc.mockResolvedValue({ error: { message: 'no' } })
    await expect(setVolunteer('u1', { active: true })).rejects.toBeTruthy()
  })
})

describe('listPeople', () => {
  it('normalises held_count to a number', async () => {
    rpc.mockResolvedValue({
      data: [{ user_id: 'u1', email: 'a@b.org', role: 'volunteer', in_training: false, added_at: 'x', removed_at: null, held_count: '3' }],
      error: null,
    })
    const p = await listPeople()
    expect(rpc).toHaveBeenCalledWith('people')
    expect(p[0].held_count).toBe(3)
  })
})

describe('formatAddedAt', () => {
  it('shows a dash for admins, who have no added date', () => {
    expect(formatAddedAt(null)).toBe('—')
  })
  it('shows the local date otherwise', () => {
    const at = '2026-11-20T10:00:00Z'
    expect(formatAddedAt(at)).toBe(new Date(at).toLocaleDateString())
  })
})
