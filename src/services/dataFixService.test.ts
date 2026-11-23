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

import {
  confirmMany,
  toConfirmItems,
  escapeLike,
  getCompanionValues,
  formatWarnings,
  isSignedOutError,
  getQueuePage,
  mapReviewError,
  normaliseValues,
  reviewValue,
  summariseProgress,
  type ProgressRow,
  type QueueRecord,
} from './dataFixService'
import { DEFAULT_QUEUE_PARAMS } from '@/lib/queueParams'

const rows: ProgressRow[] = [
  { fix_id: 'loco_number', status: 'extracted', confidence: 'high', needs_recheck: false, n: 10 },
  { fix_id: 'loco_number', status: 'verified', confidence: 'high', needs_recheck: false, n: 5 },
  { fix_id: 'loco_number', status: 'no_loco', confidence: 'none', needs_recheck: false, n: 2 },
  { fix_id: 'loco_number', status: 'verified', confidence: 'high', needs_recheck: true, n: 1 },
  { fix_id: 'loco_name', status: 'extracted', confidence: 'low', needs_recheck: false, n: 99 },
]

describe('summariseProgress', () => {
  it('totals one fix and ignores others', () => {
    const p = summariseProgress(rows, 'loco_number')
    expect(p.total).toBe(18)
    expect(p.reviewed).toBe(8)
    expect(p.needsRecheck).toBe(1)
    expect(p.byConfidence.high).toEqual({ total: 16, open: 10 })
    expect(p.byConfidence.none).toEqual({ total: 2, open: 0 })
    expect(p.byConfidence.low).toEqual({ total: 0, open: 0 })
    expect(p.byConfidence.med).toEqual({ total: 0, open: 0 })
  })
})

describe('mapReviewError', () => {
  it('classifies server errors', () => {
    expect(mapReviewError({ code: 'PT409' })).toBe('stale')
    expect(mapReviewError({ code: '23505', status: 409 })).toBe('error')
    expect(mapReviewError({ code: '42501' })).toBe('forbidden')
    expect(mapReviewError({ status: 401 })).toBe('signed-out')
    expect(mapReviewError({ code: 'PGRST301' })).toBe('signed-out')
    expect(mapReviewError({ message: 'JWT expired' })).toBe('signed-out')
    expect(mapReviewError({})).toBe('error')
  })
})

describe('normaliseValues', () => {
  it('splits, trims, drops empties and dedupes keeping the first', () => {
    expect(normaliseValues(' 99 7238 ;\nE113\n\n E113')).toEqual(['99 7238', 'E113'])
  })
})

describe('formatWarnings', () => {
  it('flags long values and unusual characters', () => {
    expect(formatWarnings(['42616'])).toEqual([])
    expect(formatWarnings(['x'.repeat(21)])).toHaveLength(1)
    expect(formatWarnings(['42616 ✓'])).toHaveLength(1)
  })
})

describe('getQueuePage', () => {
  beforeEach(() => rpc.mockReset())

  it('sends null confidence when none is selected and the keyset cursor', async () => {
    rpc.mockResolvedValue({ data: [], error: null })
    await getQueuePage('loco_number', DEFAULT_QUEUE_PARAMS, 'arc00010')
    expect(rpc).toHaveBeenCalledWith('data_fix_queue', {
      p_fix_id: 'loco_number',
      p_confidence: null,
      p_status: ['extracted'],
      p_include_recheck: true,
      p_collection: null,
      p_text: null,
      p_after: 'arc00010',
      p_limit: 25,
    })
  })
})

describe('escapeLike', () => {
  it('escapes LIKE wildcards and the escape character', () => {
    expect(escapeLike('50% off_peak \\ 3')).toBe('50\\% off\\_peak \\\\ 3')
    expect(escapeLike('Flying Fox')).toBe('Flying Fox')
  })

  it('is applied to the description filter', async () => {
    rpc.mockReset()
    rpc.mockResolvedValue({ data: [], error: null })
    await getQueuePage('loco_number', { ...DEFAULT_QUEUE_PARAMS, text: '100%' }, null)
    expect(rpc.mock.calls[0][1]).toMatchObject({ p_text: '100\\%' })
  })
})

