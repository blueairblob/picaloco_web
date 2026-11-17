import { describe, expect, it } from 'vitest'
import { progressFor, queuePositionText, sampleButtonText, sampleComplete, SAMPLE_TARGET } from './modelCheckProgress'
import type { RunProgress } from '@/services/modelCheckService'

const row = (task_id: string, run_id: number, n_blind: number): RunProgress => ({
  task_id,
  run_id,
  model: 'm',
  version: `v${run_id}`,
  created_at: '2026-11-16T00:00:00Z',
  n_predictions: 10,
  n_checked: n_blind,
  n_agree: 0,
  n_blind,
  n_blind_correct: 0,
})

describe('SAMPLE_TARGET', () => {
  it('is 200', () => expect(SAMPLE_TARGET).toBe(200))
})

describe('progressFor', () => {
  // Rows come newest run first within each task.
  const rows = [row('other', 9, 5), row('t', 3, 57), row('t', 2, 40)]
  it('picks the named run', () => expect(progressFor(rows, 't', 2)?.run_id).toBe(2))
  it('falls back to the newest run of the task', () => expect(progressFor(rows, 't', null)?.run_id).toBe(3))
  it('falls back when the named run is not there', () => expect(progressFor(rows, 't', 99)?.run_id).toBe(3))
  it('is null when the task has no run', () => expect(progressFor(rows, 'none', null)).toBeNull())
})

describe('queuePositionText', () => {
  it('counts the shared blind total against the target in random sample', () => {
    expect(queuePositionText('sample', 57, 3)).toBe('57 of 200 checked')
  })
  it('keeps counting past the target', () => {
    expect(queuePositionText('sample', 212, 0)).toBe('212 of 200 checked')
  })
  it('shows only this sitting’s count for sure and unsure', () => {
    expect(queuePositionText('sure', 57, 4)).toBe('4 done')
    expect(queuePositionText('unsure', 57, 0)).toBe('0 done')
  })
})

describe('sampleComplete', () => {
  it('is reached at the target, not before', () => {
    expect(sampleComplete(199)).toBe(false)
    expect(sampleComplete(200)).toBe(true)
    expect(sampleComplete(250)).toBe(true)
  })
})

describe('sampleButtonText', () => {
  it('shows progress towards the target', () => {
    expect(sampleButtonText(0)).toBe('Random sample · 0 / 200')
    expect(sampleButtonText(57)).toBe('Random sample · 57 / 200')
  })
  it('shows a tick once the target is reached', () => {
    expect(sampleButtonText(212)).toBe('Random sample · 212 ✓')
  })
})
