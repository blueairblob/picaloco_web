import { adminSupabase } from '@/lib/supabase/adminClient'
import { chunk, sumBatchResults, type BatchResult, type BatchTotals } from '@/lib/chunk'
import type { ChangeRow } from '@/lib/changeRow'

export interface ChangeFilters {
  userId?: string
  from?: string
  to?: string
  kinds?: string[]
  fixId?: string
  taskId?: string
}

const PAGE = 100
const CHUNK = 500

export async function listChanges(f: ChangeFilters, after?: string): Promise<ChangeRow[]> {
  const { data, error } = await adminSupabase.rpc('change_list', {
    p_user: f.userId ?? null,
    p_from: f.from ?? null,
    p_to: f.to ?? null,
    p_kinds: f.kinds && f.kinds.length > 0 ? f.kinds : null,
    p_after: after ?? null,
    p_limit: PAGE,
    p_fix_id: f.fixId ?? null,
    p_task_id: f.taskId ?? null,
  })
  if (error) throw error
  return ((data ?? []) as Array<Omit<ChangeRow, 'ref_id'> & { ref_id: number | string | null }>).map((r) => ({
    ...r,
    ref_id: r.ref_id == null ? null : Number(r.ref_id),
  }))
}

export class PartialUndoError extends Error {
  partial: BatchTotals
  constructor(cause: unknown, partial: BatchTotals) {
    super(cause instanceof Error ? cause.message : 'Undo failed')
    this.partial = partial
  }
}

export async function undoRows(rows: ChangeRow[]): Promise<BatchTotals> {
  const ids = (table: string) => rows.filter((r) => r.ref_table === table && r.ref_id != null).map((r) => Number(r.ref_id))
  const jobs: Array<[string, string, number[], Record<string, unknown>]> = [
    ...chunk(ids('data_fix_history'), CHUNK).map((c) => ['undo_fix_change', 'p_history_ids', c, {}] as [string, string, number[], Record<string, unknown>]),
    ...chunk(ids('model_answer'), CHUNK).map((c) => ['withdraw_model_answers', 'p_answer_ids', c, { p_note: null }] as [string, string, number[], Record<string, unknown>]),
  ]
  const results: BatchResult[] = []
  for (const [fn, key, c, extra] of jobs) {
    const { data, error } = await adminSupabase.rpc(fn, { [key]: c, ...extra })
    if (error) throw new PartialUndoError(error, sumBatchResults(results))
    results.push((data ?? {}) as BatchResult)
  }
  return sumBatchResults(results)
}
