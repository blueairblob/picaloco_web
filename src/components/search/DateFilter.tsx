import { useId, useState } from 'react'
import type { CatalogFilters } from '@/types/catalog'
import { FieldShell, INPUT_CLASS, LINK_CLASS } from './filterFields'

type DateValues = Pick<CatalogFilters, 'date' | 'dateFrom' | 'dateTo'>

interface DateFilterProps {
  values: DateValues
  onChange: (patch: DateValues) => void
}

// One date box by default (exact day); "+ range" turns it into from/to, "× exact" turns it back.
// A value carries across the switch (exact day becomes "from", "from" becomes the exact day).
export function DateFilter({ values, onChange }: DateFilterProps) {
  const id = useId()
  const [chosenMode, setChosenMode] = useState<'exact' | 'range'>(() =>
    values.dateFrom || values.dateTo ? 'range' : 'exact',
  )
  // The URL wins when it holds a value (shared link, back button); otherwise the user's choice.
  const mode = values.date ? 'exact' : values.dateFrom || values.dateTo ? 'range' : chosenMode

  const toRange = () => {
    setChosenMode('range')
    onChange({ date: undefined, dateFrom: values.date, dateTo: undefined })
  }
  const toExact = () => {
    setChosenMode('exact')
    onChange({ date: values.dateFrom ?? values.dateTo, dateFrom: undefined, dateTo: undefined })
  }

  if (mode === 'exact') {
    return (
      <FieldShell
        label="Date"
        htmlFor={id}
        action={
          <button type="button" onClick={toRange} className={LINK_CLASS}>
            + range
          </button>
        }
      >
        <input
          id={id}
          type="date"
          value={values.date ?? ''}
          onChange={(e) => onChange({ date: e.target.value || undefined })}
          className={INPUT_CLASS}
        />
      </FieldShell>
    )
  }

  return (
    <FieldShell
      label="Date"
      htmlFor={id}
      action={
        <button type="button" onClick={toExact} className={LINK_CLASS}>
          × exact
        </button>
      }
    >
      <div data-date-range className="flex items-center gap-2">
        <input
          id={id}
          type="date"
          aria-label="Date from"
          value={values.dateFrom ?? ''}
          max={values.dateTo}
          onChange={(e) => onChange({ dateFrom: e.target.value || undefined })}
          className={`${INPUT_CLASS} min-w-0`}
        />
        <span className="text-[var(--muted)]" aria-hidden="true">
          –
        </span>
        <input
          type="date"
          aria-label="Date to"
          value={values.dateTo ?? ''}
          min={values.dateFrom}
          onChange={(e) => onChange({ dateTo: e.target.value || undefined })}
          className={`${INPUT_CLASS} min-w-0`}
        />
      </div>
    </FieldShell>
  )
}
