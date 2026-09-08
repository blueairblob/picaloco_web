import { useSyncStatus } from '@/hooks/useSyncStatus'
import { SyncStatusHeadline } from '@/components/admin/SyncStatusHeadline'
import { SyncStatusHistory } from '@/components/admin/SyncStatusHistory'

export function AdminPage() {
  const { data, isLoading, isError } = useSyncStatus()
  const rows = data ?? []
  const latestReal = rows.find((row) => !row.dry_run) ?? null

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 px-6 py-10">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-[var(--foreground)]">
          Migration status
        </h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Freshness of the FileMaker → Postgres sync that keeps this archive up to date.
        </p>
      </div>

      {isError && (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-10 text-center text-[var(--muted)]">
          Something went wrong talking to the archive. Please try again.
        </div>
      )}

      {isLoading && !isError && (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-10 text-center text-[var(--muted)]">
          Loading…
        </div>
      )}

      {!isLoading && !isError && (
        <>
          <SyncStatusHeadline row={latestReal} />

          <div>
            <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-[var(--muted)]">
              Recent runs
            </h2>
            <SyncStatusHistory rows={rows} />
          </div>
        </>
      )}
    </div>
  )
}
