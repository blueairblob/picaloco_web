import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { formatAccuracy, serializeCheckParams, type CheckMode } from '@/lib/modelCheckParams'
import { getConfusion, getConflicts, getRuns, type ModelTask, type RunProgress } from '@/services/modelCheckService'
import { STATUS_LABEL } from '@/lib/fixStatusLabel'
import type { DataFix, FixStatus } from '@/services/dataFixService'

const btn =
  'inline-flex min-h-11 items-center rounded-full border border-[var(--border)] px-5 text-sm font-medium text-[var(--foreground)] no-underline hover:border-[var(--accent)] hover:text-[var(--accent)]'
const MODES: [CheckMode, string][] = [
  ['sure', 'Sure'],
  ['unsure', 'Unsure'],
  ['sample', 'Random sample'],
]

interface Props {
  task: ModelTask
  progress: RunProgress[]
  fixes: DataFix[]
}

export function ModelTaskCard({ task, progress, fixes }: Props) {
  const runs = useQuery({ queryKey: ['model-runs', task.id], queryFn: () => getRuns(task.id) })
  const [picked, setPicked] = useState<number | null>(null)
  const runId = picked ?? runs.data?.[0]?.id ?? null // newest run first
  const run = runs.data?.find((r) => r.id === runId) ?? null
  const stats = progress.find((p) => p.run_id === runId) ?? null

  const confusion = useQuery({
    queryKey: ['model-confusion', runId],
    queryFn: () => getConfusion(runId as number, true),
    enabled: runId !== null,
  })
  const conflicts = useQuery({ queryKey: ['model-conflicts', task.id], queryFn: () => getConflicts(task.id) })

  const label = (id: string) => task.answers.find((a) => a.id === id)?.label ?? id
  const cell = (m: string, c: string) =>
    (confusion.data ?? []).find((r) => r.model_answer === m && r.checked_answer === c)?.n ?? 0
  const fixTitle = (id: string) => fixes.find((f) => f.id === id)?.title ?? id
  const conflictRows = conflicts.data ?? []
  const queue = (mode: CheckMode) =>
    `/admin/model-check/${encodeURIComponent(task.id)}?${serializeCheckParams({ run: runId, mode, answer: null, collection: null }).toString()}`

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
      <h2 className="text-lg font-semibold text-[var(--foreground)]">{task.question}</h2>

      {runs.isError && <p className="mt-3 text-sm text-[var(--muted)]">Could not load the runs.</p>}
      {runs.isSuccess && runs.data.length === 0 && (
        <p className="mt-3 text-sm text-[var(--muted)]">No model run has been loaded for this question yet.</p>
      )}

      {run && (
        <>
          <label className="mt-4 block text-sm text-[var(--muted)]">
            Run{' '}
            <select
              value={run.id}
              onChange={(e) => setPicked(Number(e.target.value))}
              className="ml-1 min-h-11 rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 text-base text-[var(--foreground)]"
            >
              {(runs.data ?? []).map((r) => (
                <option key={r.id} value={r.id}>
                  {r.model} {r.version} ({new Date(r.created_at).toLocaleDateString()})
                </option>
              ))}
            </select>
          </label>

          <dl className="mt-4 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-[var(--muted)]">Predicted</dt>
              <dd className="text-[var(--foreground)]">{(stats?.n_predictions ?? run.n_predictions).toLocaleString()}</dd>
            </div>
            <div>
              <dt className="text-[var(--muted)]">Checked</dt>
              <dd className="text-[var(--foreground)]">{(stats?.n_checked ?? 0).toLocaleString()}</dd>
            </div>
            <div>
              <dt className="text-[var(--muted)]">Accuracy (blind sample)</dt>
              <dd className="text-[var(--foreground)]">
                {formatAccuracy(stats?.n_blind_correct ?? 0, stats?.n_blind ?? 0)}
              </dd>
            </div>
            <div>
              <dt className="text-[var(--muted)]">Agreement</dt>
              <dd className="text-[var(--foreground)]">
                {(stats?.n_agree ?? 0).toLocaleString()} of {(stats?.n_checked ?? 0).toLocaleString()}
              </dd>
            </div>
          </dl>

          {confusion.isError && <p className="mt-4 text-sm text-[var(--muted)]">Could not load the confusion table.</p>}
          <div className="mt-4 overflow-x-auto">
            <table className="text-sm" aria-label="Blind sample: model answer against checked answer">
              <thead>
                <tr>
                  <th className="px-3 py-1 text-left font-medium text-[var(--muted)]">Model \ Checked</th>
                  {task.answers.map((a) => (
                    <th key={a.id} className="px-3 py-1 text-right font-medium text-[var(--muted)]">
                      {a.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {task.answers.map((m) => (
                  <tr key={m.id}>
                    <th className="px-3 py-1 text-left font-medium text-[var(--foreground)]">{m.label}</th>
                    {task.answers.map((c) => (
                      <td key={c.id} className="px-3 py-1 text-right tabular-nums text-[var(--foreground)]">
                        {cell(m.id, c.id)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <div className="mt-5 flex flex-wrap gap-3">
        {MODES.map(([mode, text]) => (
          <Link key={mode} to={queue(mode)} className={btn}>
            {text}
          </Link>
        ))}
      </div>

      <h3 className="mt-6 text-sm font-medium text-[var(--foreground)]">Conflicts ({conflictRows.length})</h3>
      {conflicts.isError && <p className="mt-2 text-sm text-[var(--muted)]">Could not load the conflicts.</p>}
      {conflictRows.length > 0 && (
        <ul className="mt-2 flex flex-col gap-1 text-sm">
          {conflictRows.map((c) => (
            <li key={`${c.image_no}:${c.fix_id}`}>
              <Link
                to={`/admin/fixes/${encodeURIComponent(c.fix_id)}?q=${encodeURIComponent(c.image_no)}&status=extracted,verified,corrected,none_visible,no_loco`}
                className="text-[var(--accent)]"
              >
                {c.image_no}
              </Link>{' '}
              <span className="text-[var(--muted)]">
                {label(c.answer)} · {fixTitle(c.fix_id)}: {STATUS_LABEL[c.status as FixStatus] ?? c.status}
                {c.values.length > 0 && ` (${c.values.join('; ')})`}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
