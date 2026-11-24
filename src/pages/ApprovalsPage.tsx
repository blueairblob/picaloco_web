import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AdminSteps } from '@/components/admin/AdminSteps'
import { approve, listHeld, reject, summaryLine, type DecisionResult, type HeldItem } from '@/services/approvalService'
import { listPeople } from '@/services/volunteerService'
import { clearNoteIfSent, removeKeys } from '@/lib/approvalSelection'
import { personLabel } from '@/lib/personLabel'
import { getThumbnailUrl } from '@/services/images'
import { STATUS_LABEL } from '@/lib/fixStatusLabel'
import type { FixStatus } from '@/services/dataFixService'

const box = 'rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6'
const btn =
  'rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm text-[var(--foreground)] hover:border-[var(--accent)] disabled:opacity-50'

const keyOf = (i: Pick<HeldItem, 'kind' | 'id'>) => `${i.kind}:${i.id}`

function fixText(v: Record<string, unknown> | null): string {
  if (!v) return '(none)'
  const values = Array.isArray(v.values) ? (v.values as unknown[]).map(String).join('; ') : ''
  const status = typeof v.status === 'string' ? (STATUS_LABEL[v.status as FixStatus] ?? v.status) : ''
  return [values || '(empty)', status && `(${status})`].filter(Boolean).join(' ')
}

function answerText(v: Record<string, unknown> | null, field: 'shown_answer' | 'answer'): string {
  const a = v?.[field]
  return typeof a === 'string' && a ? a : '(none)'
}

function Change({ item }: { item: HeldItem }) {
  if (item.kind === 'fix') {
    return (
      <p className="text-sm text-[var(--foreground)]">
        {fixText(item.before)} <span aria-hidden="true">→</span> {fixText(item.proposed)}
      </p>
    )
  }
  return (
    <p className="text-sm text-[var(--foreground)]">
      {answerText(item.before, 'shown_answer')} <span aria-hidden="true">→</span> {answerText(item.proposed, 'answer')}
    </p>
  )
}

