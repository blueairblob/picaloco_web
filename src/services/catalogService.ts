import { supabase } from '@/lib/supabase/client'
import type { CatalogPhoto, SearchParams, SearchResult } from '@/types/catalog'

const VIEW = 'mobile_catalog_view'

// A pure code-like query ("arc00002", "bpuk2237") gets an image_no prefix search; anything with
// spaces/punctuation is treated as free text across the descriptive fields instead.
const IMAGE_NO_LIKE = /^[a-z]+\d+$/i

// PostgREST's `or=(...)` filter syntax treats `,` and `()` as structural (condition separators /
// grouping), so a literal one of those in a search term corrupts the filter string being built
// below unless the value is double-quoted -- and *within* a quoted value, `"` and `\` in turn need
// escaping. Confirmed live (2026-09-10): searching "Class 1400 (11)" (a real image_no containing a
// space AND parentheses) silently returned zero rows, because the unescaped `(`/`)` broke the OR
// filter's own grouping syntax before it ever reached a real ILIKE comparison.
function pgQuoteFilterValue(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
}

export async function searchCatalog({
  imageNo,
  freeText,
  filters,
  page,
  pageSize,
}: SearchParams): Promise<SearchResult> {
  const query = (imageNo ?? freeText ?? '').trim()
  const hasQuery = query.length > 0
  const looksLikeImageNo = hasQuery && IMAGE_NO_LIKE.test(query)
  const hasFilters = Boolean(
    filters &&
      Object.values(filters).some((v) => v !== undefined && v !== null && v !== ''),
  )

  let builder = supabase.from(VIEW).select('*', {
    count: hasQuery || hasFilters ? 'exact' : 'estimated',
  })

  if (hasQuery) {
    if (looksLikeImageNo) {
      builder = builder.ilike('image_no', `${query}%`)
    } else {
      // Strip just the ILIKE wildcard char (a literal "%" from the user would
      // otherwise act as their own wildcard); everything else -- including
      // ",", "(", ")", '"' -- gets safely quoted below instead of stripped,
      // so the actual search text (and its matching) stays exactly what the
      // user typed.
      const term = pgQuoteFilterValue(`%${query.replace(/%/g, '')}%`)
      builder = builder.or(
        `description.ilike.${term},category.ilike.${term},photographer.ilike.${term},location.ilike.${term},image_no.ilike.${term}`,
      )
    }
  }

  if (filters?.category) builder = builder.eq('category', filters.category)
  if (filters?.photographer) builder = builder.eq('photographer', filters.photographer)
  if (filters?.location) builder = builder.eq('location', filters.location)
  if (filters?.organisation) builder = builder.eq('organisation', filters.organisation)
  if (filters?.country) builder = builder.eq('country', filters.country)
  if (filters?.route) builder = builder.eq('route', filters.route)
  if (filters?.collection) builder = builder.eq('collection', filters.collection)
  if (filters?.gauge) builder = builder.eq('gauge', filters.gauge)
  if (filters?.dateFrom) builder = builder.gte('date_taken', filters.dateFrom)
  if (filters?.dateTo) builder = builder.lte('date_taken', filters.dateTo)
  if (filters?.builderCode) {
    builder = builder.contains('builders', [{ builder_code: filters.builderCode }])
  }
  if (filters?.worksNumber) {
    builder = builder.contains('builders', [{ works_number: filters.worksNumber }])
  }

  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  const { data, count, error } = await builder
    .order('image_no', { ascending: true })
    .range(from, to)

  if (error) throw error

  return {
    photos: (data ?? []) as CatalogPhoto[],
    count: count ?? null,
    countIsExact: hasQuery || hasFilters,
  }
}

export async function getByImageNo(imageNo: string): Promise<CatalogPhoto | null> {
  const { data, error } = await supabase
    .from(VIEW)
    .select('*')
    .eq('image_no', imageNo)
    .maybeSingle()

  if (error) throw error
  return (data as CatalogPhoto | null) ?? null
}

export async function getCategories(): Promise<string[]> {
  const { data, error } = await supabase
    .from(VIEW)
    .select('category')
    .not('category', 'is', null)
    .limit(5000)

  if (error) throw error
  const unique = new Set((data ?? []).map((r) => r.category as string))
  return Array.from(unique).sort()
}
