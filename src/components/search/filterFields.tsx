import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { useLookupList, type ListLookup } from '@/hooks/useLookupList'

export const INPUT_CLASS =
  'w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--accent)]'

export const LINK_CLASS =
  'text-xs font-medium text-[var(--accent)] hover:underline focus-visible:underline outline-none'

// Label row + control. `action` sits on the right of the label (clear / + range / × exact).
export function FieldShell({
  label,
  htmlFor,
  action,
  children,
}: {
  label: string
  htmlFor?: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5 text-sm">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={htmlFor} className="font-medium text-[var(--foreground)]">
          {label}
        </label>
        {action}
      </div>
      {children}
    </div>
  )
}

export function ClearLink({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button type="button" onClick={onClick} className={LINK_CLASS} aria-label={`Clear ${label}`}>
      clear
    </button>
  )
}

export function SelectFilter({
  id,
  label,
  lookup,
  value,
  onChange,
}: {
  id: string
  label: string
  lookup: ListLookup
  value: string | undefined
  onChange: (value: string | undefined) => void
}) {
  const { data, isLoading } = useLookupList(lookup)
  return (
    <FieldShell label={label} htmlFor={id}>
      <select
        id={id}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value || undefined)}
        className={INPUT_CLASS}
      >
        <option value="">{isLoading ? 'Loading…' : 'Any'}</option>
        {/* Keep a URL-supplied value selectable even before (or without) the list loading. */}
        {value && !(data ?? []).includes(value) && <option value={value}>{value}</option>}
        {(data ?? []).map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </FieldShell>
  )
}

// Free-text filter. Commits after a pause in typing so each keystroke doesn't fire a search.
export function TextFilter({
  id,
  label,
  placeholder,
  hint,
  value,
  onChange,
}: {
  id: string
  label: string
  placeholder?: string
  hint?: string
  value: string | undefined
  onChange: (value: string | undefined) => void
}) {
  const [text, setText] = useState(value ?? '')
  const lastCommitted = useRef(value ?? '')
  const debounced = useDebouncedValue(text, 400)

  // Pick up changes made outside this box (chip cleared, back button, shared link), but not
  // the echo of our own commit -- that would overwrite whatever the user typed since.
  useEffect(() => {
    if ((value ?? '') !== lastCommitted.current) {
      lastCommitted.current = value ?? ''
      setText(value ?? '')
    }
  }, [value])

  useEffect(() => {
    const next = debounced.trim()
    if (next !== lastCommitted.current) {
      lastCommitted.current = next
      onChange(next || undefined)
    }
  }, [debounced, onChange])

  return (
    <FieldShell label={label} htmlFor={id}>
      <input
        id={id}
        type="text"
        value={text}
        placeholder={placeholder}
        onChange={(e) => setText(e.target.value)}
        aria-describedby={hint ? `${id}-hint` : undefined}
        className={INPUT_CLASS}
      />
      {hint && (
        <p id={`${id}-hint`} className="text-xs text-[var(--muted)]">
          {hint}
        </p>
      )}
    </FieldShell>
  )
}
