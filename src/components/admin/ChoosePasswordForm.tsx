import { useState, type FormEvent } from 'react'
import { adminSupabase } from '@/lib/supabase/adminClient'

const inputClass =
  'rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)]'

// First sign-in with a temporary password: the volunteer picks their own before going on.
export function ChoosePasswordForm({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (password.length < 8) return setError('Use at least 8 characters.')
    if (password !== confirm) return setError("The two passwords don't match.")
    setSubmitting(true)
    try {
      const { error: updateError } = await adminSupabase.auth.updateUser({ password })
      if (updateError) return setError(updateError.message)
      const { error: rpcError } = await adminSupabase.rpc('password_changed')
      if (rpcError) return setError(rpcError.message)
      onDone()
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : 'Could not save the password. Try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mx-auto flex w-full max-w-sm flex-col gap-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6"
    >
      <h1 className="text-xl font-semibold text-[var(--foreground)]">Choose your password</h1>
      <p className="text-sm text-[var(--muted)]">Pick a password of your own before you go on.</p>
      <label className="flex flex-col gap-1 text-sm text-[var(--muted)]">
        New password
        <input
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={inputClass}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm text-[var(--muted)]">
        Confirm password
        <input
          type="password"
          autoComplete="new-password"
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className={inputClass}
        />
      </label>
      {error && (
        <p role="alert" className="text-sm text-[var(--foreground)]">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={submitting}
        className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--background)] disabled:opacity-50"
      >
        Save password
      </button>
    </form>
  )
}
