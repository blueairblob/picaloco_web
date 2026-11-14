import { adminSupabase } from '@/lib/supabase/adminClient'

export type FixConfidence = 'none' | 'low' | 'med' | 'high'
export type FixStatus = 'extracted' | 'verified' | 'corrected' | 'none_visible' | 'no_loco'
export const CONFIDENCE_ORDER: FixConfidence[] = ['none', 'low', 'med', 'high']

export interface DataFix {
  id: string
  title: string
  summary: string | null
  instructions: string
  sort_order: number
}

export interface ProgressRow {
  fix_id: string
  status: FixStatus
  confidence: FixConfidence
  needs_recheck: boolean
  n: number
}

export interface FixProgress {
  total: number
  reviewed: number
  needsRecheck: number
  byConfidence: Record<FixConfidence, { total: number; open: number }>
}

export async function getFixes(): Promise<DataFix[]> {
  const { data, error } = await adminSupabase
    .from('data_fix')
    .select('id, title, summary, instructions, sort_order')
    .order('sort_order', { ascending: true })
  if (error) throw error
  return (data ?? []) as DataFix[]
}

export async function getProgress(): Promise<ProgressRow[]> {
  const { data, error } = await adminSupabase.rpc('data_fix_progress')
  if (error) throw error
  return ((data ?? []) as ProgressRow[]).map((r) => ({ ...r, n: Number(r.n) }))
}

export async function getOrphans(): Promise<{ image_no: string; fix_id: string; status: FixStatus }[]> {
  const { data, error } = await adminSupabase.rpc('data_fix_orphans')
  if (error) throw error
  return (data ?? []) as { image_no: string; fix_id: string; status: FixStatus }[]
}

export function summariseProgress(rows: ProgressRow[], fixId: string): FixProgress {
  const out: FixProgress = {
    total: 0,
    reviewed: 0,
    needsRecheck: 0,
    byConfidence: {
      none: { total: 0, open: 0 },
      low: { total: 0, open: 0 },
      med: { total: 0, open: 0 },
      high: { total: 0, open: 0 },
    },
  }
  for (const r of rows) {
    if (r.fix_id !== fixId) continue
    const open = r.status === 'extracted'
    out.total += r.n
    if (!open) out.reviewed += r.n
    if (r.needs_recheck) out.needsRecheck += r.n
    const b = out.byConfidence[r.confidence]
    if (b) {
      b.total += r.n
      if (open) b.open += r.n
    }
  }
  return out
}