describe('isSignedOutError', () => {
  beforeEach(() => getSession.mockReset())

  it('spots expired tokens and a 42501 without a session', async () => {
    expect(await isSignedOutError({ code: 'PGRST301' })).toBe(true)
    getSession.mockResolvedValue({ data: { session: null } })
    expect(await isSignedOutError({ code: '42501' })).toBe(true)
    getSession.mockResolvedValue({ data: { session: { user: {} } } })
    expect(await isSignedOutError({ code: '42501' })).toBe(false)
    expect(await isSignedOutError(new Error('Failed to fetch'))).toBe(false)
  })
})

describe('reviewValue', () => {
  beforeEach(() => {
    rpc.mockReset()
    getSession.mockReset()
  })

  const input = {
    imageNo: 'arc00001',
    fixId: 'loco_number',
    values: ['42616'],
    status: 'verified' as const,
    expectedUpdatedAt: '2026-11-14T22:00:48.944469+00:00',
  }

  it('passes updated_at through untouched and returns the new one verbatim', async () => {
    rpc.mockResolvedValue({ data: { updated_at: '2026-11-14T22:05:01.123456+00:00' }, error: null, status: 200 })
    expect(await reviewValue(input)).toEqual({ ok: true, updated_at: '2026-11-14T22:05:01.123456+00:00' })
    expect(rpc).toHaveBeenCalledWith('review_fix_value', {
      p_image_no: 'arc00001',
      p_fix_id: 'loco_number',
      p_values: ['42616'],
      p_status: 'verified',
      p_expected_updated_at: '2026-11-14T22:00:48.944469+00:00',
    })
  })

  it('reports stale', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: 'PT409', message: 'changed' }, status: 409 })
    expect(await reviewValue(input)).toMatchObject({ ok: false, reason: 'stale' })
  })

  it('reports a forbidden answer without a session as signed out', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: '42501', message: 'not admin' }, status: 403 })
    getSession.mockResolvedValue({ data: { session: null } })
    expect(await reviewValue(input)).toMatchObject({ ok: false, reason: 'signed-out' })
    getSession.mockResolvedValue({ data: { session: { user: {} } } })
    expect(await reviewValue(input)).toMatchObject({ ok: false, reason: 'forbidden' })
  })

  it('turns a thrown network error into an error outcome', async () => {
    rpc.mockRejectedValue(new Error('Failed to fetch'))
    expect(await reviewValue(input)).toEqual({ ok: false, reason: 'error', message: 'Failed to fetch' })
  })
})

describe('toConfirmItems / confirmMany', () => {
  const rec = (image_no: string, status: QueueRecord['status'], updated_at: string): QueueRecord => ({
    image_no,
    description: null,
    collection: null,
    date_taken: null,
    cd_no: null,
    values: [],
    suggested_values: ['A'],
    confidence: 'high',
    status,
    needs_recheck: false,
    updated_at,
  })

  it('sends only ticked, extracted records with the exact updated_at', () => {
    const records = [
      rec('a1', 'extracted', '2026-11-14T22:00:48.944469+00:00'),
      rec('a2', 'extracted', '2026-11-14T22:00:49.000001+00:00'),
      rec('a3', 'verified', '2026-11-14T22:00:50.000002+00:00'),
    ]
    expect(toConfirmItems(records, new Set(['a2']))).toEqual([
      { image_no: 'a1', updated_at: '2026-11-14T22:00:48.944469+00:00' },
    ])
  })

  it('passes items straight to the RPC and returns the count', async () => {
    rpc.mockResolvedValueOnce({ data: 1, error: null })
    const items = [{ image_no: 'a1', updated_at: '2026-11-14T22:00:48.944469+00:00' }]
    expect(await confirmMany('loco_number', items)).toBe(1)
    expect(rpc).toHaveBeenCalledWith('confirm_fix_values', { p_fix_id: 'loco_number', p_items: items })
  })

  it('throws on RPC error', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'boom' } })
    await expect(confirmMany('x', [])).rejects.toBeTruthy()
  })
})