export function ApprovalsPage() {
  const qc = useQueryClient()
  const held = useQuery({ queryKey: ['held'], queryFn: () => listHeld() })
  const people = useQuery({ queryKey: ['people'], queryFn: listPeople })
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [summary, setSummary] = useState<string | null>(null)

  const emailOf = (id: string) => personLabel(people.data, id, 'Unknown volunteer', people.isError)

  const groups = useMemo(() => {
    const m = new Map<string, HeldItem[]>()
    for (const i of held.data ?? []) m.set(i.submitted_by, [...(m.get(i.submitted_by) ?? []), i])
    return [...m.entries()]
  }, [held.data])
  const all = held.data ?? []

  // Runs one batch per kind. Each kind that succeeds is cleared from the selection straight away;
  // onAllDone runs only once every kind has succeeded.
  async function act(
    items: HeldItem[],
    verb: 'approved' | 'rejected',
    run: (kind: 'fix' | 'answer', ids: number[]) => Promise<DecisionResult>,
    onAllDone?: () => void,
  ): Promise<boolean> {
    if (items.length === 0) return false
    setBusy(true)
    let ok = false
    const total: DecisionResult = { done: 0, stale: [], skipped: [] }
    let anyDone = false
    try {
      for (const kind of ['fix', 'answer'] as const) {
        const batch = items.filter((i) => i.kind === kind)
        if (batch.length === 0) continue
        const r = await run(kind, batch.map((i) => i.id))
        anyDone = true
        total.done += r.done
        total.stale.push(...r.stale)
        total.skipped.push(...r.skipped)
        setSelected((s) => removeKeys(s, batch.map(keyOf)))
      }
      onAllDone?.()
      setSummary(summaryLine(total, verb))
      setError(null)
      ok = true
    } catch {
      setSummary(anyDone ? `${summaryLine(total, verb)} before it stopped` : null)
      setError('Something went wrong. Try again.')
    }
    // Refetch before re-enabling, so rows already done are gone before any retry.
    await Promise.all([qc.invalidateQueries({ queryKey: ['held'] }), qc.invalidateQueries({ queryKey: ['people'] })])
    setBusy(false)
    return ok
  }

  const doApprove = (items: HeldItem[], force = false) =>
    act(items, 'approved', (k, ids) =>
      approve(k, ids, force, force ? items.find((i) => i.kind === k)?.current_updated_at : undefined),
    )
  // The note is sent with every kind's batch and cleared only once all of them went through, but only if it is still the text
  // that was sent, so anything typed during the request survives.
  async function doReject(items: HeldItem[], userId: string) {
    const sent = notes[userId]
    await act(
      items,
      'rejected',
      (k, ids) => reject(k, ids, sent?.trim() || undefined),
      () => setNotes((n) => ({ ...n, [userId]: clearNoteIfSent(n[userId], sent) })),
    )
  }

  function toggle(i: HeldItem) {
    setSelected((s) => {
      const n = new Set(s)
      if (!n.delete(keyOf(i))) n.add(keyOf(i))
      return n
    })
  }
  const chosen = all.filter((i) => selected.has(keyOf(i)))
  const allSelected = all.length > 0 && chosen.length === all.length

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 px-6 py-10">
      <div>
        <AdminSteps />
        <h1 className="text-3xl font-semibold tracking-tight text-[var(--foreground)]">Approvals</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">Trainee work waiting for you, oldest first.</p>
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
      {held.isError && (
        <div role="alert" className={`${box} text-sm text-[var(--foreground)]`}>
          Could not load the waiting items. Try again.
        </div>
      )}
      {held.isSuccess && all.length === 0 && (
        <p className="text-sm text-[var(--muted)]">Nothing is waiting for approval.</p>
      )}

      {all.length > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-[var(--foreground)]">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={() => setSelected(allSelected ? new Set() : new Set(all.map(keyOf)))}
            />
            Select all
          </label>
          <button type="button" className={btn} disabled={busy || chosen.length === 0} onClick={() => void doApprove(chosen)}>
            Approve selected
          </button>
        </div>
      )}

      {groups.map(([userId, items]) => {
        const email = emailOf(userId)
        return (
          <section key={userId} className={`${box} flex flex-col gap-4`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-medium text-[var(--foreground)]">
                {email} <span className="text-sm text-[var(--muted)]">({items.length})</span>
              </h2>
              <button type="button" className={btn} disabled={busy} onClick={() => void doApprove(items)}>
                Approve all from {email}
              </button>
            </div>
            <label className="flex flex-col gap-1 text-sm text-[var(--muted)]">
              Note for rejections (optional)
              <input
                type="text"
                value={notes[userId] ?? ''}
                onChange={(e) => setNotes((n) => ({ ...n, [userId]: e.target.value }))}
                className="rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-[var(--foreground)]"
              />
            </label>
            <ul className="flex flex-col gap-4">
              {items.map((i) => (
                <li key={keyOf(i)} className="flex flex-wrap gap-4 border-t border-[var(--border)] pt-4">
                  <input
                    type="checkbox"
                    aria-label={`Select ${i.image_no}`}
                    checked={selected.has(keyOf(i))}
                    onChange={() => toggle(i)}
                  />
                  <img
                    src={getThumbnailUrl(i.image_no)}
                    alt={i.image_no}
                    loading="lazy"
                    className="h-24 w-32 rounded-lg object-cover"
                  />
                  <div className="flex min-w-[14rem] flex-1 flex-col gap-1">
                    <p className="text-sm font-medium text-[var(--foreground)]">
                      {i.image_no} <span className="font-normal text-[var(--muted)]">· {i.subject}</span>
                    </p>
                    {i.description && <p className="text-sm text-[var(--muted)]">{i.description}</p>}
                    <Change item={i} />
                    {i.stale && i.kind === 'fix' && (
                      <p className="text-sm text-[var(--foreground)]">Changed since: now {fixText(i.current)}</p>
                    )}
                    <div className="mt-1 flex flex-wrap gap-2">
                      {i.stale ? (
                        <button type="button" className={btn} disabled={busy} onClick={() => void doApprove([i], true)}>
                          Approve anyway
                        </button>
                      ) : (
                        <button type="button" className={btn} disabled={busy} onClick={() => void doApprove([i])}>
                          Approve
                        </button>
                      )}
                      <button type="button" className={btn} disabled={busy} onClick={() => void doReject([i], userId)}>
                        Reject
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )
      })}
    </div>
  )
}
