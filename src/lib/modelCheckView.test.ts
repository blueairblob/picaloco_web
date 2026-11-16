import { describe, expect, it } from 'vitest'
import { canSavePhoto, checkedByText, defaultPick, fixStateAfterSave, guardAfterSave, guardOnShow, modelThinksText } from './modelCheckView'
import type { FixStateEntry, ModelTask } from '@/services/modelCheckService'

const task: ModelTask = {
  id: 'subject_type',
  question: "What's the main subject?",
  answers: [
    { key: '1', id: 'steam_loco', label: 'Steam loco', loco: true },
    { key: '5', id: 'tram', label: 'Tram', loco: true },
    { key: '0', id: 'other', label: 'Other', loco: false },
  ],
  sure_threshold: 0.9,
  links: { no_answer_flag: 'loco', fix_ids: ['loco_number', 'loco_name'] },
  sort_order: 1,
}

describe('modelThinksText', () => {
  it('shows the label and rounded percent', () => {
    expect(modelThinksText(task, 'sure', 'tram', 0.926)).toBe('Model thinks: Tram (93%)')
    expect(modelThinksText(task, 'unsure', 'other', 0.414)).toBe('Model thinks: Other (41%)')
  })
  it('is absent in sample mode even when a prediction is present', () => {
    expect(modelThinksText(task, 'sample', 'tram', 0.93)).toBeNull()
  })
  it('is absent with no prediction', () => {
    expect(modelThinksText(task, 'sure', null, null)).toBeNull()
  })
})

describe('defaultPick', () => {
  it('pre-selects the model answer in sure and unsure mode', () => {
    expect(defaultPick(task, 'sure', { checked_answer: null, model_answer: 'tram' })).toBe('tram')
    expect(defaultPick(task, 'unsure', { checked_answer: null, model_answer: 'other' })).toBe('other')
  })
  it('selects nothing in sample mode', () => {
    expect(defaultPick(task, 'sample', { checked_answer: null, model_answer: 'tram' })).toBeNull()
  })
  it('prefers the saved answer in every mode', () => {
    expect(defaultPick(task, 'sure', { checked_answer: 'other', model_answer: 'tram' })).toBe('other')
    expect(defaultPick(task, 'sample', { checked_answer: 'steam_loco', model_answer: null })).toBe('steam_loco')
  })
  it('ignores an answer id the task does not list', () => {
    expect(defaultPick(task, 'sure', { checked_answer: null, model_answer: 'gone' })).toBeNull()
  })
})

describe('checkedByText', () => {
  it('names the email and the date', () => {
    expect(checkedByText('a@b.org', '2026-11-16T12:00:00Z')).toBe('Checked by a@b.org on 16 Nov 2026')
  })
  it('falls back to a volunteer', () => {
    expect(checkedByText(null, '2026-11-16T12:00:00Z')).toBe('Checked by a volunteer on 16 Nov 2026')
  })
})

describe('fixStateAfterSave', () => {
  const e = (status: FixStateEntry['status']): FixStateEntry => ({ status, confidence: 'none', values: [], suggested_values: [] })
  it('marks filled fields as No loco and leaves the rest', () => {
    const before = { loco_number: e('extracted'), loco_name: e('extracted'), other: e('verified') }
    const after = fixStateAfterSave(before, ['loco_number', 'loco_name'])
    expect(after?.loco_number.status).toBe('no_loco')
    expect(after?.loco_name.status).toBe('no_loco')
    expect(after?.other.status).toBe('verified')
    expect(before.loco_number.status).toBe('extracted')
  })
  it('returns the same state when nothing was filled', () => {
    const before = { loco_number: e('extracted') }
    expect(fixStateAfterSave(before, [])).toBe(before)
    expect(fixStateAfterSave(null, ['loco_number'])).toBeNull()
  })
})

describe('save guard', () => {
  it('refuses a save for the photo just saved, before the view advanced', () => {
    const g = guardAfterSave('arc00001')
    expect(canSavePhoto(g, 'arc00001')).toBe(false)
    // The page has not re-rendered yet: it still shows the saved photo, so the guard holds.
    expect(canSavePhoto(guardOnShow(g, 'arc00001'), 'arc00001')).toBe(false)
  })
  it('clears once the next photo is shown, so Back can save a correction', () => {
    const next = guardOnShow(guardAfterSave('arc00001'), 'arc00002')
    expect(canSavePhoto(next, 'arc00002')).toBe(true)
    const back = guardOnShow(next, 'arc00001')
    expect(canSavePhoto(back, 'arc00001')).toBe(true)
  })
  it('clears when the queue runs out after the last photo', () => {
    expect(guardOnShow(guardAfterSave('arc00003'), '')).toBeNull()
  })
  it('allows any save when nothing was just saved', () => {
    expect(canSavePhoto(null, 'arc00001')).toBe(true)
  })
})
