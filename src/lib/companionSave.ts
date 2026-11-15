import { editBaseline, sameValues } from '@/lib/reviewDecision'
import { normaliseValues, type CompanionValue } from '@/services/dataFixService'

export function isCompanionDirty(row: CompanionValue, draftText: string): boolean {
  return !sameValues(normaliseValues(draftText), editBaseline(row))
}

// Why a save must wait: a change for another field on this photo (a stored edit, or a selected
// No loco / Not visible) can't be saved until that field's row loads.
export function companionBlockMessage(
  state: 'loading' | 'error' | 'ready',
  titlesAffected: string[],
): string | null {
  if (state === 'ready' || titlesAffected.length === 0) return null
  const titles = titlesAffected.join(', ')
  return state === 'loading'
    ? `Still loading ${titles} — try again in a moment.`
    : `Couldn't load ${titles}, which this save would change — use Retry first.`
}

// Dirty companions the reviewer didn't touch on this card visit: their edit was carried in from an
// earlier visit, so a plain save must pause and show it first.
export function carriedCompanions(dirtyFixIds: string[], touched: ReadonlySet<string>): string[] {
  return dirtyFixIds.filter((id) => !touched.has(id))
}
