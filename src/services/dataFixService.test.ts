import { beforeEach, describe, expect, it, vi } from 'vitest'

const rpc = vi.fn()
const getSession = vi.fn()
vi.mock('@/lib/supabase/adminClient', () => ({
  adminSupabase: { rpc: (...a: unknown[]) => rpc(...a), auth: { getSession: () => getSession() } },
}))

import {
  escapeLike,
  formatWarnings,
  isSignedOutError,
  getQueuePage,
  mapReviewError,
  normaliseValues,
  reviewValue,
  summariseProgress,
  type ProgressRow,
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
    expect(mapReviewError({ code: '40001' })).toBe('stale')
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
    rpc.mockResolvedValue({ data: null, error: { code: '40001', message: 'changed' }, status: 400 })
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
