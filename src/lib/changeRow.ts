import { STATUS_LABEL } from '@/lib/fixStatusLabel'
import type { ShowMode } from '@/lib/changeFilters'
import type { FixStatus } from '@/services/dataFixService'

export interface ChangeRow {
  cursor: string
  kind: string
  at: string
  by_user: string | null
  approved_by: string | null
  image_no: string | null
  subject: string | null
  before: Record<string, unknown> | null
  after: Record<string, unknown> | null
  ref_table: string | null
  ref_id: number | null
  undone: boolean
}

export const KIND_LABEL: Record<string, string> = {
  fix_review: 'Data fix review',
  fix_model_check: 'Data fix from Model check',
  fix_undo: 'Undo of a data fix',
  answer: 'Model check answer',
  answer_withdrawn: 'Model check answer withdrawn',
  held_submitted: 'Sent for approval',
  held_approved: 'Approved',
  held_rejected: 'Rejected',
}

function fixText(v: Record<string, unknown> | null): string {
  if (!v) return '(none)'
  const values = Array.isArray(v.values) ? (v.values as unknown[]).map(String).join('; ') : ''
  const status = typeof v.status === 'string' ? (STATUS_LABEL[v.status as FixStatus] ?? v.status) : ''
  if (status && values) return `${status}: ${values}`
  return status || values || '(none)'
}

export function describeChange(row: ChangeRow): { what: string; before: string; after: string; canUndo: boolean } {
  const label = KIND_LABEL[row.kind] ?? row.kind
  const what = row.subject ? `${label} — ${row.subject}` : label
  const canUndo = !row.undone && (row.ref_table === 'data_fix_history' || row.ref_table === 'model_answer')
  const a = row.after
  const b = row.before
  if (row.kind === 'answer') {
    const shown = b && typeof b.shown_answer === 'string' && b.shown_answer ? b.shown_answer : null
    const ans = a && typeof a.answer === 'string' ? a.answer : '(none)'
    const mode = a && typeof a.mode === 'string' ? ` (${a.mode})` : ''
    return { what, before: shown ? `AI said: ${shown}` : 'blind sample', after: `${ans}${mode}`, canUndo }
  }
  if (row.kind === 'answer_withdrawn') {
    return { what, before: '', after: a && typeof a.note === 'string' && a.note ? a.note : '(no note)', canUndo }
  }
  const note = row.kind === 'held_rejected' && a && typeof a.note === 'string' && a.note ? ` — ${a.note}` : ''
  return { what, before: fixText(b), after: `${fixText(a)}${note}`, canUndo }
}

// The rows "Undo all" sends. Undo rows are left out unless Show is "Undos":
// undoing an undo re-applies the change it undid, and an already-undone change
// is listed beside its live undo row. Withdrawn answers are never bulk-undone.
export function bulkUndoRows(rows: ChangeRow[], mode: ShowMode): ChangeRow[] {
  return rows.filter((r) => {
    if (!describeChange(r).canUndo) return false
    if (r.kind === 'fix_undo') return mode === 'undos'
    if (r.kind === 'answer_withdrawn') return false
    return true
  })
}

// How many undoable undo rows "Undo all" leaves out (see bulkUndoRows).
export function excludedUndoCount(rows: ChangeRow[], mode: ShowMode): number {
  return mode === 'undos' ? 0 : rows.filter((r) => r.kind === 'fix_undo' && describeChange(r).canUndo).length
}
