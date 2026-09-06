interface PaginationProps {
  page: number
  pageSize: number
  count: number | null
  countIsExact: boolean
  onPageChange: (page: number) => void
}

export function Pagination({ page, pageSize, count, countIsExact, onPageChange }: PaginationProps) {
  const totalPages = count ? Math.max(1, Math.ceil(count / pageSize)) : undefined
  const canGoPrev = page > 1
  const canGoNext = totalPages ? page < totalPages : true

  return (
    <div className="flex items-center justify-between gap-4 text-sm text-[var(--muted)]">
      <span>
        {count !== null
          ? `${countIsExact ? '' : '~'}${count.toLocaleString()} result${count === 1 ? '' : 's'}`
          : ''}
      </span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={!canGoPrev}
          onClick={() => onPageChange(page - 1)}
          className="rounded-xl border border-[var(--border)] px-3 py-1.5 font-medium text-[var(--foreground)] transition disabled:cursor-not-allowed disabled:opacity-40 enabled:hover:border-[var(--accent)]"
        >
          Previous
        </button>
        <span>
          Page {page}
          {totalPages ? ` of ${totalPages}` : ''}
        </span>
        <button
          type="button"
          disabled={!canGoNext}
          onClick={() => onPageChange(page + 1)}
          className="rounded-xl border border-[var(--border)] px-3 py-1.5 font-medium text-[var(--foreground)] transition disabled:cursor-not-allowed disabled:opacity-40 enabled:hover:border-[var(--accent)]"
        >
          Next
        </button>
      </div>
    </div>
  )
}
