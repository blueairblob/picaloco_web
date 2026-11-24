import { beforeEach, describe, expect, it, vi } from 'vitest'

const rpc = vi.fn()
vi.mock('@/lib/supabase/adminClient', () => ({
  adminSupabase: { rpc: (...a: unknown[]) => rpc(...a) },
}))

import { approve, listHeld, myHeld, reject, summaryLine } from './approvalService'

describe('myHeld', () => {
  beforeEach(() => rpc.mockReset())

  it('myHeld maps rows', async () => {
    rpc.mockResolvedValue({
      data: [
        { kind: 'fix', id: '4', image_no: 'arc1', subject: 'Loco number', proposed: { values: ['42'] }, decision: 'pending', decided_at: null, note: null },
        { kind: 'answer', id: 5, image_no: 'arc2', subject: 'Subject', proposed: null, decision: 'rejected', decided_at: '2026-11-23T10:00:00+00:00', note: 'Not a tram' },
      ],
      error: null,
    })
    expect(await myHeld()).toEqual([
      { kind: 'fix', id: 4, image_no: 'arc1', subject: 'Loco number', proposed: { values: ['42'] }, decision: 'pending', decided_at: null, note: null },
      { kind: 'answer', id: 5, image_no: 'arc2', subject: 'Subject', proposed: {}, decision: 'rejected', decided_at: '2026-11-23T10:00:00+00:00', note: 'Not a tram' },
    ])
    expect(rpc).toHaveBeenCalledWith('my_held')
  })

  it('throws on error', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'boom' } })
    await expect(myHeld()).rejects.toEqual({ message: 'boom' })
  })
})

describe('decisions', () => {
  beforeEach(() => rpc.mockReset())

  it('approve(fix) calls approve_fix_review with p_force false by default', async () => {
    rpc.mockResolvedValue({ data: { approved: 2, stale: [], skipped: [] }, error: null })
    await approve('fix', [1, 2])
    expect(rpc).toHaveBeenCalledWith('approve_fix_review', { p_ids: [1, 2], p_force: false })
  })

  it('approve(fix, force) passes p_force true', async () => {
    rpc.mockResolvedValue({ data: { approved: 1 }, error: null })
    await approve('fix', [1], true)
    expect(rpc).toHaveBeenCalledWith('approve_fix_review', { p_ids: [1], p_force: true })
  })

  it('approve(fix, force, seen) passes p_seen_updated_at untouched', async () => {
    rpc.mockResolvedValue({ data: { approved: 1 }, error: null })
    await approve('fix', [1], true, '2026-11-23T10:00:00.123456+00:00')
    expect(rpc).toHaveBeenCalledWith('approve_fix_review', {
      p_ids: [1], p_force: true, p_seen_updated_at: '2026-11-23T10:00:00.123456+00:00',
    })
  })

  it('omits p_seen_updated_at when several ids are approved (server allows one item with a seen value)', async () => {
    rpc.mockResolvedValue({ data: { approved: 2 }, error: null })
    await approve('fix', [1, 2], true, '2026-11-23T10:00:00.123456+00:00')
    expect(rpc).toHaveBeenCalledWith('approve_fix_review', { p_ids: [1, 2], p_force: true })
  })

  it('ignores seenUpdatedAt when not forcing', async () => {
    rpc.mockResolvedValue({ data: { approved: 1 }, error: null })
    await approve('fix', [1], false, 'x')
    expect(rpc).toHaveBeenCalledWith('approve_fix_review', { p_ids: [1], p_force: false })
  })

  it('approve(answer) calls approve_model_answer', async () => {
    rpc.mockResolvedValue({ data: { approved: 1, skipped: [{ id: '9', reason: 'withdrawn' }] }, error: null })
    const r = await approve('answer', [8, 9])
    expect(rpc).toHaveBeenCalledWith('approve_model_answer', { p_ids: [8, 9] })
    expect(r).toEqual({ done: 1, stale: [], skipped: [{ id: 9, reason: 'withdrawn' }] })
  })

  it('reject passes kind and note', async () => {
    rpc.mockResolvedValue({ data: { rejected: 2, skipped: [] }, error: null })
    const r = await reject('answer', [3, 4], 'Not a tram')
    expect(rpc).toHaveBeenCalledWith('reject_held', { p_kind: 'answer', p_ids: [3, 4], p_note: 'Not a tram' })
    expect(r.done).toBe(2)
  })

  it('reject without a note sends null', async () => {
    rpc.mockResolvedValue({ data: { rejected: 1, skipped: [] }, error: null })
    await reject('fix', [3])
    expect(rpc).toHaveBeenCalledWith('reject_held', { p_kind: 'fix', p_ids: [3], p_note: null })
  })

  it('maps stale results to DecisionResult', async () => {
    rpc.mockResolvedValue({
      data: { approved: 1, stale: [{ id: '7', current_values: ['5'], current_status: 'corrected' }], skipped: [] },
      error: null,
    })
    expect(await approve('fix', [6, 7])).toEqual({
      done: 1,
      stale: [{ id: 7, current_values: ['5'], current_status: 'corrected' }],
      skipped: [],
    })
  })

  it('throws on error', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'no' } })
    await expect(approve('fix', [1])).rejects.toEqual({ message: 'no' })
    await expect(reject('fix', [1])).rejects.toEqual({ message: 'no' })
  })
})

describe('listHeld', () => {
  beforeEach(() => rpc.mockReset())

  it('maps rows and passes the user filter', async () => {
    rpc.mockResolvedValue({
      data: [
        { kind: 'answer', id: '5', submitted_by: 'u1', submitted_at: 't', image_no: 'a', description: null, subject: 'S', before: { shown_answer: 'x' }, proposed: { answer: 'y', mode: 'm' }, current: null, stale: false },
      ],
      error: null,
    })
    const r = await listHeld('u1')
    expect(rpc).toHaveBeenCalledWith('held_list', { p_user: 'u1' })
    expect(r[0].id).toBe(5)
    expect(r[0].description).toBeNull()
    expect(r[0].current_updated_at).toBeNull()
  })

  it('passes null with no user', async () => {
    rpc.mockResolvedValue({ data: [], error: null })
    await listHeld()
    expect(rpc).toHaveBeenCalledWith('held_list', { p_user: null })
  })
})

describe('summaryLine', () => {
  it('has the exact shapes', () => {
    const r = { done: 3, stale: [{ id: 1, current_values: [], current_status: '' }], skipped: [] }
    expect(summaryLine(r, 'approved')).toBe('3 approved, 1 changed since, 0 skipped')
    expect(summaryLine({ done: 2, stale: [], skipped: [{ id: 1, reason: 'x' }] }, 'rejected')).toBe('2 rejected, 1 skipped')
  })
})
