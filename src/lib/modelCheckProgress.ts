import type { CheckMode } from '@/lib/modelCheckParams'
import type { RunProgress } from '@/services/modelCheckService'

// Blind answers needed for an accuracy figure good to about ±5% (95% confidence). Shared by everyone
// checking: answers from every session and every person count towards it.
export const SAMPLE_TARGET = 200

// The progress row for a run, or the task's newest run when none is named (rows are newest first).
export function progressFor(rows: RunProgress[], taskId: string, runId: number | null): RunProgress | null {
  const forTask = rows.filter((r) => r.task_id === taskId)
  return forTask.find((r) => r.run_id === runId) ?? forTask[0] ?? null
}

// Random sample counts the shared blind total against the target; sure and unsure have no end
// worth showing, so they count only this sitting's answers.
export function queuePositionText(mode: CheckMode, blindDone: number, sessionDone: number): string {
  return mode === 'sample' ? `${blindDone} of ${SAMPLE_TARGET} checked` : `${sessionDone} done`
}

export function sampleComplete(blindDone: number): boolean {
  return blindDone >= SAMPLE_TARGET
}

export function sampleButtonText(blindDone: number): string {
  return sampleComplete(blindDone)
    ? `Random sample · ${blindDone} ✓`
    : `Random sample · ${blindDone} / ${SAMPLE_TARGET}`
}
