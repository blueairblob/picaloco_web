import { useEffect, useRef, useState, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { Link, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAdminSession } from '@/hooks/useAdminSession'
import { useModalDialog } from '@/hooks/useModalDialog'
import { menuSections } from '@/lib/roles'
import { isCurrent, shouldCloseOnRoute } from '@/lib/menuPanel'
import { listPeople } from '@/services/volunteerService'
import { SettingsDialog } from './SettingsDialog'

const item =
  'flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-base text-[var(--foreground)] no-underline hover:bg-[var(--background)] hover:text-[var(--accent)] aria-[current=page]:font-semibold aria-[current=page]:text-[var(--accent)]'
const heading = 'px-3 pt-2 pb-1 text-xs font-medium uppercase tracking-wide text-[var(--muted)]'

export function MenuPanel({
  id,
  open,
  onClose,
  returnFocusTo,
}: {
  id: string
  open: boolean
  onClose: () => void
  returnFocusTo?: RefObject<HTMLElement | null>
}) {
  const { pathname, search } = useLocation()
  const { status, email, inTraining, signOut } = useAdminSession()
  const [settingsOpen, setSettingsOpen] = useState(false)
  // Settings sits on top of the panel; Escape and the focus trap belong to whichever is on top.
  const settingsButton = useRef<HTMLButtonElement>(null)
  const settingsJustClosed = useRef(false)
  const ref = useModalDialog(open && !settingsOpen, onClose, returnFocusTo, {
    initialFocus: () => {
      if (!settingsJustClosed.current) return null
      settingsJustClosed.current = false
      return settingsButton.current
    },
  })
  // Closing the panel by any route (Menu button, back, backdrop) forgets Settings.
  if (!open && settingsOpen) {
    setSettingsOpen(false)
  }
  // Same key as the Volunteers page, so the count and that page share one fetch.
  const people = useQuery({ queryKey: ['people'], queryFn: listPeople, enabled: status === 'admin' })
  const heldTotal = (people.data ?? []).reduce((n, p) => n + p.held_count, 0)

  const here = pathname + search
  const prev = useRef(here)
  useEffect(() => {
    if (shouldCloseOnRoute(prev.current, here)) onClose()
    prev.current = here
  }, [here, onClose])

  const link = (to: string) => ({ to, onClick: onClose, className: item, 'aria-current': isCurrent(to, pathname) ? ('page' as const) : undefined })
  const signedIn = status === 'admin' || status === 'volunteer' || status === 'no-access' || status === 'error'

  // Portalled: the header's backdrop blur would otherwise become the containing block of position: fixed.
  return createPortal(
    <>
      {open && (
        <div className="fixed inset-0 z-30">
          <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
          <div
            ref={ref}
            id={id}
            role="dialog"
            aria-modal="true"
            aria-label="Menu"
            tabIndex={-1}
            className="menu-panel-in absolute inset-y-0 left-0 flex w-[19rem] max-w-[85vw] flex-col overflow-y-auto border-r border-[var(--border)] bg-[var(--surface)] p-2 shadow-lg"
          >
            <div className="flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="min-h-11 rounded-lg px-3 text-base text-[var(--foreground)] hover:text-[var(--accent)]"
              >
                Close
              </button>
            </div>

            <Link {...link('/')}>Search the archive</Link>

            {menuSections(status, inTraining).map((section) => (
              <div key={section.title}>
                <div className={heading}>{section.title}</div>
                {section.items.map((step, i) => (
                  <Link key={step.path} {...link(step.path)}>
                    <span aria-hidden="true" className="flex size-5 items-center justify-center text-sm text-[var(--muted)]">
                      {i + 1}
                    </span>
                    <span className="flex flex-col py-1 leading-tight">
                      {step.label}
                      {step.path === '/admin/approvals' && heldTotal > 0 && ` (${heldTotal})`}
                      {step.hint && <span className="text-xs text-[var(--muted)]">{step.hint}</span>}
                    </span>
                  </Link>
                ))}
                {section.note && <p className="px-3 py-1 text-xs text-[var(--muted)]">{section.note}</p>}
              </div>
            ))}

            <div className="my-2 border-t border-[var(--border)]" role="separator" />
            <button ref={settingsButton} type="button" onClick={() => {
                setSettingsOpen(true)
              }} className={item}>
              Settings
            </button>

            <div className={heading}>Account</div>
            {status === 'signed-out' && <Link {...link('/admin/fixes')}>Sign in (admin)</Link>}
            {signedIn && (
              <div className="truncate px-3 py-1 text-sm text-[var(--muted)]" title={email ?? undefined}>
                {email}
              </div>
            )}
            {signedIn && (
              <button
                type="button"
                onClick={() => {
                  onClose()
                  void signOut()
                }}
                className={item}
              >
                Sign out
              </button>
            )}
          </div>
        </div>
      )}
      <SettingsDialog open={open && settingsOpen} onClose={() => {
          settingsJustClosed.current = true
          setSettingsOpen(false)
        }}
        returnFocusTo={settingsButton} />
    </>,
    document.body,
  )
}
