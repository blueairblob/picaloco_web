import type { CheckMode } from '@/lib/modelCheckParams'
import type { FixStateEntry, ModelTask } from '@/services/modelCheckService'

export function answerLabel(task: ModelTask, answerId: string): string {
  return task.answers.find((a) => a.id === answerId)?.label ?? answerId
}

// "Model thinks: Tram (93%)". Never in sample mode: the blind sample must not show the model's guess.
export function modelThinksText(
  task: ModelTask,
  mode: CheckMode,
  modelAnswer: string | null,
  modelP: number | null,
): string | null {
  if (mode === 'sample' || !modelAnswer) return null
  const pct = modelP === null ? '' : ` (${Math.round(modelP * 100)}%)`
  return `Model thinks: ${answerLabel(task, modelAnswer)}${pct}`
}

// The answer selected when a photo is shown: the answer saved on this visit if there is one, else the
// model's answer — except in sample mode, where nothing is selected until the volunteer picks.
export function defaultPick(
  task: ModelTask,
  mode: CheckMode,
  rec: { checked_answer: string | null; model_answer: string | null },
): string | null {
  const known = (id: string | null) => (id && task.answers.some((a) => a.id === id) ? id : null)
  const saved = known(rec.checked_answer)
  if (saved) return saved
  return mode === 'sample' ? null : known(rec.model_answer)
}

export function formatCheckedDate(at: string): string {
  const d = new Date(at)
  if (Number.isNaN(d.getTime())) return at
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function checkedByText(email: string | null, at: string): string {
  return `Checked by ${email || 'a volunteer'} on ${formatCheckedDate(at)}`
}

// The photo's Data Fixes state after a save that filled these fields with No loco.
export function fixStateAfterSave(
  state: Record<string, FixStateEntry> | null,
  filled: string[],
): Record<string, FixStateEntry> | null {
  if (!state || filled.length === 0) return state
  const next = { ...state }
  for (const id of filled) {
    const s = next[id]
    if (s) next[id] = { ...s, status: 'no_loco', values: [] }
  }
  return next
}

// Answers are append-only, so a second save of the same photo is a duplicate row. After a save the
// page advances on its next render; a key pressed before that render still sees the saved photo.
// The guard holds the photo just saved until another photo is shown (Back then allows a correction).
export type SaveGuard = string | null

export function guardAfterSave(imageNo: string): SaveGuard {
  return imageNo
}

export function guardOnShow(guard: SaveGuard, shownImageNo: string): SaveGuard {
  return guard === shownImageNo ? guard : null
}

export function canSavePhoto(guard: SaveGuard, imageNo: string): boolean {
  return guard !== imageNo
}

// A save this soon after a photo appears is a double press or double click, not a look at the new
// photo. It applies to every save path (Enter and the Save & next button).
export const NEW_PHOTO_SAVE_GUARD_MS = 300

export function newPhotoGuardActive(now: number, shownAt: number): boolean {
  return now - shownAt < NEW_PHOTO_SAVE_GUARD_MS
}
