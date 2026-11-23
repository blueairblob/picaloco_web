import { adminSupabase } from '@/lib/supabase/adminClient'
import type { CheckMode, CheckParams } from '@/lib/modelCheckParams'
import { mapReviewError, type FixConfidence, type FixStatus } from '@/services/dataFixService'

export type { CheckMode, CheckParams }

export interface ModelAnswerDef {
  key: string
  id: string
  label: string
  [flag: string]: unknown
}

export interface ModelTask {
  id: string
  question: string
  answers: ModelAnswerDef[]
  sure_threshold: number
  links: { no_answer_flag: string; fix_ids: string[] } | null
  sort_order: number
}

export interface ModelRun {
  id: number
  task_id: string
  model: string
  version: string
  created_at: string
  n_predictions: number
}

export interface RunProgress {
  task_id: string
  run_id: number
  model: string
  version: string
  created_at: string
  n_predictions: number
  n_checked: number
  n_agree: number
  n_blind: number
  n_blind_correct: number
}

export interface ConfusionRow {
  model_answer: string
  checked_answer: string
  n: number
}

export interface FixStateEntry {
  status: FixStatus
  confidence: FixConfidence
  values: string[]
  suggested_values: string[]
}

export interface ConflictRow {
  image_no: string
  answer: string
  fix_id: string
  status: FixStatus
  confidence: FixConfidence
  values: string[]
  suggested_values: string[]
}

export type SaveConflict = FixStateEntry & { fix_id: string }

export interface CheckRecord {
  image_no: string
  sort_key: string
  description: string | null
  collection: string | null
  date_taken: string | null
  cd_no: string | null
  model_answer: string | null
  model_p: number | null
  // Always NULL from the server today; kept nullable.
  checked_answer: string | null
  checked_at: string | null
  fix_state: Record<string, FixStateEntry> | null
}

// One photo with its latest answer, to answer again (rat.model_check_photo).
export interface CheckPhoto extends CheckRecord {
  // How the latest answer was given; null if the photo was never answered.
  checked_mode: CheckMode | null
  // The run whose prediction is shown (the one asked for, or the newest).
  run_id: number | null
}

export type SaveOutcome =
  | { ok: true; filled: string[]; conflicts: SaveConflict[]; held?: false }
  | { ok: true; held: true; filled: string[]; conflicts: SaveConflict[] }
  | { ok: false; reason: 'forbidden' | 'signed-out' | 'error'; message: string }

export async function getTasks(): Promise<ModelTask[]> {
  const { data, error } = await adminSupabase
    .from('model_task')
    .select('id, question, answers, sure_threshold, links, sort_order')
    .order('sort_order', { ascending: true })
  if (error) throw error
  return (data ?? []) as ModelTask[]
}

export async function getRuns(taskId: string): Promise<ModelRun[]> {
  const { data, error } = await adminSupabase
    .from('model_run')
    .select('id, task_id, model, version, created_at, n_predictions')
    .eq('task_id', taskId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as ModelRun[]
}

export async function getRunProgress(): Promise<RunProgress[]> {
  const { data, error } = await adminSupabase.rpc('model_check_progress')
  if (error) throw error
  return ((data ?? []) as RunProgress[]).map((r) => ({
    ...r,
    n_checked: Number(r.n_checked),
    n_agree: Number(r.n_agree),
    n_blind: Number(r.n_blind),
    n_blind_correct: Number(r.n_blind_correct),
  }))
}

export async function getConfusion(runId: number, blindOnly = true): Promise<ConfusionRow[]> {
  const { data, error } = await adminSupabase.rpc('model_check_confusion', {
    p_run_id: runId,
    p_blind_only: blindOnly,
  })
  if (error) throw error
  return ((data ?? []) as ConfusionRow[]).map((r) => ({ ...r, n: Number(r.n) }))
}

export async function getConflicts(taskId: string): Promise<ConflictRow[]> {
  const { data, error } = await adminSupabase.rpc('model_check_conflicts', { p_task_id: taskId })
  if (error) throw error
  return ((data ?? []) as ConflictRow[]).map((r) => ({
    ...r,
    values: r.values ?? [],
    suggested_values: r.suggested_values ?? [],
  }))
}

export async function getCheckQueuePage(
  taskId: string,
  p: CheckParams,
  after: string | null,
  limit = 25,
): Promise<CheckRecord[]> {
  const { data, error } = await adminSupabase.rpc('model_check_queue', {
    p_task_id: taskId,
    p_mode: p.mode,
    p_run_id: p.mode === 'sample' ? null : p.run,
    p_answer: p.mode === 'sample' ? null : p.answer,
    p_collection: p.mode === 'sample' ? null : p.collection,
    p_after: after,
    p_limit: limit,
  })
  if (error) throw error
  return (data ?? []) as CheckRecord[]
}

export async function getCheckPhoto(taskId: string, imageNo: string, runId: number | null): Promise<CheckPhoto | null> {
  const { data, error } = await adminSupabase.rpc('model_check_photo', {
    p_task_id: taskId,
    p_image_no: imageNo,
    p_run_id: runId,
  })
  if (error) throw error
  return ((data ?? []) as CheckPhoto[])[0] ?? null
}

async function hasSession(): Promise<boolean> {
  try {
    const { data } = await adminSupabase.auth.getSession()
    return !!data.session
  } catch {
    return false
  }
}

export async function saveModelAnswer(i: {
  taskId: string
  imageNo: string
  answer: string
  mode: CheckMode
  shownRunId: number | null
  shownAnswer: string | null
}, opts?: { trainee?: boolean }): Promise<SaveOutcome> {
  try {
    const blind = i.mode === 'sample'
    const { data, error, status } = await adminSupabase.rpc(opts?.trainee ? 'submit_model_answer' : 'save_model_answer', {
      p_task_id: i.taskId,
      p_image_no: i.imageNo,
      p_answer: i.answer,
      p_shown_run_id: blind ? null : i.shownRunId,
      p_shown_answer: blind ? null : i.shownAnswer,
      p_mode: i.mode,
    })
    if (error) {
      let reason = mapReviewError({ ...error, status })
      if (reason === 'forbidden' && !(await hasSession())) reason = 'signed-out'
      return { ok: false, reason: reason === 'stale' ? 'error' : reason, message: error.message }
    }
    if (opts?.trainee) return { ok: true, held: true, filled: [], conflicts: [] }
    const row = (data ?? {}) as { filled?: string[]; conflicts?: SaveConflict[] }
    return { ok: true, filled: row.filled ?? [], conflicts: row.conflicts ?? [] }
  } catch (e) {
    return { ok: false, reason: 'error', message: e instanceof Error ? e.message : String(e) }
  }
}
