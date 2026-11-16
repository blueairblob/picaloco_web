import { beforeEach, describe, expect, it, vi } from 'vitest'

const rpc = vi.fn()
const getSession = vi.fn()
const from = vi.fn()
vi.mock('@/lib/supabase/adminClient', () => ({
  adminSupabase: {
    rpc: (...a: unknown[]) => rpc(...a),
    from: (...a: unknown[]) => from(...a),
    auth: { getSession: () => getSession() },
  },
}))

import { getCheckQueuePage, saveModelAnswer } from './modelCheckService'

beforeEach(() => {
  rpc.mockReset()
  getSession.mockReset()
})

describe('getCheckQueuePage', () => {
  it('sends a blind sample with no run or filters', async () => {
    rpc.mockResolvedValue({ data: [], error: null })
    await getCheckQueuePage('subject_type', { run: 7, mode: 'sample', answer: 'tram', collection: 'X' }, null, 10)
    expect(rpc).toHaveBeenCalledWith('model_check_queue', {
      p_task_id: 'subject_type',
      p_mode: 'sample',
      p_run_id: null,
      p_answer: null,
      p_collection: null,
      p_after: null,
      p_limit: 10,
    })
  })
  it('sends run and filters in sure mode', async () => {
    rpc.mockResolvedValue({ data: [], error: null })
    await getCheckQueuePage('t', { run: 7, mode: 'sure', answer: 'tram', collection: 'X' }, 'k', 25)
    expect(rpc.mock.calls[0][1]).toMatchObject({ p_mode: 'sure', p_run_id: 7, p_answer: 'tram', p_collection: 'X', p_after: 'k' })
  })
})

describe('saveModelAnswer', () => {
  const base = { taskId: 't', imageNo: 'arc1', answer: 'tram' }

  it('sends no shown run or answer in sample mode', async () => {
    rpc.mockResolvedValue({ data: { answer_id: 1, filled: [], conflicts: [] }, error: null, status: 200 })
    await saveModelAnswer({ ...base, mode: 'sample', shownRunId: 5, shownAnswer: 'steam' })
    expect(rpc).toHaveBeenCalledWith('save_model_answer', {
      p_task_id: 't',
      p_image_no: 'arc1',
      p_answer: 'tram',
      p_shown_run_id: null,
      p_shown_answer: null,
      p_mode: 'sample',
    })
  })
  it('returns filled and conflicts', async () => {
    const conflicts = [{ fix_id: 'loco_number', status: 'extracted', confidence: 'high', values: [], suggested_values: ['6853'] }]
    rpc.mockResolvedValue({ data: { answer_id: 1, filled: ['loco_name'], conflicts }, error: null, status: 200 })
    expect(await saveModelAnswer({ ...base, mode: 'sure', shownRunId: 5, shownAnswer: 'steam' })).toEqual({
      ok: true,
      filled: ['loco_name'],
      conflicts,
    })
  })
  it('maps a 42501 with no session to signed-out', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: '42501', message: 'not a data fixes admin' }, status: 403 })
    getSession.mockResolvedValue({ data: { session: null } })
    expect(await saveModelAnswer({ ...base, mode: 'sure', shownRunId: 5, shownAnswer: 'steam' })).toMatchObject({
      ok: false,
      reason: 'signed-out',
    })
  })
  it('maps a 42501 with a session to forbidden', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: '42501', message: 'no' }, status: 403 })
    getSession.mockResolvedValue({ data: { session: { user: {} } } })
    expect(await saveModelAnswer({ ...base, mode: 'sure', shownRunId: 5, shownAnswer: 'x' })).toMatchObject({
      ok: false,
      reason: 'forbidden',
    })
  })
})
