import { useQuery } from '@tanstack/react-query'
import { searchCatalog } from '@/services/catalogService'
import type { CatalogFilters } from '@/types/catalog'

export const PAGE_SIZE = 24

export function useCatalogSearch(query: string, filters: CatalogFilters, page: number) {
  return useQuery({
    queryKey: ['catalog-search', query, filters, page],
    queryFn: () =>
      searchCatalog({
        imageNo: undefined,
        freeText: query,
        filters,
        page,
        pageSize: PAGE_SIZE,
      }),
    placeholderData: (previous) => previous,
  })
}
