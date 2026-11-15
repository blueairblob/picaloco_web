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
