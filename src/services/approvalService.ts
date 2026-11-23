import { adminSupabase } from '@/lib/supabase/adminClient'

// One of the caller's own held items: waiting for approval, or sent back with a note.
export interface HeldMine {
  kind: 'fix' | 'answer'
  id: number
  image_no: string
  subject: string
  proposed: Record<string, unknown>
  decision: 'pending' | 'rejected'
  decided_at: string | null
  note: string | null
}

export async function myHeld(): Promise<HeldMine[]> {
  const { data, error } = await adminSupabase.rpc('my_held')
  if (error) throw error
  return ((data ?? []) as HeldMine[]).map((r) => ({
    ...r,
    id: Number(r.id),
    proposed: r.proposed ?? {},
    decided_at: r.decided_at ?? null,
    note: r.note ?? null,
  }))
}
