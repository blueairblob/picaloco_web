import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useTheme, type Theme } from '@/hooks/useTheme'
import { useTextSize } from '@/hooks/useTextSize'
import { useAdminSession } from '@/hooks/useAdminSession'
import type { TextSize } from '@/lib/textSize'

const THEMES: [Theme, string][] = [
  ['system', 'System'],
  ['light', 'Light'],
  ['dark', 'Dark'],
  ['bespoke', 'Bespoke'],
]
const SIZES: [TextSize, string][] = [
  ['normal', 'Normal'],
  ['large', 'Large'],
]

const item =
  'flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-base text-[var(--foreground)] no-underline hover:bg-[var(--background)] hover:text-[var(--accent)]'
const heading = 'px-3 pt-2 pb-1 text-xs font-medium uppercase tracking-wide text-[var(--muted)]'

function Tick({ on }: { on: boolean }) {
  return (
    <span aria-hidden="true" className="flex size-5 items-center justify-center">
      {on && (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
          <path d="M5 12l5 5L20 7" />
        </svg>
      )}
    </span>
  )
}

function Choice({ on, onPick, children }: { on: boolean; onPick: () => void; children: ReactNode }) {
  return (
    <button type="button" role="menuitemradio" aria-checked={on} onClick={onPick} className={item}>
      <Tick on={on} />
      {children}
    </button>
  )
}

// Top-right menu: reading preferences for everyone, and the way in to the admin pages.
export function UserMenu() {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const button = useRef<HTMLButtonElement>(null)
  const { theme, setTheme } = useTheme()
  const { textSize, setTextSize } = useTextSize()
  const { status, email, signOut } = useAdminSession()

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false)
    }
    // While the menu is open no key reaches the review page's shortcuts (Enter = Save & next), even
    // when focus is not in the menu: Safari and Firefox on macOS don't focus a button on click.
    // Runs in the capture phase, before the page's own window listener.
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        setOpen(false)
        button.current?.focus()
      } else if (!root.current?.contains(e.target as Node)) {
        e.stopPropagation()
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('keydown', onKeyDown, true)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown, true)
    }
  }, [open])

  const close = () => setOpen(false)

  return (
    <div
      ref={root}
      className="relative"
      // Keys pressed inside the open menu stay in the menu. Once it is closed, keys pass through, so
      // the review shortcuts work again after Escape (Enter on the button is ignored by the page).
      onKeyDown={(e) => {
        if (open) e.stopPropagation()
      }}
    >
      <button
        ref={button}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex min-h-11 items-center gap-2 rounded-full border border-[var(--border)] px-4 text-base font-medium text-[var(--foreground)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
      >
        <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M4 6h16M4 12h16M4 18h16" />
        </svg>
        Menu
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Menu"
          className="absolute right-0 z-20 mt-2 max-h-[calc(100dvh-6rem)] w-64 overflow-y-auto rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-2 shadow-lg"
        >
          <div className={heading}>Theme</div>
          {THEMES.map(([t, label]) => (
            <Choice key={t} on={theme === t} onPick={() => setTheme(t)}>
              {label}
            </Choice>
          ))}
          <div className={heading}>Text size</div>
          {SIZES.map(([s, label]) => (
            <Choice key={s} on={textSize === s} onPick={() => setTextSize(s)}>
              {label}
            </Choice>
          ))}

          <div className="my-2 border-t border-[var(--border)]" role="separator" />

          {status === 'signed-out' && (
            <Link to="/admin/fixes" role="menuitem" onClick={close} className={item}>
              Sign in (admin)
            </Link>
          )}
          {(status === 'admin' || status === 'not-admin') && (
            <div className="truncate px-3 py-1 text-sm text-[var(--muted)]" title={email ?? undefined}>
              {email}
            </div>
          )}
          {status === 'admin' && (
            <>
              <Link to="/admin/fixes" role="menuitem" onClick={close} className={item}>
                Data fixes
              </Link>
              <Link to="/admin/model-check" role="menuitem" onClick={close} className={item}>
                Model check
              </Link>
              <Link to="/admin" role="menuitem" onClick={close} className={item}>
                Migration status
              </Link>
            </>
          )}
          {(status === 'admin' || status === 'not-admin') && (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                close()
                void signOut()
              }}
              className={item}
            >
              Sign out
            </button>
          )}
        </div>
      )}
    </div>
  )
}
