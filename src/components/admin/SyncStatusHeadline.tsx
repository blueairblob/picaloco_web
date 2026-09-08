import type { SyncStatusRow } from '@/types/sync'
import { formatAbsoluteTime, formatRelativeTime } from '@/lib/relativeTime'
import { getHeadlineStatus } from '@/lib/syncStatusTone'
import { StatusBadge } from './StatusBadge'

function describeDelta(row: SyncStatusRow): string {
  const newCount = row.new_count ?? 0
  const changedCount = row.changed_count ?? 0

  if (newCount === 0 && changedCount === 0) {
    return 'No changes found — source and target match.'
  }

  const parts: string[] = []
  if (newCount > 0) parts.push(`${newCount} new`)
  if (changedCount > 0) parts.push(`${changedCount} changed`)

  const realChanges = row.real_changes ?? 0
  const suffix =
    realChanges > 0
      ? ` (${realChanges} confirmed real ${realChanges === 1 ? 'change' : 'changes'}, the rest were FileMaker touching the record without changing content)`
      : ''

  return `${parts.join(', ')} found${suffix}.`
}

export function SyncStatusHeadline({ row }: { row: SyncStatusRow | null }) {
  const status = getHeadlineStatus(row)

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-medium uppercase tracking-wide text-[var(--muted)]">
          Last sync check
        </h2>
        <StatusBadge label={status.label} tone={status.tone} />
      </div>

      {row ? (
        <>
          <p
            className="mt-3 text-3xl font-semibold tracking-tight text-[var(--foreground)]"
            title={formatAbsoluteTime(row.run_at)}
          >
            {formatRelativeTime(row.run_at)}
          </p>
          <p className="mt-2 text-sm text-[var(--muted)]">{describeDelta(row)}</p>
        </>
      ) : (
        <p className="mt-3 text-base text-[var(--muted)]">
          No completed sync check has been recorded yet.
        </p>
      )}
    </div>
  )
}
