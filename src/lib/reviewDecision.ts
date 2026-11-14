import type { FixStatus } from '@/services/dataFixService'

export type ReviewStatus = Exclude<FixStatus, 'extracted'>
export type SaveAction = 'confirm' | 'useSuggestion' | 'edit'

export interface DecisionRecord {
  status: FixStatus
  values: string[]
  suggested_values: string[]
}

export interface SaveDecision {
  values: string[]
  status: ReviewStatus
}

// Trims, drops blanks and duplicates, keeps order.
function normaliseList(values: readonly string[]): string[] {
  const out: string[] = []
  for (const raw of values) {
    const v = raw.trim()
    if (v && !out.includes(v)) out.push(v)
  }
  return out
}

export function sameValues(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i])
}

export function isReviewed(r: Pick<DecisionRecord, 'status'>): boolean {
  return r.status !== 'extracted'
}

// What the edit box starts from. An open record: its values, else the suggestion. A reviewed record:
// its current review only, so the box never shows a suggestion that Keep current wouldn't save.
export function editBaseline(r: DecisionRecord): string[] {
  if (isReviewed(r)) return r.values
  return r.values.length > 0 ? r.values : r.suggested_values
}

// "Use suggestion" is offered only when it would actually change a reviewed record.
export function canUseSuggestion(r: DecisionRecord): boolean {
  const suggested = normaliseList(r.suggested_values)
  return isReviewed(r) && suggested.length > 0 && !sameValues(suggested, normaliseList(r.values))
}

// Verified means the saved values are exactly the extractor's suggestion; anything else is a correction.
function statusFor(values: string[], suggested: readonly string[]): ReviewStatus {
  return sameValues(values, normaliseList(suggested)) ? 'verified' : 'corrected'
}

// What a review action saves. A reviewed record's confirm is "Keep current": the stored values and
// status, unchanged (saving it clears needs_recheck, which is the reviewer's explicit decision).
export function decideSave(record: DecisionRecord, action: SaveAction, edited: readonly string[] = []): SaveDecision {
  switch (action) {
    case 'useSuggestion':
      return { values: normaliseList(record.suggested_values), status: 'verified' }
    case 'edit': {
      const values = normaliseList(edited)
      return { values, status: statusFor(values, record.suggested_values) }
    }
    case 'confirm': {
      if (record.status !== 'extracted') return { values: [...record.values], status: record.status }
      const values = normaliseList(record.values.length > 0 ? record.values : record.suggested_values)
      return { values, status: statusFor(values, record.suggested_values) }
    }
  }
}
