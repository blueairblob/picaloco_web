import type { CatalogFilters } from '@/types/catalog'
import { useVisibleFilters } from '@/hooks/useVisibleFilters'
import {
  DEFAULT_FILTERS,
  FILTER_DEFINITIONS,
  clearedFilterPatch,
  filterHasValue,
  type FilterId,
} from '@/lib/filterDefinitions'
import { AddFilterPicker } from './AddFilterPicker'
import { DateFilter } from './DateFilter'
import { LookupCombobox } from './LookupCombobox'
import { SelectFilter, TextFilter } from './filterFields'

interface FilterPanelProps {
  filters: CatalogFilters
  onChange: (filters: CatalogFilters) => void
}

export function FilterPanel({ filters, onChange }: FilterPanelProps) {
  const { visible, add, remove, reset } = useVisibleFilters()

  // A filter that already has a value (shared link, back button) shows even if this visitor
  // never added it, so an active filter is never hidden.
  const shown: FilterId[] = [
    ...visible,
    ...FILTER_DEFINITIONS.map((d) => d.id).filter(
      (id) => !visible.includes(id) && filterHasValue(id, filters),
    ),
  ]

  const set = (patch: Partial<CatalogFilters>) => onChange({ ...filters, ...patch })

  const removeFilter = (id: FilterId) => {
    remove(id)
    if (filterHasValue(id, filters)) set(clearedFilterPatch(id))
  }

  const resetFilters = () => {
    // Clear values of anything leaving the panel, so no hidden filter keeps narrowing results.
    const leaving = shown.filter((id) => !DEFAULT_FILTERS.includes(id))
    const patch = Object.assign({}, ...leaving.map(clearedFilterPatch)) as Partial<CatalogFilters>
    reset()
    if (leaving.some((id) => filterHasValue(id, filters))) set(patch)
  }

  const renderFilter = (id: FilterId) => {
    switch (id) {
      case 'country':
        return (
          <SelectFilter id="f-country" label="Country" lookup="country" value={filters.country}
            onChange={(v) => set({ country: v })} />
        )
      case 'location':
        return (
          <LookupCombobox label="Location" table="location" value={filters.location}
            onChange={(v) => set({ location: v })} />
        )
      case 'date':
        return (
          <DateFilter
            values={{ date: filters.date, dateFrom: filters.dateFrom, dateTo: filters.dateTo }}
            onChange={set}
          />
        )
      case 'loco':
        return (
          <TextFilter id="f-loco" label="Loco number" placeholder="e.g. 42616"
            hint="Searches photo descriptions" value={filters.loco}
            onChange={(v) => set({ loco: v })} />
        )
      case 'category':
        return (
          <SelectFilter id="f-category" label="Category" lookup="category" value={filters.category}
            onChange={(v) => set({ category: v })} />
        )
      case 'photographer':
        return (
          <SelectFilter id="f-photographer" label="Photographer" lookup="photographer"
            value={filters.photographer} onChange={(v) => set({ photographer: v })} />
        )
      case 'organisation':
        return (
          <LookupCombobox label="Organisation" table="organisation" value={filters.organisation}
            onChange={(v) => set({ organisation: v })} />
        )
      case 'route':
        return (
          <LookupCombobox label="Route" table="route" value={filters.route}
            onChange={(v) => set({ route: v })} />
        )
      case 'collection':
        return (
          <SelectFilter id="f-collection" label="Collection" lookup="collection"
            value={filters.collection} onChange={(v) => set({ collection: v })} />
        )
      case 'gauge':
        return (
          <TextFilter id="f-gauge" label="Gauge" placeholder="e.g. Standard" value={filters.gauge}
            onChange={(v) => set({ gauge: v })} />
        )
    }
  }

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <div className="flex items-end gap-4">
        <div className="grid flex-1 grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {shown.map((id) => (
            // The date cell widens itself whenever DateFilter is showing from/to (data-date-range),
            // including range mode with no dates entered yet.
            <div key={id} className="min-w-0 sm:has-[[data-date-range]]:col-span-2">
              {renderFilter(id)}
            </div>
          ))}
          {shown.length === 0 && (
            <p className="text-sm text-[var(--muted)]">No filters on your panel. Use + to add some.</p>
          )}
        </div>
        <AddFilterPicker shown={shown} onAdd={add} onRemove={removeFilter} onReset={resetFilters} />
      </div>
    </div>
  )
}
