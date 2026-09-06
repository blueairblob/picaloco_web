interface FilterChipProps {
  label: string
  onClear: () => void
}

export function FilterChip({ label, onClear }: FilterChipProps) {
  return (
    <button
      type="button"
      onClick={onClear}
      className="inline-flex items-center gap-1.5 rounded-full border border-[var(--accent)]/30 bg-[var(--accent)]/10 px-3 py-1 text-xs font-medium text-[var(--accent)] transition hover:bg-[var(--accent)]/20"
    >
      {label}
      <span aria-hidden="true">×</span>
    </button>
  )
}
