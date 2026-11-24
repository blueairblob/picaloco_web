import { useCallback, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { MenuPanel } from './MenuPanel'

const PANEL_ID = 'site-menu-panel'

export function Header() {
  const [open, setOpen] = useState(false)
  const button = useRef<HTMLButtonElement>(null)
  const close = useCallback(() => setOpen(false), [])
  return (
    <header className="site-header border-b border-[var(--border)] bg-[var(--surface)]/80 backdrop-blur sticky top-0 z-10">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link to="/" className="site-title text-lg font-semibold tracking-tight text-[var(--foreground)] no-underline">
          RAT Photo Archive
        </Link>
        <button
          ref={button}
          type="button"
          aria-expanded={open}
          aria-controls={PANEL_ID}
          onClick={() => setOpen((o) => !o)}
          className="flex min-h-11 items-center gap-2 rounded-full border border-[var(--border)] px-4 text-base font-medium text-[var(--foreground)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
        >
          <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
          Menu
        </button>
        <MenuPanel id={PANEL_ID} open={open} onClose={close} returnFocusTo={button} />
      </div>
    </header>
  )
}
