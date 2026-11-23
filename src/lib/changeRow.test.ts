import { describe, expect, it } from 'vitest'
import { bulkUndoRows, describeChange, type ChangeRow } from './changeRow'

const base: ChangeRow = {
  cursor: 'c', kind: 'fix_review', at: '2026-11-20T10:00:00Z', by_user: 'u', approved_by: null,
  image_no: 'arc1', subject: 'Loco number', before: null, after: null,
  ref_table: 'data_fix_history', ref_id: 1, undone: false,
}
const vals = (values: string[], status: string) => ({ values, status })

describe('describeChange', () => {
  it('fix_review', () => {
    const d = describeChange({ ...base, before: vals(['1234'], 'extracted'), after: vals(['1234', '5678'], 'verified') })
    expect(d.what).toBe('Data fix review — Loco number')
    expect(d.before).toBe('Not reviewed: 1234')
    expect(d.after).toBe('Verified: 1234; 5678')
    expect(d.canUndo).toBe(true)
  })
  it('fix_model_check and fix_undo', () => {
    expect(describeChange({ ...base, kind: 'fix_model_check' }).what).toBe('Data fix from Model check — Loco number')
    const u = describeChange({ ...base, kind: 'fix_undo' })
    expect(u.what).toBe('Undo of a data fix — Loco number')
    expect(u.before).toBe('(none)')
  })
  it('answer with AI shown', () => {
    const d = describeChange({
      ...base, kind: 'answer', subject: 'Is this a tram?', ref_table: 'model_answer',
      before: { shown_answer: 'yes' }, after: { answer: 'no', mode: 'sure' },
    })
    expect(d.what).toBe('Model check answer — Is this a tram?')
    expect(d.before).toBe('AI said: yes')
    expect(d.after).toBe('no (sure)')
    expect(d.canUndo).toBe(true)
  })
  it('answer in the unsure queue', () => {
    const d = describeChange({ ...base, kind: 'answer', ref_table: 'model_answer', before: { shown_answer: 'tram' }, after: { answer: 'no', mode: 'unsure' } })
    expect(d.before).toBe('AI said: tram')
    expect(d.after).toBe('no (unsure)')
  })
  it('answer in the random sample (blind: nothing shown)', () => {
    const d = describeChange({ ...base, kind: 'answer', ref_table: 'model_answer', before: { shown_answer: null }, after: { answer: 'no', mode: 'sample' } })
    expect(d.before).toBe('blind sample')
    expect(d.after).toBe('no (sample)')
  })
  it('answer_withdrawn', () => {
    const d = describeChange({ ...base, kind: 'answer_withdrawn', ref_table: 'model_answer_withdrawal', after: { note: 'oops' } })
    expect(d.what).toBe('Model check answer withdrawn — Loco number')
    expect(d.after).toBe('oops')
    expect(d.canUndo).toBe(false)
  })
  it.each([
    ['held_submitted', 'Sent for approval'],
    ['held_approved', 'Approved'],
    ['held_rejected', 'Rejected'],
  ])('%s', (kind, text) => {
    const d = describeChange({ ...base, kind, ref_table: 'pending_fix_review', before: vals(['1'], 'extracted'), after: { ...vals(['2'], 'verified'), note: 'no' } })
    expect(d.what).toBe(`${text} — Loco number`)
    expect(d.canUndo).toBe(false)
  })
  it('undone rows cannot be undone again', () => {
    expect(describeChange({ ...base, undone: true }).canUndo).toBe(false)
  })
})

describe('bulkUndoRows', () => {
  const h = { ...base, cursor: 'h', ref_id: 1, undone: true }
  const u = { ...base, cursor: 'u', kind: 'fix_undo', ref_id: 2 }
  const x = { ...base, cursor: 'x', ref_id: 3 }
  const ids = (rows: ChangeRow[]) => rows.map((r) => r.ref_id)

  it('leaves undo rows out by default, so an undone change is not re-applied', () => {
    expect(ids(bulkUndoRows([h, u, x], undefined))).toEqual([3])
  })
  it('leaves undo rows out for any other kind filter', () => {
    expect(ids(bulkUndoRows([h, u, x], ['fix_review']))).toEqual([3])
  })
  it('takes undo rows only when the kind filter is exactly fix_undo', () => {
    expect(ids(bulkUndoRows([h, u], ['fix_undo']))).toEqual([2])
  })
  it('keeps single-row undo of an undo row available', () => {
    expect(describeChange(u).canUndo).toBe(true)
  })
})
