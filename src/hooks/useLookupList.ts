import { useQuery } from '@tanstack/react-query'
import { getCollections, getCountries, getPhotographers } from '@/services/lookupService'
import { getCategories } from '@/services/catalogService'
import type { LookupOption } from '@/types/catalog'

const STALE_TIME = 24 * 60 * 60 * 1000 // lookup tables change rarely

const names = (opts: LookupOption[]) => opts.map((o) => o.name)

// Small lookups that fit a plain dropdown. Large ones (location/route/organisation) use the
// server-side type-ahead in LookupCombobox instead.
const LOADERS = {
  category: getCategories,
  photographer: async () => names(await getPhotographers()),
  country: async () => names(await getCountries()),
  collection: async () => names(await getCollections()),
} satisfies Record<string, () => Promise<string[]>>

export type ListLookup = keyof typeof LOADERS

// Loads one list, only when a filter that needs it is actually on the panel.
export function useLookupList(key: ListLookup) {
  return useQuery({ queryKey: ['lookup', key], queryFn: LOADERS[key], staleTime: STALE_TIME })
}
