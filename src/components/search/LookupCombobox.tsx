import { useId, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { searchLookup, type SearchableLookupTable } from '@/services/lookupService'
import { ClearLink, FieldShell, INPUT_CLASS } from './filterFields'

const MIN_CHARS = 2

interface LookupComboboxProps {
  label: string
  table: SearchableLookupTable
  value: string | undefined
  onChange: (value: string | undefined) => void
}

// Type-ahead picker backed by a server-side search, for lookup tables too large to preload.
// Only a picked suggestion becomes the filter value, so the filter always holds a real name
// that exists in the table (the search view filters on exact equality).
export function LookupCombobox({ label, table, value, onChange }: LookupComboboxProps) {
  const inputId = useId()
  const listId = useId()
  const [text, setText] = useState(value ?? '')
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(0)
  const debounced = useDebouncedValue(text.trim(), 250)

  // Reflect outside changes (chip cleared, back button, shared link) -- adjusted during render
  // rather than in an effect, per React's "storing information from previous renders" pattern.
  const [prevValue, setPrevValue] = useState(value)
  if (value !== prevValue) {
    setPrevValue(value)
    setText(value ?? '')
  }

  const searching = open && debounced.length >= MIN_CHARS
  const { data: matches = [], isFetching } = useQuery({
    queryKey: ['lookup-search', table, debounced],
    queryFn: () => searchLookup(table, debounced),
    enabled: searching,
    staleTime: 5 * 60 * 1000,
  })

  const pick = (name: string) => {
    setText(name)
    setOpen(false)
    onChange(name)
  }

  const revert = () => {
    setText(value ?? '')
    setOpen(false)
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setOpen(true)
      setHighlight((h) => Math.min(h + 1, Math.max(matches.length - 1, 0)))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlight((h) => Math.max(h - 1, 0))
    } else if (e.key === 'Enter') {
      if (open && matches[highlight]) {
        e.preventDefault()
        pick(matches[highlight])
      }
    } else if (e.key === 'Escape') {
      revert()
    }
  }

  let status: string | null = null
  if (open && debounced.length < MIN_CHARS) status = `Type ${MIN_CHARS} or more letters…`
  else if (searching && isFetching && matches.length === 0) status = 'Searching…'
  else if (searching && !isFetching && matches.length === 0) status = 'No matches'

  const showList = open && (status !== null || matches.length > 0)

  return (
    <FieldShell
      label={label}
      htmlFor={inputId}
      action={value ? <ClearLink label={label} onClick={() => onChange(undefined)} /> : undefined}
    >
      <div className="relative">
        <input
          id={inputId}
          type="text"
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={showList && matches[highlight] ? `${listId}-${highlight}` : undefined}
          autoComplete="off"
          value={text}
          placeholder="Type to search…"
          onChange={(e) => {
            setText(e.target.value)
            setOpen(true)
            setHighlight(0)
            if (!e.target.value.trim() && value) onChange(undefined)
          }}
          onFocus={() => setOpen(true)}
          onBlur={revert}
          onKeyDown={onKeyDown}
          className={INPUT_CLASS}
        />
        {showList && (
          <ul
            id={listId}
            role="listbox"
            className="absolute left-0 right-0 top-full z-20 mt-1 max-h-64 overflow-auto rounded-xl border border-[var(--border)] bg-[var(--surface)] py-1 text-sm shadow-lg"
          >
            {status && matches.length === 0 ? (
              <li className="px-3 py-2 text-[var(--muted)]">{status}</li>
            ) : (
              matches.map((name, i) => (
                <li
                  key={name}
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={i === highlight}
                  // mousedown + preventDefault so the input's blur (which reverts) doesn't win.
                  onMouseDown={(e) => {
                    e.preventDefault()
                    pick(name)
                  }}
                  onMouseEnter={() => setHighlight(i)}
                  className={`cursor-pointer px-3 py-2 text-[var(--foreground)] ${
                    i === highlight ? 'bg-[var(--accent)]/10' : ''
                  }`}
                >
                  {name}
                </li>
              ))
            )}
          </ul>
        )}
      </div>
    </FieldShell>
  )
}
