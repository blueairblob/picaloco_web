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
export function pgQuoteFilterValue(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
}

// Escape LIKE/ILIKE's own wildcard characters so a typed value matches literally.
export function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`)
}

// Escape POSIX regex metacharacters so a typed value matches literally.
function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// Whole-token regex for a loco number ("42616" matches "number 42616 stands" but not "142616").
function locoNumberPattern(value: string): string {
  return `(^|[^[:alnum:]])${escapeRegex(value.trim())}([^[:alnum:]]|$)`
}

// `or=` body for the loco-number filter. Rows with a reviewed/extracted value
// (loco_numbers_text not null) match on it alone; rows with none yet fall back to the
// description, so unreviewed records stay findable.
export function locoNumberOrFilter(value: string): string {
  const q = pgQuoteFilterValue(locoNumberPattern(value))
  return `loco_numbers_text.imatch.${q},and(loco_numbers_text.is.null,description.imatch.${q})`
}

// Every whitespace-separated term must appear (any order) in the loco names.
export function locoNameTerms(value: string): string[] {
  return value.split(/\s+/).filter(Boolean)
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
  // Gauge is free-typed text with inconsistent casing in the source ("Standard" vs "standard"),
  // so match it case-insensitively but still exactly: ILIKE with LIKE's own wildcards escaped.
  if (filters?.gauge) builder = builder.ilike('gauge', escapeLikePattern(filters.gauge))
  // Exact date matches date_taken only -- photos with just a text "circa" date have no
  // date_taken and are deliberately not matched by a date search.
  if (filters?.loco) builder = builder.or(locoNumberOrFilter(filters.loco))
  if (filters?.locoName) {
    for (const term of locoNameTerms(filters.locoName)) {
      builder = builder.ilike('loco_names_text', `%${escapeLikePattern(term)}%`)
    }
  }
  if (filters?.date) builder = builder.eq('date_taken', filters.date)
  if (filters?.dateFrom) builder = builder.gte('date_taken', filters.dateFrom)
  if (filters?.dateTo) builder = builder.lte('date_taken', filters.dateTo)

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
