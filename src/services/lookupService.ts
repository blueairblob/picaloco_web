import { supabase } from '@/lib/supabase/client'
import type { LookupOption } from '@/types/catalog'
import { escapeLikePattern } from '@/services/catalogService'

type LookupTable = 'photographer' | 'location' | 'organisation' | 'collection' | 'country' | 'route' | 'builder'

async function getLookupData(table: LookupTable): Promise<LookupOption[]> {
  const nameColumn = table === 'builder' ? 'name' : 'name'
  const { data, error } = await supabase
    .from(table)
    .select(`id, ${nameColumn}`)
    .not(nameColumn, 'is', null)
    .order(nameColumn as 'name', { ascending: true })
    .limit(2000)

  if (error) throw error
  return (data ?? []).map((row) => ({
    id: (row as { id: string }).id,
    name: (row as Record<string, string>)[nameColumn],
  }))
}

export const getPhotographers = () => getLookupData('photographer')
export const getLocations = () => getLookupData('location')
export const getOrganisations = () => getLookupData('organisation')
export const getCollections = () => getLookupData('collection')
export const getCountries = () => getLookupData('country')
export const getRoutes = () => getLookupData('route')
export const getBuilders = () => getLookupData('builder')

export type SearchableLookupTable = 'location' | 'route' | 'organisation'

// Server-side type-ahead search. Needed because these tables outgrow a preloaded dropdown:
// `location` has ~14k rows and `route` ~2.9k, both past getLookupData()'s 2,000-row cap, so most
// of their values could never be picked from a plain <select>.
export async function searchLookup(
  table: SearchableLookupTable,
  term: string,
  limit = 20,
): Promise<string[]> {
  const trimmed = term.trim()
  if (!trimmed) return []
  const { data, error } = await supabase
    .from(table)
    .select('name')
    .ilike('name', `%${escapeLikePattern(trimmed)}%`)
    .order('name', { ascending: true })
    .limit(limit)

  if (error) throw error
  return (data ?? []).map((row) => (row as { name: string }).name)
}
