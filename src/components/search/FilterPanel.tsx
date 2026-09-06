import type { CatalogFilters } from '@/types/catalog'
import { useLookupOptions } from '@/hooks/useLookupOptions'

interface FilterPanelProps {
  filters: CatalogFilters
  onChange: (filters: CatalogFilters) => void
}

function Select({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string | undefined
  options: string[]
  onChange: (value: string) => void
}) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="font-medium text-[var(--foreground)]">{label}</span>
      <select
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--accent)]"
      >
        <option value="">Any</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </label>
  )
}

export function FilterPanel({ filters, onChange }: FilterPanelProps) {
  const { categories, photographers, locations, organisations, countries, routes, collections } =
    useLookupOptions()

  const names = (opts: { name: string }[] | undefined) => (opts ?? []).map((o) => o.name)

  const set = (patch: Partial<CatalogFilters>) => onChange({ ...filters, ...patch })

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Select
          label="Category"
          value={filters.category}
          options={categories.data ?? []}
          onChange={(v) => set({ category: v || undefined })}
        />
        <Select
          label="Photographer"
          value={filters.photographer}
          options={names(photographers.data)}
          onChange={(v) => set({ photographer: v || undefined })}
        />
        <Select
          label="Location"
          value={filters.location}
          options={names(locations.data)}
          onChange={(v) => set({ location: v || undefined })}
        />
        <Select
          label="Organisation"
          value={filters.organisation}
          options={names(organisations.data)}
          onChange={(v) => set({ organisation: v || undefined })}
        />
        <Select
          label="Country"
          value={filters.country}
          options={names(countries.data)}
          onChange={(v) => set({ country: v || undefined })}
        />
        <Select
          label="Route"
          value={filters.route}
          options={names(routes.data)}
          onChange={(v) => set({ route: v || undefined })}
        />
        <Select
          label="Collection"
          value={filters.collection}
          options={names(collections.data)}
          onChange={(v) => set({ collection: v || undefined })}
        />
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-[var(--foreground)]">Date from</span>
          <input
            type="date"
            value={filters.dateFrom ?? ''}
            onChange={(e) => set({ dateFrom: e.target.value || undefined })}
            className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--accent)]"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-[var(--foreground)]">Date to</span>
          <input
            type="date"
            value={filters.dateTo ?? ''}
            onChange={(e) => set({ dateTo: e.target.value || undefined })}
            className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--accent)]"
          />
        </label>
      </div>
    </div>
  )
}
