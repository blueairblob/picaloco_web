import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { SearchBar } from '@/components/search/SearchBar'
import { FilterPanel } from '@/components/search/FilterPanel'
import { FilterChip } from '@/components/search/FilterChip'
import { PhotoGrid } from '@/components/results/PhotoGrid'
import { Pagination } from '@/components/results/Pagination'
import { useCatalogSearch, PAGE_SIZE } from '@/hooks/useCatalogSearch'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import type { CatalogFilters } from '@/types/catalog'

const FILTER_LABELS: Record<keyof CatalogFilters, string> = {
  category: 'Category',
  photographer: 'Photographer',
  location: 'Location',
  organisation: 'Organisation',
  country: 'Country',
  route: 'Route',
  collection: 'Collection',
  gauge: 'Gauge',
  dateFrom: 'From',
  dateTo: 'To',
  builderCode: 'Builder',
  worksNumber: 'Works no.',
}

export function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [showFilters, setShowFilters] = useState(false)

  const query = searchParams.get('q') ?? ''
  const page = Number(searchParams.get('page') ?? '1')
  const filters: CatalogFilters = Object.fromEntries(
    Object.keys(FILTER_LABELS)
      .map((key) => [key, searchParams.get(key) ?? undefined])
      .filter(([, v]) => v !== undefined),
  )

  const debouncedQuery = useDebouncedValue(query, 300)

  const updateParams = (patch: Record<string, string | undefined>) => {
    const next = new URLSearchParams(searchParams)
    for (const [key, value] of Object.entries(patch)) {
      if (value) next.set(key, value)
      else next.delete(key)
    }
    setSearchParams(next, { replace: true })
  }

  const setQuery = (value: string) => updateParams({ q: value || undefined, page: undefined })
  const setFilters = (next: CatalogFilters) =>
    updateParams({ ...next, page: undefined } as Record<string, string | undefined>)
  const setPage = (next: number) => updateParams({ page: next > 1 ? String(next) : undefined })
  const clearFilter = (key: keyof CatalogFilters) => updateParams({ [key]: undefined, page: undefined })

  const { data, isLoading, isError, isPlaceholderData } = useCatalogSearch(
    debouncedQuery,
    filters,
    page || 1,
  )

  const activeFilterEntries = Object.entries(filters).filter(([, v]) => v) as [
    keyof CatalogFilters,
    string,
  ][]

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-6 py-10">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-[var(--foreground)]">
          Search the archive
        </h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Search by image number (e.g. arc00002) or keyword, or use filters to browse.
        </p>
      </div>

      <SearchBar
        value={query}
        onChange={setQuery}
        onToggleFilters={() => setShowFilters((v) => !v)}
        filtersActive={showFilters}
      />

      {activeFilterEntries.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {activeFilterEntries.map(([key, value]) => (
            <FilterChip key={key} label={`${FILTER_LABELS[key]}: ${value}`} onClear={() => clearFilter(key)} />
          ))}
        </div>
      )}

      {showFilters && <FilterPanel filters={filters} onChange={setFilters} />}

      <div className="flex flex-col gap-5" style={{ opacity: isPlaceholderData ? 0.6 : 1 }}>
        <PhotoGrid photos={data?.photos ?? []} isLoading={isLoading && !data} isError={isError} />
        {data && data.photos.length > 0 && (
          <Pagination
            page={page || 1}
            pageSize={PAGE_SIZE}
            count={data.count}
            countIsExact={data.countIsExact}
            onPageChange={setPage}
          />
        )}
      </div>
    </div>
  )
}
