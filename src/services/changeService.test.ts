import { beforeEach, describe, expect, it, vi } from 'vitest'

const rpc = vi.fn()
vi.mock('@/lib/supabase/adminClient', () => ({ adminSupabase: { rpc: (...a: unknown[]) => rpc(...a) } }))

import { listChanges, undoRows } from './changeService'
import type { ChangeRow } from '@/lib/changeRow'

const row = (i: number, ref_table: string): ChangeRow => ({
  cursor: String(i), kind: 'fix_review', at: '', by_user: 'u', approved_by: null, image_no: 'a', subject: 's',
  before: null, after: null, ref_table, ref_id: i, undone: false,
})

beforeEach(() => {
  rpc.mockReset()
})

describe('listChanges', () => {
  it('maps filters to params and normalises ids', async () => {
    rpc.mockResolvedValue({ data: [{ ...row(1, 'data_fix_history'), ref_id: '7' }], error: null })
    const r = await listChanges({ userId: 'u1', from: 'f', to: 't', kinds: ['answer'] }, 'cur')
    expect(rpc).toHaveBeenCalledWith('change_list', {
      p_user: 'u1', p_from: 'f', p_to: 't', p_kinds: ['answer'], p_after: 'cur', p_limit: 100,
    })
    expect(r[0].ref_id).toBe(7)
  })
  it('sends nulls when unfiltered; throws on error', async () => {
    rpc.mockResolvedValue({ data: null, error: null })
    await listChanges({})
    expect(rpc).toHaveBeenCalledWith('change_list', { p_user: null, p_from: null, p_to: null, p_kinds: null, p_after: null, p_limit: 100 })
    rpc.mockResolvedValue({ data: null, error: new Error('x') })
    await expect(listChanges({})).rejects.toThrow()
  })
})

describe('undoRows', () => {
  it('chunks 1201 fix rows into 500/500/201', async () => {
    rpc.mockResolvedValue({ data: { undone: 1, changed_since: [], skipped: [] }, error: null })
    const rows = Array.from({ length: 1201 }, (_, i) => row(i, 'data_fix_history'))
    const r = await undoRows(rows)
    expect(rpc.mock.calls.map((c) => [c[0], c[1].p_history_ids.length])).toEqual([
      ['undo_fix_change', 500], ['undo_fix_change', 500], ['undo_fix_change', 201],
    ])
    expect(r).toEqual({ done: 3, changedSince: 0, notUndoneHere: 0, skipped: 0 })
  })
  it('routes answers to withdraw and never sends held rows', async () => {
    rpc.mockResolvedValue({ data: { withdrawn: 2, fills_left: [{}], skipped: [] }, error: null })
    const r = await undoRows([row(1, 'model_answer'), row(2, 'model_answer'), row(3, 'pending_fix_review')])
    expect(rpc).toHaveBeenCalledTimes(1)
    expect(rpc).toHaveBeenCalledWith('withdraw_model_answers', { p_answer_ids: [1, 2], p_note: null })
    expect(r).toEqual({ done: 2, changedSince: 0, notUndoneHere: 1, skipped: 0 })
  })
  it('stops on a failed chunk and reports partial totals', async () => {
    rpc.mockResolvedValueOnce({ data: { undone: 500, changed_since: [], skipped: [] }, error: null })
    rpc.mockResolvedValueOnce({ data: null, error: new Error('boom') })
    const rows = Array.from({ length: 1001 }, (_, i) => row(i, 'data_fix_history'))
    await expect(undoRows(rows)).rejects.toMatchObject({ partial: { done: 500, changedSince: 0, notUndoneHere: 0, skipped: 0 } })
    expect(rpc).toHaveBeenCalledTimes(2)
  })
})
