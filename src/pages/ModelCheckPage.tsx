import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ModelTaskCard } from '@/components/admin/modelCheck/ModelTaskCard'
import { getFixes } from '@/services/dataFixService'
import { getRunProgress, getTasks } from '@/services/modelCheckService'

const box = 'rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-10 text-center text-[var(--muted)]'

export function ModelCheckPage() {
  const tasks = useQuery({ queryKey: ['model-tasks'], queryFn: getTasks })
  const progress = useQuery({ queryKey: ['model-progress'], queryFn: getRunProgress })
  const fixes = useQuery({ queryKey: ['data-fixes'], queryFn: getFixes })

  const isError = tasks.isError || progress.isError
  const isLoading = tasks.isLoading || progress.isLoading

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 px-6 py-10">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-[var(--foreground)]">Model check</h1>
        <p className="mt-1 text-base text-[var(--muted)]">Check what the model predicted against what the photos show.</p>
        <Link to="/admin" className="mt-2 inline-block text-base text-[var(--accent)]">
          ← Migration status
        </Link>
      </div>

      {isError && <div className={box}>Something went wrong talking to the archive. Please try again.</div>}
      {isLoading && !isError && <div className={box}>Loading…</div>}
      {!isLoading && !isError && (tasks.data ?? []).length === 0 && <div className={box}>No questions are set up yet.</div>}

      {!isLoading && !isError && (
        <div className="flex flex-col gap-4">
          {(tasks.data ?? []).map((t) => (
            <ModelTaskCard key={t.id} task={t} progress={(progress.data ?? []).filter((p) => p.task_id === t.id)} fixes={fixes.data ?? []} />
          ))}
        </div>
      )}
    </div>
  )
}
