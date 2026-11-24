import { STATUS_LABEL } from '@/lib/fixStatusLabel'
import type { Question } from '@/lib/changeFilters'
import type { ChangeRow } from '@/lib/changeRow'
import type { FixStatus } from '@/services/dataFixService'

export function headings(q: Question): { then: string; now: string; showQuestion: boolean } {
  if (q.kind === 'task') return { then: 'AI said', now: 'Answer', showQuestion: false }
  return { then: 'Then', now: 'Now', showQuestion: q.kind === 'all' }
}

function fixCell(v: Record<string, unknown> | null): string {
  if (!v) return ''
  const values = Array.isArray(v.values) ? (v.values as unknown[]).map(String).join('; ') : ''
  const s = typeof v.status === 'string' ? v.status : ''
  const status = s === 'extracted' ? 'Suggested' : (STATUS_LABEL[s as FixStatus] ?? s)
  return [status, values].filter(Boolean).join(' ')
}

export function cellText(
  row: ChangeRow,
  answerLabel?: (taskAnswerId: string) => string | undefined,
): { then: string; now: string } {
  const label = (id: string) => answerLabel?.(id) ?? id
  const b = row.before
  const a = row.after
  if (row.kind === 'answer_withdrawn') {
    return { then: '', now: a && typeof a.note === 'string' ? a.note : '' }
  }
  const isAnswer =
    row.kind === 'answer' ||
    row.ref_table === 'pending_model_answer' ||
    (row.ref_table === null && !!((b && 'shown_answer' in b) || (a && 'answer' in a)))
  if (isAnswer) {
    const shown = b && typeof b.shown_answer === 'string' && b.shown_answer ? label(b.shown_answer) : 'blind'
    const ans = a && typeof a.answer === 'string' ? label(a.answer) : ''
    return { then: shown, now: ans }
  }
  return { then: fixCell(b), now: fixCell(a) }
}

export function statusText(row: ChangeRow, emailOf: (id: string | null) => string): string {
  if (row.undone) return 'undone'
  if (row.kind === 'held_approved') return `✓ ${emailOf(row.by_user)}`
  if (row.approved_by) return `✓ ${emailOf(row.approved_by)}`
  if (row.kind === 'held_submitted') return 'held'
  if (row.kind === 'held_rejected') {
    const n = row.after && typeof row.after.note === 'string' ? row.after.note : ''
    return n ? `rejected: ${n}` : 'rejected'
  }
  if (row.kind === 'fix_undo') return 'undo'
  if (row.kind === 'answer_withdrawn') return 'withdrawn'
  return ''
}

export function tableMode(loading: boolean, error: boolean, rowCount: number): 'loading' | 'error' | 'empty' | 'rows' {
  if (rowCount > 0) return 'rows'
  if (loading) return 'loading'
  if (error) return 'error'
  return 'empty'
}
