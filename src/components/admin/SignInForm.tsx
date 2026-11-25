import { useState, type FormEvent } from 'react'

const inputClass =
  'rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)]'

export function SignInForm({ onSignIn }: { onSignIn: (email: string, password: string) => Promise<string | null> }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      setError(await onSignIn(email, password))
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : 'Sign-in failed. Check your connection and try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mx-auto flex w-full max-w-sm flex-col gap-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6"
    >
      <h1 className="text-xl font-semibold text-[var(--foreground)]">Sign in</h1>
      <label className="flex flex-col gap-1 text-sm text-[var(--muted)]">
        Email
        <input
          type="email"
          autoComplete="username"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputClass}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm text-[var(--muted)]">
        Password
        <input
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
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
        Sign in
      </button>
    </form>
  )
}
