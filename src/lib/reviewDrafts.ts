// Typed corrections that haven't been saved yet, keyed by fix + image_no. Kept in sessionStorage so
// a sign-in-again (remount) or a reload in the same tab never loses what the reviewer typed.
// Each draft remembers the record's updated_at when it was typed, so a draft restored over a record
// that has since changed can be flagged instead of silently saved over the newer values.
const STORAGE_KEY = 'picaloco-review-drafts'

export interface ReviewDraft {
  text: string
  // The record's updated_at string when the draft was started; null when unknown (older drafts).
  baseUpdatedAt: string | null
}

export function parseDraft(raw: unknown): ReviewDraft | undefined {
  if (typeof raw === 'string') return { text: raw, baseUpdatedAt: null }
  if (raw && typeof raw === 'object') {
    const { text, baseUpdatedAt } = raw as { text?: unknown; baseUpdatedAt?: unknown }
    if (typeof text === 'string') {
      return { text, baseUpdatedAt: typeof baseUpdatedAt === 'string' ? baseUpdatedAt : null }
    }
  }
  return undefined
}

export function isDraftOutdated(draft: ReviewDraft, updatedAt: string): boolean {
  return draft.baseUpdatedAt !== updatedAt
}

let cache: Record<string, unknown> | null = null

function load(): Record<string, unknown> {
  if (cache) return cache
  try {
    const parsed: unknown = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? '{}')
    cache = parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {}
  } catch {
    cache = {}
  }
  return cache
}

function persist() {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(cache ?? {}))
  } catch {
    // Storage blocked or full: the draft still lives in memory for this page.
  }
}

export function draftKey(fixId: string, imageNo: string): string {
  return `${fixId}\u0000${imageNo}`
}

export const reviewDrafts = {
  get(key: string): ReviewDraft | undefined {
    return parseDraft(load()[key])
  },
  set(key: string, draft: ReviewDraft) {
    load()[key] = draft
    persist()
  },
  delete(key: string) {
    delete load()[key]
    persist()
  },
}
