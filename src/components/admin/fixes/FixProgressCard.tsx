import { Link } from 'react-router-dom'
import { CONFIDENCE_ORDER, type DataFix, type FixProgress } from '@/services/dataFixService'

const CONFIDENCE_LABEL = { none: 'None', low: 'Low', med: 'Medium', high: 'High' } as const

export function FixProgressCard({ fix, progress }: { fix: DataFix; progress: FixProgress }) {
  const pct = progress.total > 0 ? Math.round((progress.reviewed / progress.total) * 100) : 0
  const base = `/admin/fixes/${encodeURIComponent(fix.id)}`
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
      <h2 className="text-lg font-semibold text-[var(--foreground)]">{fix.title}</h2>
      {fix.summary && <p className="mt-1 text-sm text-[var(--muted)]">{fix.summary}</p>}

      <p className="mt-4 text-sm text-[var(--foreground)]">
        {progress.reviewed.toLocaleString()} of {progress.total.toLocaleString()} reviewed
      </p>
      <div
        className="mt-2 h-2 w-full overflow-hidden rounded-full bg-[var(--border)]"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
      >
        <div className="h-full bg-[var(--accent)]" style={{ width: `${pct}%` }} />
      </div>

      <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm">
        {CONFIDENCE_ORDER.map((c) => (
          <li key={c}>
            <Link to={`${base}?confidence=${c}`} className="text-[var(--accent)]">
              {CONFIDENCE_LABEL[c]} confidence ({progress.byConfidence[c].open.toLocaleString()} open)
            </Link>
          </li>
        ))}
        {progress.needsRecheck > 0 && (
          <li>
            <Link to={`${base}?status=&recheck=1`} className="text-[var(--accent)]">
              Needs recheck ({progress.needsRecheck.toLocaleString()})
            </Link>
          </li>
        )}
      </ul>
    </div>
  )
}
