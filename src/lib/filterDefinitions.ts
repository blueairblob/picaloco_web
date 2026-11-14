import type { CatalogFilters } from '@/types/catalog'

// One entry per filter a user can put on the panel. A filter can own more than one URL key
// (Date owns `date` for an exact day plus `dateFrom`/`dateTo` for a range).
export type FilterId =
  | 'country'
  | 'location'
  | 'date'
  | 'loco'
  | 'category'
  | 'photographer'
  | 'organisation'
  | 'route'
  | 'collection'
  | 'gauge'

export interface FilterDefinition {
  id: FilterId
  label: string
  keys: (keyof CatalogFilters)[]
}

export const FILTER_DEFINITIONS: FilterDefinition[] = [
  { id: 'country', label: 'Country', keys: ['country'] },
  { id: 'location', label: 'Location', keys: ['location'] },
  { id: 'date', label: 'Date', keys: ['date', 'dateFrom', 'dateTo'] },
  { id: 'loco', label: 'Loco number', keys: ['loco'] },
  { id: 'category', label: 'Category', keys: ['category'] },
  { id: 'photographer', label: 'Photographer', keys: ['photographer'] },
  { id: 'organisation', label: 'Organisation', keys: ['organisation'] },
  { id: 'route', label: 'Route', keys: ['route'] },
  { id: 'collection', label: 'Collection', keys: ['collection'] },
  { id: 'gauge', label: 'Gauge', keys: ['gauge'] },
]

// The client's requested starting set.
export const DEFAULT_FILTERS: FilterId[] = ['country', 'location', 'date', 'loco']

const BY_ID = new Map(FILTER_DEFINITIONS.map((d) => [d.id, d]))

export function getFilterDefinition(id: FilterId): FilterDefinition {
  const def = BY_ID.get(id)
  if (!def) throw new Error(`Unknown filter: ${id}`)
  return def
}

export function isFilterId(value: unknown): value is FilterId {
  return typeof value === 'string' && BY_ID.has(value as FilterId)
}

export function filterHasValue(id: FilterId, filters: CatalogFilters): boolean {
  return getFilterDefinition(id).keys.some((key) => Boolean(filters[key]))
}

// Patch that clears every URL key a filter owns.
export function clearedFilterPatch(id: FilterId): Partial<CatalogFilters> {
  return Object.fromEntries(getFilterDefinition(id).keys.map((key) => [key, undefined]))
}
