import { useState, type FormEvent } from 'react'
import { FIX_STATUSES, type QueueParams } from '@/lib/queueParams'
import { CONFIDENCE_ORDER } from '@/services/dataFixService'

const CONFIDENCE_LABEL = { none: 'None', low: 'Low', med: 'Medium', high: 'High' } as const
const STATUS_LABEL = {
  extracted: 'Not reviewed',
  verified: 'Verified',
  corrected: 'Corrected',
  none_visible: 'Not visible',
  no_loco: 'No loco',
} as const

const input =
  'w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-1.5 text-sm text-[var(--foreground)] focus:border-[var(--accent)] focus:outline-none'

function toggle<T>(list: T[], v: T): T[] {
  return list.includes(v) ? list.filter((x) => x !== v) : [...list, v]
}

function describe(p: QueueParams): string {
  const parts = [
    p.confidence.length ? p.confidence.map((c) => CONFIDENCE_LABEL[c]).join('/') + ' confidence' : 'any confidence',
    p.status.length ? p.status.map((s) => STATUS_LABEL[s]).join('/') : 'no status',
  ]
  if (p.includeRecheck) parts.push('+ needs recheck')
  if (p.collection) parts.push(`collection “${p.collection}”`)
  if (p.text) parts.push(`description has “${p.text}”`)
  return parts.join(' · ')
}

// Checkboxes apply at once; the two text fields apply on Enter or Apply.
// The parent should key this on collection/text so external URL changes reset the fields.
export function QueueFilters({ params, onChange }: { params: QueueParams; onChange: (p: QueueParams) => void }) {
  const [collection, setCollection] = useState(params.collection ?? '')
  const [text, setText] = useState(params.text ?? '')

  const submit = (e: FormEvent) => {
    e.preventDefault()
    onChange({ ...params, collection: collection.trim() || null, text: text.trim() || null })
    // Hand the keyboard back to the review shortcuts.
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
  }

  return (
    <details className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm">
      <summary onMouseDown={(e) => e.preventDefault()} className="cursor-pointer text-[var(--foreground)]">
        Filters <span className="text-[var(--muted)]">— {describe(params)}</span>
      </summary>
      <form onSubmit={submit} className="mt-4 flex flex-col gap-4">
        <fieldset className="flex flex-wrap gap-x-4 gap-y-2">
          <legend className="mb-1 text-xs uppercase tracking-wide text-[var(--muted)]">Confidence</legend>
          {CONFIDENCE_ORDER.map((c) => (
            <label key={c} className="flex items-center gap-1.5 text-[var(--foreground)]">
              <input
                type="checkbox"
                checked={params.confidence.includes(c)}
                onChange={() => onChange({ ...params, confidence: toggle(params.confidence, c) })}
                className="accent-[var(--accent)]"
              />
              {CONFIDENCE_LABEL[c]}
            </label>
          ))}
        </fieldset>
        <fieldset className="flex flex-wrap gap-x-4 gap-y-2">
          <legend className="mb-1 text-xs uppercase tracking-wide text-[var(--muted)]">Status</legend>
          {FIX_STATUSES.map((s) => (
            <label key={s} className="flex items-center gap-1.5 text-[var(--foreground)]">
              <input
                type="checkbox"
                checked={params.status.includes(s)}
                onChange={() => onChange({ ...params, status: toggle(params.status, s) })}
                className="accent-[var(--accent)]"
              />
              {STATUS_LABEL[s]}
            </label>
          ))}
          <label className="flex items-center gap-1.5 text-[var(--foreground)]">
            <input
              type="checkbox"
              checked={params.includeRecheck}
              onChange={() => onChange({ ...params, includeRecheck: !params.includeRecheck })}
              className="accent-[var(--accent)]"
            />
            Include needs recheck
          </label>
        </fieldset>
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <label className="flex flex-col gap-1 text-[var(--muted)]">
            Collection (exact name)
            <input value={collection} onChange={(e) => setCollection(e.target.value)} className={input} />
          </label>
          <label className="flex flex-col gap-1 text-[var(--muted)]">
            Description contains
            <input value={text} onChange={(e) => setText(e.target.value)} className={input} />
          </label>
          <button
            type="submit"
            className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-[var(--foreground)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
          >
            Apply
          </button>
        </div>
      </form>
    </details>
  )
}
