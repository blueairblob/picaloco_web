import { describe, expect, it } from 'vitest'
import { parseQuestionKey, questionKey, questionOptions, questionParams, showKinds, SHOW_OPTIONS } from './changeFilters'

describe('showKinds', () => {
  it('maps each mode', () => {
    expect(showKinds('all')).toBeUndefined()
    expect(showKinds('reviews')).toEqual(['fix_review', 'fix_model_check', 'answer'])
    expect(showKinds('held')).toEqual(['held_submitted', 'held_approved', 'held_rejected'])
    expect(showKinds('undos')).toEqual(['fix_undo', 'answer_withdrawn'])
  })
  it('has the spec labels', () => {
    expect(SHOW_OPTIONS.map((o) => o[1])).toEqual(['All', 'Reviews and answers', 'Held for approval', 'Undos'])
  })
})

describe('questions', () => {
  const opts = questionOptions([{ id: 'loco', title: 'Loco' }, { id: 'sub', title: 'Subject' }], [{ id: '7', question: 'Q?' }])
  it('orders fixes, tasks, then all', () => {
    expect(opts).toEqual([
      { kind: 'fix', id: 'loco', label: 'Loco' },
      { kind: 'fix', id: 'sub', label: 'Subject' },
      { kind: 'task', id: '7', label: 'Q?' },
      { kind: 'all' },
    ])
  })
  it('maps params', () => {
    expect(questionParams(opts[0])).toEqual({ fixId: 'loco' })
    expect(questionParams(opts[2])).toEqual({ taskId: '7' })
    expect(questionParams(opts[3])).toEqual({})
  })
  it('round-trips keys', () => {
    for (const o of opts) expect(parseQuestionKey(questionKey(o), opts)).toEqual(o)
    expect(parseQuestionKey('nope', opts)).toEqual({ kind: 'all' })
  })
})
