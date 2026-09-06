import { useQuery } from '@tanstack/react-query'
import {
  getCollections,
  getCountries,
  getLocations,
  getOrganisations,
  getPhotographers,
  getRoutes,
} from '@/services/lookupService'
import { getCategories } from '@/services/catalogService'

const STALE_TIME = 24 * 60 * 60 * 1000 // lookup tables change rarely

function useLookup<T>(key: string, fn: () => Promise<T>) {
  return useQuery({ queryKey: ['lookup', key], queryFn: fn, staleTime: STALE_TIME })
}

export function useLookupOptions() {
  const categories = useLookup('categories', getCategories)
  const photographers = useLookup('photographers', getPhotographers)
  const locations = useLookup('locations', getLocations)
  const organisations = useLookup('organisations', getOrganisations)
  const countries = useLookup('countries', getCountries)
  const routes = useLookup('routes', getRoutes)
  const collections = useLookup('collections', getCollections)

  return { categories, photographers, locations, organisations, countries, routes, collections }
}
