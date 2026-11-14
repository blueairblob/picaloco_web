import { adminSupabase } from '@/lib/supabase/adminClient'
import type { QueueParams } from '@/lib/queueParams'

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

export interface QueueRecord {
  image_no: string
  description: string | null
  collection: string | null
  date_taken: string | null
  cd_no: string | null
  values: string[]
  suggested_values: string[]
  confidence: FixConfidence
  status: FixStatus
  needs_recheck: boolean
  // Kept exactly as the server sent it (microseconds): it is the optimistic-lock token.
  updated_at: string
}

export type ReviewOutcome =
  | { ok: true; updated_at: string }
  | { ok: false; reason: 'stale' | 'forbidden' | 'signed-out' | 'error'; message: string }

// The server matches p_text with ILIKE; escape its wildcards so the reviewer's text matches literally.
export function escapeLike(s: string): string {
  return s.replace(/[\\%_]/g, '\\$&')
}

export async function getQueuePage(
  fixId: string,
  p: QueueParams,
  after: string | null,
  limit = 25,
): Promise<QueueRecord[]> {
  const { data, error } = await adminSupabase.rpc('data_fix_queue', {
    p_fix_id: fixId,
    p_confidence: p.confidence.length > 0 ? p.confidence : null,
    p_status: p.status,
    p_include_recheck: p.includeRecheck,
    p_collection: p.collection,
    p_text: p.text ? escapeLike(p.text) : null,
    p_after: after,
    p_limit: limit,
  })
  if (error) throw error
  return ((data ?? []) as QueueRecord[]).map((r) => ({
    ...r,
    values: r.values ?? [],
    suggested_values: r.suggested_values ?? [],
  }))
}

export async function getValue(
  fixId: string,
  imageNo: string,
): Promise<Pick<QueueRecord, 'values' | 'suggested_values' | 'status' | 'needs_recheck' | 'updated_at'> | null> {
  const { data, error } = await adminSupabase
    .from('data_fix_value')
    .select('values,suggested_values,status,needs_recheck,updated_at')
    .eq('image_no', imageNo)
    .eq('fix_id', fixId)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  const row = data as Pick<QueueRecord, 'values' | 'suggested_values' | 'status' | 'needs_recheck' | 'updated_at'>
  return { ...row, values: row.values ?? [], suggested_values: row.suggested_values ?? [] }
}

export function mapReviewError(err: {
  code?: string
  message?: string
  status?: number
}): 'stale' | 'forbidden' | 'signed-out' | 'error' {
  if (err.code === '40001') return 'stale'
  if (err.status === 401 || err.code === 'PGRST301' || /JWT expired/i.test(err.message ?? '')) return 'signed-out'
  if (err.code === '42501') return 'forbidden'
  return 'error'
}

async function hasSession(): Promise<boolean> {
  try {
    const { data } = await adminSupabase.auth.getSession()
    return !!data.session
  } catch {
    return false
  }
}

// True when a failed call means the admin session is gone. A cleared or lost session falls back to
// the anon key, which the server answers with 42501, so that code counts too when there's no session.
export async function isSignedOutError(err: unknown): Promise<boolean> {
  const e = (err && typeof err === 'object' ? err : {}) as { code?: string; message?: string; status?: number }
  const reason = mapReviewError(e)
  if (reason === 'signed-out') return true
  return reason === 'forbidden' && !(await hasSession())
}

export async function reviewValue(i: {
  imageNo: string
  fixId: string
  values: string[]
  status: Exclude<FixStatus, 'extracted'>
  expectedUpdatedAt: string
}): Promise<ReviewOutcome> {
  try {
    const { data, error, status } = await adminSupabase.rpc('review_fix_value', {
      p_image_no: i.imageNo,
      p_fix_id: i.fixId,
      p_values: i.values,
      p_status: i.status,
      // Never parse into a Date: that drops the microseconds and every save turns stale.
      p_expected_updated_at: i.expectedUpdatedAt,
    })
    if (error) {
      let reason = mapReviewError({ ...error, status })
      if (reason === 'forbidden' && !(await hasSession())) reason = 'signed-out'
      return { ok: false, reason, message: error.message }
    }
    const row = (Array.isArray(data) ? data[0] : data) as { updated_at?: string } | null
    if (!row?.updated_at) return { ok: false, reason: 'error', message: 'The server returned no record.' }
    return { ok: true, updated_at: row.updated_at }
  } catch (e) {
    return { ok: false, reason: 'error', message: e instanceof Error ? e.message : String(e) }
  }
}

export function normaliseValues(input: string): string[] {
  const out: string[] = []
  for (const part of input.split(/[\n;]/)) {
    const v = part.trim()
    if (v && !out.includes(v)) out.push(v)
  }
  return out
}

// Soft warnings only: the reviewer may still save.
export function formatWarnings(values: string[]): string[] {
  const out: string[] = []
  for (const v of values) {
    if ([...v].length > 20) out.push(`"${v}" is longer than 20 characters`)
    if (/[^A-Za-z0-9 ./\-'&]/.test(v)) out.push(`"${v}" contains unusual characters`)
  }
  return out
}

export interface ConfirmItem {
  image_no: string
  updated_at: string
}

// Only still-open (extracted) records the reviewer left ticked. updated_at is the server's own
// string, untouched: a Date would drop the microseconds and every item would mismatch.
export function toConfirmItems(records: QueueRecord[], unticked: ReadonlySet<string>): ConfirmItem[] {
  return records
    .filter((r) => r.status === 'extracted' && !unticked.has(r.image_no))
    .map((r) => ({ image_no: r.image_no, updated_at: r.updated_at }))
}

// Returns how many were actually confirmed; stale or already-reviewed items are skipped server-side.
export async function confirmMany(fixId: string, items: ConfirmItem[]): Promise<number> {
  const { data, error } = await adminSupabase.rpc('confirm_fix_values', { p_fix_id: fixId, p_items: items })
  if (error) throw error
  return Number(data ?? 0)
}
