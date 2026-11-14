import { describe, expect, it } from 'vitest'
import { summariseProgress, type ProgressRow } from './dataFixService'

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
