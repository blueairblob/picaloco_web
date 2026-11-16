import { Link } from 'react-router-dom'
import { UserMenu } from './UserMenu'

export function Header() {
  return (
    <header className="site-header border-b border-[var(--border)] bg-[var(--surface)]/80 backdrop-blur sticky top-0 z-10">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link to="/" className="site-title text-lg font-semibold tracking-tight text-[var(--foreground)] no-underline">
          RAT Photo Archive
        </Link>
        <UserMenu />
      </div>
    </header>
  )
}
