import { AdminSteps } from '@/components/admin/AdminSteps'
import { useQuery } from '@tanstack/react-query'
import { FixProgressCard } from '@/components/admin/fixes/FixProgressCard'
import { getFixes, getOrphans, getProgress, summariseProgress } from '@/services/dataFixService'

const box = 'rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-10 text-center text-[var(--muted)]'

export function DataFixesPage() {
  const fixes = useQuery({ queryKey: ['data-fixes'], queryFn: getFixes })
  const progress = useQuery({ queryKey: ['data-fix-progress'], queryFn: getProgress })
  const orphans = useQuery({ queryKey: ['data-fix-orphans'], queryFn: getOrphans })

  const isError = fixes.isError || progress.isError
  const isLoading = fixes.isLoading || progress.isLoading
  const orphanRows = orphans.data ?? []

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 px-6 py-10">
      <div>
        <AdminSteps />
        <h1 className="text-3xl font-semibold tracking-tight text-[var(--foreground)]">Data fixes</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Review loco numbers and names extracted from photo descriptions.
        </p>
      </div>

      {isError && (
        <div className={box}>Something went wrong talking to the archive. Please try again.</div>
      )}
      {isLoading && !isError && <div className={box}>Loading…</div>}

      {!isLoading && !isError && (
        <>
          <div className="flex flex-col gap-4">
            {(fixes.data ?? []).map((fix) => (
              <FixProgressCard
                key={fix.id}
                fix={fix}
                progress={summariseProgress(progress.data ?? [], fix.id)}
              />
            ))}
          </div>

          {orphanRows.length > 0 && (
            <div>
              <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-[var(--muted)]">
                Photos no longer in the catalog
              </h2>
              <ul className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 text-sm text-[var(--foreground)]">
                {orphanRows.map((o) => (
                  <li key={`${o.fix_id}:${o.image_no}`}>
                    {o.image_no} <span className="text-[var(--muted)]">({o.fix_id}, {o.status})</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  )
}
