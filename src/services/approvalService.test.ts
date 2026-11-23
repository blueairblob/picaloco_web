import { beforeEach, describe, expect, it, vi } from 'vitest'

const rpc = vi.fn()
vi.mock('@/lib/supabase/adminClient', () => ({
  adminSupabase: { rpc: (...a: unknown[]) => rpc(...a) },
}))

import { myHeld } from './approvalService'

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
