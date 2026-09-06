import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-10 text-center">
      <p className="text-[var(--foreground)]">We couldn't find that photo.</p>
      <Link to="/" className="mt-3 inline-block text-sm font-medium text-[var(--accent)] no-underline">
        Back to search
      </Link>
    </div>
  )
}
