import { useEffect, useRef, useState } from 'react'
import { FILTER_DEFINITIONS, type FilterId } from '@/lib/filterDefinitions'

interface AddFilterPickerProps {
  shown: FilterId[]
  onAdd: (id: FilterId) => void
  onRemove: (id: FilterId) => void
  onReset: () => void
}

// The "+" button: lists what's on the panel (ticked) and what can be added (unticked).
export function AddFilterPicker({ shown, onAdd, onRemove, onReset }: AddFilterPickerProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const onPanel = shown
    .map((id) => FILTER_DEFINITIONS.find((d) => d.id === id))
    .filter((d) => d !== undefined)
  const available = FILTER_DEFINITIONS.filter((d) => !shown.includes(d.id))

  const row = (id: FilterId, label: string, checked: boolean) => (
    <label
      key={id}
      className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm text-[var(--foreground)] hover:bg-[var(--accent)]/10"
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={() => (checked ? onRemove(id) : onAdd(id))}
        className="h-4 w-4 accent-[var(--accent)]"
      />
      {label}
    </label>
  )

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label="Add or remove filters"
        title="Add or remove filters"
        className={`flex h-[38px] w-[38px] items-center justify-center rounded-xl border text-xl leading-none transition ${
          open
            ? 'border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-foreground)]'
            : 'border-dashed border-[var(--accent)] text-[var(--accent)] hover:bg-[var(--accent)]/10'
        }`}
      >
        +
      </button>
      {open && (
        <div
          role="dialog"
          aria-label="Choose filters"
          className="absolute right-0 top-full z-30 mt-2 w-72 max-w-[calc(100vw-3rem)] rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3 shadow-xl"
        >
          <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">
            On your panel
          </p>
          {onPanel.length > 0 ? (
            onPanel.map((d) => row(d.id, d.label, true))
          ) : (
            <p className="px-2 py-1.5 text-sm text-[var(--muted)]">None</p>
          )}
          {available.length > 0 && (
            <>
              <p className="px-2 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">
                Add more
              </p>
              {available.map((d) => row(d.id, d.label, false))}
            </>
          )}
          <div className="mt-2 border-t border-[var(--border)] px-2 pt-2">
            <button
              type="button"
              onClick={onReset}
              className="text-xs font-medium text-[var(--accent)] hover:underline"
            >
              Reset to default filters
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
