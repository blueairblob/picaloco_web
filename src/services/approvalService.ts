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

// One pending item as an admin sees it. fix: before/proposed/current are {values, status};
// answer: before {shown_answer}, proposed {answer, mode}, current null.
export interface HeldItem {
  kind: 'fix' | 'answer'
  id: number
  submitted_by: string
  submitted_at: string
  image_no: string
  description: string | null
  subject: string
  before: Record<string, unknown> | null
  proposed: Record<string, unknown> | null
  current: Record<string, unknown> | null
  stale: boolean
}

export type DecisionResult = {
  done: number
  stale: { id: number; current_values: string[]; current_status: string }[]
  skipped: { id: number; reason: string }[]
}

export async function listHeld(userId?: string): Promise<HeldItem[]> {
  const { data, error } = await adminSupabase.rpc('held_list', { p_user: userId ?? null })
  if (error) throw error
  return ((data ?? []) as HeldItem[]).map((r) => ({
    ...r,
    id: Number(r.id),
    description: r.description ?? null,
    before: r.before ?? null,
    proposed: r.proposed ?? null,
    current: r.current ?? null,
    stale: Boolean(r.stale),
  }))
}

type RawResult = {
  approved?: number
  rejected?: number
  stale?: { id: number | string; current_values?: string[]; current_status?: string }[]
  skipped?: { id: number | string; reason: string }[]
} | null

function toResult(raw: RawResult): DecisionResult {
  return {
    done: Number(raw?.approved ?? raw?.rejected ?? 0),
    stale: (raw?.stale ?? []).map((s) => ({
      id: Number(s.id),
      current_values: s.current_values ?? [],
      current_status: s.current_status ?? '',
    })),
    skipped: (raw?.skipped ?? []).map((s) => ({ id: Number(s.id), reason: s.reason })),
  }
}

export async function approve(kind: 'fix' | 'answer', ids: number[], force = false): Promise<DecisionResult> {
  const { data, error } =
    kind === 'fix'
      ? await adminSupabase.rpc('approve_fix_review', { p_ids: ids, p_force: force })
      : await adminSupabase.rpc('approve_model_answer', { p_ids: ids })
  if (error) throw error
  return toResult(data as RawResult)
}

export async function reject(kind: 'fix' | 'answer', ids: number[], note?: string): Promise<DecisionResult> {
  const { data, error } = await adminSupabase.rpc('reject_held', { p_kind: kind, p_ids: ids, p_note: note || null })
  if (error) throw error
  return toResult(data as RawResult)
}

export function summaryLine(r: DecisionResult, verb: 'approved' | 'rejected'): string {
  if (verb === 'rejected') return `${r.done} rejected, ${r.skipped.length} skipped`
  return `${r.done} approved, ${r.stale.length} changed since, ${r.skipped.length} skipped`
}
