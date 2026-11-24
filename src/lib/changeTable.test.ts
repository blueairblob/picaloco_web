import { describe, expect, it } from 'vitest'
import { cellText, headings, statusText, tableMode } from './changeTable'
import type { ChangeRow } from './changeRow'

const base: ChangeRow = {
  cursor: 'c', kind: 'fix_review', at: '2026-11-20T10:00:00Z', by_user: 'u1', approved_by: null,
  image_no: 'arc1', subject: 'Loco number', before: null, after: null,
  ref_table: 'data_fix_history', ref_id: 1, undone: false,
}
const email = (id: string | null) => (id ? `${id}@x` : '—')

describe('headings', () => {
  it('per question kind', () => {
    expect(headings({ kind: 'fix', id: 'a', label: 'A' })).toEqual({ then: 'Then', now: 'Now', showQuestion: false })
    expect(headings({ kind: 'task', id: 't', label: 'T' })).toEqual({ then: 'AI said', now: 'Answer', showQuestion: false })
    expect(headings({ kind: 'all' })).toEqual({ then: 'Then', now: 'Now', showQuestion: true })
  })
})

describe('cellText', () => {
  it('fix review', () => {
    const r = { ...base, before: { values: ['4073'], status: 'extracted' }, after: { values: ['4073'], status: 'verified' } }
    expect(cellText(r)).toEqual({ then: 'Suggested 4073', now: 'Verified 4073' })
  })
  it('sample answer', () => {
    const r = { ...base, kind: 'answer', before: { shown_answer: null }, after: { answer: 'a1', mode: 'sample' } }
    expect(cellText(r, (id) => (id === 'a1' ? 'Steam' : undefined))).toEqual({ then: 'blind', now: 'Steam' })
  })
  it('shown answer and unknown id', () => {
    const r = { ...base, kind: 'answer', before: { shown_answer: 'a2' }, after: { answer: 'zz', mode: 'review' } }
    expect(cellText(r, (id) => (id === 'a2' ? 'Diesel' : undefined))).toEqual({ then: 'Diesel', now: 'zz' })
  })
  it('withdrawal', () => {
    expect(cellText({ ...base, kind: 'answer_withdrawn', after: { note: 'oops' } })).toEqual({ then: '', now: 'oops' })
    expect(cellText({ ...base, kind: 'answer_withdrawn', after: null })).toEqual({ then: '', now: '' })
  })
  it('held model answers, decided by source table', () => {
    const lab = (id: string) => (id === 'a2' ? 'Diesel' : id === 'a1' ? 'Steam' : undefined)
    const mk = (kind: string, b: ChangeRow['before'], a: ChangeRow['after']): ChangeRow =>
      ({ ...base, kind, ref_table: 'pending_model_answer', before: b, after: a })
    expect(cellText(mk('held_submitted', { shown_answer: 'a2' }, { answer: 'a1', mode: 'review' }), lab)).toEqual({ then: 'Diesel', now: 'Steam' })
    expect(cellText(mk('held_approved', { shown_answer: null }, { answer: 'a1', mode: 'sample' }), lab)).toEqual({ then: 'blind', now: 'Steam' })
    // no usable payload: the source table alone says this is an answer (RED on the shape-only check)
    expect(cellText(mk('held_submitted', null, null), lab)).toEqual({ then: 'blind', now: '' })
  })
  it('held fix', () => {
    const r = { ...base, kind: 'held_submitted', before: { values: ['1'], status: 'extracted' }, after: { values: ['2'], status: 'corrected' } }
    expect(cellText(r)).toEqual({ then: 'Suggested 1', now: 'Corrected 2' })
  })
})

describe('statusText', () => {
  it('statuses', () => {
    expect(statusText({ ...base, approved_by: 'b' }, email)).toBe('✓ b@x')
    expect(statusText({ ...base, kind: 'held_approved', by_user: 'm' }, email)).toBe('✓ m@x')
    expect(statusText({ ...base, kind: 'held_submitted' }, email)).toBe('held')
    expect(statusText({ ...base, kind: 'held_rejected', after: { note: 'bad' } }, email)).toBe('rejected: bad')
    expect(statusText({ ...base, kind: 'held_rejected' }, email)).toBe('rejected')
    expect(statusText({ ...base, kind: 'fix_undo' }, email)).toBe('undo')
    expect(statusText({ ...base, kind: 'answer_withdrawn' }, email)).toBe('withdrawn')
    expect(statusText(base, email)).toBe('')
  })
  it('undone wins', () => {
    expect(statusText({ ...base, kind: 'held_approved', undone: true }, email)).toBe('undone')
  })
})

describe('tableMode', () => {
  it('modes', () => {
    expect(tableMode(true, false, 0)).toBe('loading')
    expect(tableMode(false, true, 0)).toBe('error')
    expect(tableMode(false, false, 0)).toBe('empty')
    expect(tableMode(false, false, 3)).toBe('rows')
  })
})
