// Typed corrections that haven't been saved yet, keyed by fix + image_no. Kept in sessionStorage so
// a sign-in-again (remount) or a reload in the same tab never loses what the reviewer typed.
const STORAGE_KEY = 'picaloco-review-drafts'

let cache: Record<string, string> | null = null

function load(): Record<string, string> {
  if (cache) return cache
  try {
    const parsed: unknown = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? '{}')
    cache = parsed && typeof parsed === 'object' ? (parsed as Record<string, string>) : {}
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
  get(key: string): string | undefined {
    const v = load()[key]
    return typeof v === 'string' ? v : undefined
  },
  set(key: string, text: string) {
    load()[key] = text
    persist()
  },
  delete(key: string) {
    delete load()[key]
    persist()
  },
}
