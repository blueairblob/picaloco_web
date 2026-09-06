import { supabase } from '@/lib/supabase/client'
import type { LookupOption } from '@/types/catalog'

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
