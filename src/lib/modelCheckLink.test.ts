import { describe, expect, it } from 'vitest'
import { linkPreview } from './modelCheckLink'
import type { FixStateEntry, ModelTask } from '@/services/modelCheckService'

const task: ModelTask = {
  id: 'subject_type',
  question: 'What is the main subject?',
  answers: [
    { key: '1', id: 'steam_loco', label: 'Steam loco', loco: true },
    { key: '2', id: 'tram', label: 'Tram', loco: false },
  ],
  sure_threshold: 0.9,
  links: { no_answer_flag: 'loco', fix_ids: ['loco_number', 'loco_name'] },
  sort_order: 0,
}
const titles = { loco_number: 'Loco number', loco_name: 'Loco name' }
const e = (status: FixStateEntry['status'], confidence: FixStateEntry['confidence'], values: string[] = [], suggested: string[] = []): FixStateEntry => ({
  status, confidence, values, suggested_values: suggested,
})

describe('linkPreview', () => {
  it('fills both when untouched with no confidence', () => {
    const fs = { loco_number: e('extracted', 'none'), loco_name: e('extracted', 'none') }
    expect(linkPreview(task, 'tram', fs, titles)).toEqual({
      fills: ['loco_number', 'loco_name'],
      notes: ['Also saves: Loco number — No loco, Loco name — No loco'],
    })
  })
  it('notes a description-named value and fills nothing', () => {
    const fs = { loco_number: e('extracted', 'high', [], ['6853']), loco_name: e('extracted', 'none') }
    expect(linkPreview(task, 'tram', fs, titles)).toEqual({
      fills: [],
      notes: ['Description names 6853 — Loco number not changed'],
    })
  })
  it('notes a reviewed value', () => {
    const fs = { loco_number: e('verified', 'high', ['6853']), loco_name: e('extracted', 'none') }
    expect(linkPreview(task, 'tram', fs, titles)).toEqual({
      fills: [],
      notes: ['Loco number was saved as 6853 — not changed'],
    })
  })
  it('notes a loco answer against a no_loco field', () => {
    const fs = { loco_number: e('no_loco', 'none'), loco_name: e('extracted', 'none') }
    expect(linkPreview(task, 'steam_loco', fs, titles)).toEqual({
      fills: [],
      notes: ['Loco number was saved as No loco — not changed'],
    })
  })
  it('does nothing without links, or with a missing field', () => {
    expect(linkPreview({ ...task, links: null }, 'tram', null, titles)).toEqual({ fills: [], notes: [] })
    expect(linkPreview(task, 'tram', { loco_number: e('extracted', 'none') }, titles)).toEqual({ fills: [], notes: [] })
    expect(linkPreview(task, 'tram', null, titles)).toEqual({ fills: [], notes: [] })
  })
})
