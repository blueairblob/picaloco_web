import { useEffect, useState, type FormEvent } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AdminSteps } from '@/components/admin/AdminSteps'
import {
  addVolunteer,
  listPeople,
  resetPassword,
  setVolunteer,
  type PasswordResult,
} from '@/services/volunteerService'

const box = 'rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6'
const btn =
  'rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm text-[var(--foreground)] hover:border-[var(--accent)] disabled:opacity-50'

interface Shown {
  email: string
  password: string
}

export function VolunteersPage() {
  const qc = useQueryClient()
  const people = useQuery({ queryKey: ['people'], queryFn: listPeople })
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [shown, setShown] = useState<Shown | null>(null)
  const [copied, setCopied] = useState(false)

  // The one-time password lives only in this component's state, so leaving the page clears it.
  useEffect(() => () => setShown(null), [])

  function handleResult(r: PasswordResult, fallbackEmail: string) {
    if (r.ok) {
      setShown({ email: r.email || fallbackEmail, password: r.tempPassword })
      setCopied(false)
      setError(null)
    } else {
      setError(r.message)
    }
  }

  async function refetch() {
    await qc.invalidateQueries({ queryKey: ['people'] })
  }

  async function onAdd(e: FormEvent) {
    e.preventDefault()
    const value = email.trim()
    if (!value) return
    setBusy(true)
    const r = await addVolunteer(value)
    handleResult(r, value)
    if (r.ok) {
      setEmail('')
      await refetch()
    }
    setBusy(false)
  }

  async function onReset(userId: string, rowEmail: string) {
    setBusy(true)
    handleResult(await resetPassword(userId), rowEmail)
    setBusy(false)
  }

  async function run(fn: () => Promise<void>) {
    setBusy(true)
    try {
      await fn()
      setError(null)
      await refetch()
    } catch {
      setError('Something went wrong. Try again.')
    }
    setBusy(false)
  }

  function onRemove(userId: string, rowEmail: string) {
    if (
      !window.confirm(
        `Remove access for ${rowEmail}? They will no longer be able to sign in to the review pages. Their past work stays.`,
      )
    )
      return
    void run(() => setVolunteer(userId, { active: false }))
  }

  async function copy() {
    if (!shown) return
    try {
      await navigator.clipboard.writeText(shown.password)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  const rows = people.data ?? []

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 px-6 py-10">
      <div>
        <AdminSteps />
        <h1 className="text-3xl font-semibold tracking-tight text-[var(--foreground)]">Volunteers</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">Add, train and remove people who review the archive.</p>
      </div>

      <form onSubmit={onAdd} className={`${box} flex flex-wrap items-end gap-3`}>
        <label className="flex min-w-[16rem] flex-1 flex-col gap-1 text-sm text-[var(--muted)]">
          Email
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-[var(--foreground)]"
          />
        </label>
        <button type="submit" disabled={busy} className={btn}>
          Add volunteer
        </button>
      </form>

      {error && (
        <div role="alert" className={`${box} text-sm text-[var(--foreground)]`}>
          {error}
        </div>
      )}

      {shown && (
        <div className={`${box} flex flex-col gap-3 border-[var(--accent)]`}>
          <p className="text-sm text-[var(--foreground)]">
            Temporary password for <strong>{shown.email}</strong>
          </p>
          <div className="flex items-center gap-3">
            <code className="rounded-lg bg-[var(--background)] px-3 py-2 text-lg tracking-wider text-[var(--foreground)]">
              {shown.password}
            </code>
            <button type="button" onClick={copy} className={btn}>
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <p className="text-sm text-[var(--muted)]">
            Give this to the volunteer in person or by phone. It won't be shown again.
          </p>
        </div>
      )}

      {people.isError && <div className={`${box} text-center text-[var(--muted)]`}>Something went wrong. Please try again.</div>}
      {people.isLoading && <div className={`${box} text-center text-[var(--muted)]`}>Loading…</div>}

      {!people.isLoading && !people.isError && (
        <div className="overflow-x-auto rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
          <table className="w-full text-left text-sm text-[var(--foreground)]">
            <thead className="text-[var(--muted)]">
              <tr>
                <th className="p-3 font-medium">Email</th>
                <th className="p-3 font-medium">Role</th>
                <th className="p-3 font-medium">In training</th>
                <th className="p-3 font-medium">Held</th>
                <th className="p-3 font-medium">Added</th>
                <th className="p-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => {
                const removed = p.removed_at !== null
                const isAdmin = p.role === 'admin'
                return (
                  <tr key={p.user_id} className="border-t border-[var(--border)]">
                    <td className="p-3">{p.email}</td>
                    <td className="p-3">{p.role}</td>
                    <td className="p-3">
                      {isAdmin ? (
                        ''
                      ) : (
                        <input
                          type="checkbox"
                          role="switch"
                          aria-label={`In training: ${p.email}`}
                          checked={p.in_training}
                          disabled={busy || removed}
                          onChange={(e) => void run(() => setVolunteer(p.user_id, { inTraining: e.target.checked }))}
                        />
                      )}
                    </td>
                    <td className="p-3">{p.held_count}</td>
                    <td className="p-3">{new Date(p.added_at).toLocaleDateString()}</td>
                    <td className="p-3">
                      {isAdmin ? null : removed ? (
                        <span className="flex items-center gap-2">
                          <span className="text-[var(--muted)]">Removed</span>
                          <button
                            type="button"
                            disabled={busy}
                            className={btn}
                            onClick={() => void run(() => setVolunteer(p.user_id, { active: true }))}
                          >
                            Restore
                          </button>
                        </span>
                      ) : (
                        <span className="flex gap-2">
                          <button type="button" disabled={busy} className={btn} onClick={() => onRemove(p.user_id, p.email)}>
                            Remove
                          </button>
                          <button type="button" disabled={busy} className={btn} onClick={() => void onReset(p.user_id, p.email)}>
                            Reset password
                          </button>
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