describe('getCompanionValues', () => {
  const chain = (result: { data: unknown; error: unknown }) => {
    const b = {
      select: vi.fn(() => b),
      eq: vi.fn(() => b),
      in: vi.fn(() => Promise.resolve(result)),
    }
    from.mockReturnValue(b)
    return b
  }
  const dbRow = (fix_id: string, over: Record<string, unknown> = {}) => ({
    fix_id,
    values: null,
    suggested_values: null,
    confidence: 'high',
    status: 'extracted',
    needs_recheck: false,
    updated_at: '2026-01-01T00:00:00.123456+00:00',
    ...over,
  })

  beforeEach(() => from.mockReset())

  it('queries one photo and the given fixes, defaulting null arrays', async () => {
    const b = chain({ data: [dbRow('loco_name')], error: null })
    const out = await getCompanionValues('ab1', ['loco_name'])
    expect(from).toHaveBeenCalledWith('data_fix_value')
    expect(b.eq).toHaveBeenCalledWith('image_no', 'ab1')
    expect(b.in).toHaveBeenCalledWith('fix_id', ['loco_name'])
    expect(out).toHaveLength(1)
    expect(out[0].values).toEqual([])
    expect(out[0].suggested_values).toEqual([])
  })

  it('returns rows in fixIds order', async () => {
    chain({ data: [dbRow('b'), dbRow('a')], error: null })
    const out = await getCompanionValues('ab1', ['a', 'b'])
    expect(out.map((r) => r.fix_id)).toEqual(['a', 'b'])
  })

  it('makes no request without fixes', async () => {
    expect(await getCompanionValues('ab1', [])).toEqual([])
    expect(from).not.toHaveBeenCalled()
  })

  it('throws a returned error', async () => {
    const err = { message: 'boom' }
    chain({ data: null, error: err })
    await expect(getCompanionValues('ab1', ['a'])).rejects.toBe(err)
  })
})

describe('trainee saves', () => {
  beforeEach(() => {
    rpc.mockReset()
    getSession.mockResolvedValue({ data: { session: {} } })
  })

  it('trainee reviews go to submit_fix_review and come back held', async () => {
    rpc.mockResolvedValue({ data: 7, error: null, status: 200 })
    const out = await reviewValue(
      { imageNo: 'arc1', fixId: 'loco_number', values: ['42'], status: 'verified', expectedUpdatedAt: '2026-11-14T22:05:01.123456+00:00' },
      { trainee: true },
    )
    expect(rpc).toHaveBeenCalledWith('submit_fix_review', {
      p_image_no: 'arc1',
      p_fix_id: 'loco_number',
      p_values: ['42'],
      p_status: 'verified',
      p_expected_updated_at: '2026-11-14T22:05:01.123456+00:00',
    })
    expect(out).toEqual({ ok: true, held: true })
  })

  it('trainee review keeps the stale mapping', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: 'PT409', message: 'stale' }, status: 409 })
    const out = await reviewValue(
      { imageNo: 'a', fixId: 'f', values: [], status: 'verified', expectedUpdatedAt: 'x' },
      { trainee: true },
    )
    expect(out).toMatchObject({ ok: false, reason: 'stale' })
  })

  it('trainee confirmMany goes to submit_fix_confirm and returns the count', async () => {
    rpc.mockResolvedValue({ data: 3, error: null })
    const items = [{ image_no: 'a', updated_at: 'x' }]
    expect(await confirmMany('loco_number', items, { trainee: true })).toBe(3)
    expect(rpc).toHaveBeenCalledWith('submit_fix_confirm', { p_fix_id: 'loco_number', p_items: items })
  })
})
