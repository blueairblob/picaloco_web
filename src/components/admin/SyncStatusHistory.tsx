import type { SyncStatusRow } from '@/types/sync'
import { formatAbsoluteTime, formatRelativeTime } from '@/lib/relativeTime'

function formatCounts(row: SyncStatusRow): string {
  if (row.dry_run) {
    const delta = row.delta_count
    return delta === null || delta === undefined ? '—' : `${delta} would change`
  }

  const newCount = row.new_count ?? 0
  const changedCount = row.changed_count ?? 0
  if (newCount === 0 && changedCount === 0) return 'No changes'
  return `${newCount} new, ${changedCount} changed`
}

export function SyncStatusHistory({ rows }: { rows: SyncStatusRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-10 text-center text-[var(--muted)]">
        No sync history yet.
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] text-xs uppercase tracking-wide text-[var(--muted)]">
              <th className="px-5 py-3 font-medium">When</th>
              <th className="px-5 py-3 font-medium">Type</th>
              <th className="px-5 py-3 font-medium">Result</th>
              <th className="px-5 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-[var(--border)] last:border-0">
                <td
                  className="px-5 py-3 text-[var(--foreground)]"
                  title={formatAbsoluteTime(row.run_at)}
                >
                  {formatRelativeTime(row.run_at)}
                </td>
                <td className="px-5 py-3 text-[var(--muted)]">
                  {row.dry_run ? 'Check only' : 'Sync'}
                </td>
                <td className="px-5 py-3 text-[var(--muted)]">{formatCounts(row)}</td>
                <td className="px-5 py-3">
                  {row.ok ? (
                    <span className="text-[var(--success)]">OK</span>
                  ) : (
                    <span className="text-[var(--danger)]">Failed</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
