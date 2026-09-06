import { Link } from 'react-router-dom'

export function Header() {
  return (
    <header className="border-b border-[var(--border)] bg-[var(--surface)]/80 backdrop-blur sticky top-0 z-10">
      <div className="mx-auto max-w-6xl px-6 py-4">
        <Link to="/" className="text-lg font-semibold tracking-tight text-[var(--foreground)] no-underline">
          RAT Photo Archive
        </Link>
      </div>
    </header>
  )
}
