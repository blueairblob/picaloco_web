interface SearchBarProps {
  value: string
  onChange: (value: string) => void
  onToggleFilters: () => void
  filtersActive: boolean
}

export function SearchBar({ value, onChange, onToggleFilters, filtersActive }: SearchBarProps) {
  return (
    <div className="flex gap-3">
      <div className="relative flex-1">
        <input
          type="search"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Search by image number or keyword…"
          className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-5 py-3.5 text-base text-[var(--foreground)] shadow-sm outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
        />
      </div>
      <button
        type="button"
        onClick={onToggleFilters}
        className={`shrink-0 rounded-2xl border px-5 py-3.5 text-sm font-medium transition ${
          filtersActive
            ? 'border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-foreground)]'
            : 'border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] hover:border-[var(--accent)]'
        }`}
      >
        Filters
      </button>
    </div>
  )
}
