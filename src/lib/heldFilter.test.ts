import { describe, expect, it } from 'vitest'
import { recentRejected } from './heldFilter'
import type { HeldMine } from '@/services/approvalService'

const now = Date.parse('2026-11-23T12:00:00Z')
const h = (id: number, decision: 'pending' | 'rejected', decided_at: string | null): HeldMine => ({
  kind: 'fix', id, image_no: 'a', subject: 's', proposed: {}, decision, decided_at, note: null,
})

describe('recentRejected', () => {
  it('keeps recent rejected only, newest first', () => {
    const r = recentRejected(
      [
        h(1, 'rejected', '2026-11-01T00:00:00Z'),
        h(2, 'rejected', '2026-11-20T00:00:00Z'),
        h(3, 'rejected', '2026-09-01T00:00:00Z'),
        h(4, 'pending', null),
        h(5, 'rejected', null),
      ],
      now,
    )
    expect(r.map((x) => x.id)).toEqual([2, 1])
  })
  it('includes exactly 30 days ago, excludes just older', () => {
    expect(recentRejected([h(1, 'rejected', '2026-10-24T12:00:00Z')], now)).toHaveLength(1)
    expect(recentRejected([h(1, 'rejected', '2026-10-24T11:59:59Z')], now)).toHaveLength(0)
  })
})
