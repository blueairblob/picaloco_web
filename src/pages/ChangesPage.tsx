import { useMemo, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AdminSteps } from '@/components/admin/AdminSteps'
import { listPeople } from '@/services/volunteerService'
import { listChanges, undoRows, PartialUndoError } from '@/services/changeService'
import { bulkUndoRows, describeChange, excludedUndoCount, KIND_LABEL, type ChangeRow } from '@/lib/changeRow'
import { batchSummaryText } from '@/lib/chunk'
import { dateRangeError, dayStart } from '@/lib/dateRange'
import { personLabel } from '@/lib/personLabel'

const box = 'rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6'
const btn =
  'rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm text-[var(--foreground)] hover:border-[var(--accent)] disabled:opacity-50'
const field = 'rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-[var(--foreground)]'

export function ChangesPage() {
  const qc = useQueryClient()
  const people = useQuery({ queryKey: ['people'], queryFn: listPeople })
  const [userId, setUserId] = useState('')
  const [fromDay, setFromDay] = useState('')
  const [toDay, setToDay] = useState('')
  const [kind, setKind] = useState('')
  const [loadingMore, setLoadingMore] = useState(false)
  const [loadError, setError] = useState<string | null>(null)
  const [summary, setSummary] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  // Bumped whenever the list is reset (filter change, undo) so a late loadMore can't land in it.
  const gen = useRef(0)
  const [busy, setBusy] = useState(false)

  const filters = useMemo(
    () => ({
      userId: userId || undefined,
      from: dayStart(fromDay),
      to: dayStart(toDay, 1),
      kinds: kind ? [kind] : undefined,
    }),
    [userId, fromDay, toDay, kind],
  )

  const filterKey = JSON.stringify(filters)
  const rangeError = dateRangeError(fromDay, toDay)
  const first = useQuery({ queryKey: ['changes', filterKey], queryFn: () => listChanges(filters), enabled: !rangeError })
  const [extra, setExtra] = useState<{ key: string; rows: ChangeRow[]; last: number } | null>(null)
  const extraRows = extra && extra.key === filterKey ? extra.rows : []
  const rows = [...(first.data ?? []), ...extraRows]
  const lastPage = extra && extra.key === filterKey ? extra.last : (first.data?.length ?? 0)
  const more = lastPage >= 100
  const loading = first.isFetching || loadingMore
  const error = rangeError ?? loadError ?? (first.isError ? 'Could not load the changes. Try again.' : null)

  const emailOf = (id: string | null) =>
    id ? personLabel(people.data, id, 'Unknown user', people.isError) : '—'
  const filteredEmail = userId ? personLabel(people.data, userId, userId, people.isError) : 'everyone'
  const undoable = bulkUndoRows(rows, filters.kinds)
  const excludedUndos = excludedUndoCount(rows, filters.kinds)

  function resetList() {
    gen.current++
    setLoadingMore(false)
    setExtra(null)
  }
  // Every filter change starts a fresh list: drop stale errors, results and an open confirmation.
  function changeFilter(set: (v: string) => void, v: string) {
    set(v)
    resetList()
    setError(null)
    setSummary(null)
    setConfirming(false)
  }

  async function loadMore() {
    const mine = gen.current
    setLoadingMore(true)
    try {
      const r = await listChanges(filters, rows[rows.length - 1]?.cursor)
      if (mine !== gen.current) return
      setExtra({ key: filterKey, rows: [...extraRows, ...r], last: r.length })
      setError(null)
    } catch {
      if (mine !== gen.current) return
      setError('Could not load more. Try again.')
    }
    setLoadingMore(false)
  }

  async function undo(target: ChangeRow[]) {
    setBusy(true)
    setConfirming(false)
    try {
      const t = await undoRows(target)
      setSummary(batchSummaryText(t))
      setError(null)
    } catch (e) {
      if (e instanceof PartialUndoError) setSummary(`${batchSummaryText(e.partial)} before it stopped`)
      setError('Something went wrong. Try again.')
    }
    resetList()
    await Promise.all([
      qc.invalidateQueries({ queryKey: ['changes'] }),
      qc.invalidateQueries({ queryKey: ['people'] }),
    ])
    setBusy(false)
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 px-6 py-10">
      <div>
        <AdminSteps />
        <h1 className="text-3xl font-semibold tracking-tight text-[var(--foreground)]">Changes</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">Everything volunteers and admins changed, newest first.</p>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <label className="flex flex-col gap-1 text-sm text-[var(--muted)]">
          Person
          <select className={field} value={userId} onChange={(e) => changeFilter(setUserId, e.target.value)}>
            <option value="">Everyone</option>
            {(people.data ?? []).map((p) => (
              <option key={p.user_id} value={p.user_id}>
                {p.email}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm text-[var(--muted)]">
          From
          <input type="date" className={field} value={fromDay} onChange={(e) => changeFilter(setFromDay, e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-sm text-[var(--muted)]">
          To
          <input type="date" className={field} value={toDay} onChange={(e) => changeFilter(setToDay, e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-sm text-[var(--muted)]">
          Kind
          <select className={field} value={kind} onChange={(e) => changeFilter(setKind, e.target.value)}>
            <option value="">All kinds</option>
            {Object.entries(KIND_LABEL).map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error && (
        <div role="alert" className={`${box} text-sm text-[var(--foreground)]`}>
          {error}
        </div>
      )}
      {summary && (
        <div role="status" className={`${box} text-sm text-[var(--foreground)]`}>
          {summary}
        </div>
      )}

      {undoable.length > 0 && !confirming && (
        <div>
          <button
            type="button"
            className={btn}
            disabled={busy || loadingMore || people.isPending}
            onClick={() => setConfirming(true)}
          >
            Undo all {undoable.length} shown
          </button>
        </div>
      )}
      {confirming && (
        <div className={`${box} flex flex-col gap-3 text-sm text-[var(--foreground)]`}>
          <p>
            Undo {undoable.length} changes by {filteredEmail}? Each one goes back to what it was before. This is
            recorded, and can itself be undone.
            {excludedUndos > 0 && " Undos of earlier undos aren't included; undo those one at a time."}
          </p>
          <div className="flex gap-2">
            <button type="button" className={btn} disabled={busy || loadingMore} onClick={() => void undo(undoable)}>
              Yes, undo them
            </button>
            <button type="button" className={btn} onClick={() => setConfirming(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {!loading && !error && rows.length === 0 && <p className="text-sm text-[var(--muted)]">No changes match.</p>}

      <ul className="flex flex-col gap-4">
        {rows.map((r) => {
          const d = describeChange(r)
          return (
            <li key={r.cursor} className="flex flex-col gap-1 border-t border-[var(--border)] pt-4">
              <p className="text-sm font-medium text-[var(--foreground)]">
                {d.what}
                {r.image_no && <span className="font-normal text-[var(--muted)]"> · {r.image_no}</span>}
              </p>
              <p className="text-xs text-[var(--muted)]">
                {new Date(r.at).toLocaleString()} · {emailOf(r.by_user)}
                {r.approved_by && ` · approved by ${emailOf(r.approved_by)}`}
                {r.undone && ' · undone'}
              </p>
              <p className="text-sm text-[var(--foreground)]">
                {d.before && (
                  <>
                    {d.before} <span aria-hidden="true">→</span>{' '}
                  </>
                )}
                {d.after}
              </p>
              {d.canUndo && (
                <div>
                  <button type="button" className={btn} disabled={busy || loadingMore} onClick={() => void undo([r])}>
                    Undo
                  </button>
                </div>
              )}
            </li>
          )
        })}
      </ul>

      {more && (
        <div>
          <button type="button" className={btn} disabled={loading} onClick={() => void loadMore()}>
            Load more
          </button>
        </div>
      )}
    </div>
  )
}
