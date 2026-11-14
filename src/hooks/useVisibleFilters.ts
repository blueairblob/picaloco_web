import { useCallback, useState } from 'react'
import { DEFAULT_FILTERS, isFilterId, type FilterId } from '@/lib/filterDefinitions'

const STORAGE_KEY = 'picaloco.visibleFilters.v2'
const LEGACY_KEY = 'picaloco.visibleFilters.v1'

// v1 predates the Loco name filter; carry the visitor's panel over and add it.
export function migrateLegacy(rawV1: string | null): FilterId[] | null {
  if (!rawV1) return null
  try {
    const parsed: unknown = JSON.parse(rawV1)
    if (!Array.isArray(parsed)) return null
    const ids = Array.from(new Set(parsed.filter(isFilterId)))
    if (ids.length === 0) return null
    return ids.includes('locoName') ? ids : [...ids, 'locoName']
  } catch {
    return null
  }
}

function load(): FilterId[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      const migrated = migrateLegacy(localStorage.getItem(LEGACY_KEY))
      if (!migrated) return DEFAULT_FILTERS
      save(migrated)
      return migrated
    }
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return DEFAULT_FILTERS
    const ids = parsed.filter(isFilterId)
    return ids.length > 0 ? Array.from(new Set(ids)) : DEFAULT_FILTERS
  } catch {
    return DEFAULT_FILTERS
  }
}

function save(ids: FilterId[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids))
  } catch {
    // Storage blocked (private window, disabled site data) -- the panel still works, it just
    // won't remember the visitor's choice next time.
  }
}

// Which filters this visitor has on their panel, in the order they added them. Remembered per
// browser; falls back to the client's default set.
export function useVisibleFilters() {
  const [visible, setVisible] = useState<FilterId[]>(load)

  const update = useCallback((next: FilterId[]) => {
    setVisible(next)
    save(next)
  }, [])

  const add = useCallback(
    (id: FilterId) => update(visible.includes(id) ? visible : [...visible, id]),
    [visible, update],
  )
  const remove = useCallback((id: FilterId) => update(visible.filter((v) => v !== id)), [visible, update])
  const reset = useCallback(() => update(DEFAULT_FILTERS), [update])

  return { visible, add, remove, reset }
}
