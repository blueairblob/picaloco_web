import { decideSave, editBaseline, sameValues, type SaveDecision } from '@/lib/reviewDecision'
import { normaliseValues, type CompanionValue } from '@/services/dataFixService'

export function isCompanionDirty(row: CompanionValue, draftText: string): boolean {
  return !sameValues(normaliseValues(draftText), editBaseline(row))
}

// What saving this companion's draft would write; null when there's nothing to save.
export function companionDecision(row: CompanionValue, draftText: string): SaveDecision | null {
  if (!isCompanionDirty(row, draftText)) return null
  const values = normaliseValues(draftText)
  if (values.length === 0) return { status: 'none_visible', values: [] }
  return decideSave(row, 'edit', values)
}

// Why a save must wait: a stored edit for another fix on this photo can't be saved until its row loads.
export function companionBlockMessage(
  state: 'loading' | 'error' | 'ready',
  titlesWithDrafts: string[],
): string | null {
  if (state === 'ready' || titlesWithDrafts.length === 0) return null
  const titles = titlesWithDrafts.join(', ')
  return state === 'loading'
    ? `Still loading ${titles} — try again in a moment.`
    : `Couldn't load ${titles}, which has an unsaved edit — use Retry first.`
}
