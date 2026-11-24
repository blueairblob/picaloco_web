import type { ReactNode, RefObject } from 'react'
import { useTheme, type Theme } from '@/hooks/useTheme'
import { useTextSize } from '@/hooks/useTextSize'
import { useModalDialog } from '@/hooks/useModalDialog'
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
    <button type="button" role="radio" aria-checked={on} onClick={onPick} className={item}>
      <Tick on={on} />
      {children}
    </button>
  )
}

export function SettingsDialog({
  open,
  onClose,
  returnFocusTo,
}: {
  open: boolean
  onClose: () => void
  returnFocusTo?: RefObject<HTMLElement | null>
}) {
  const ref = useModalDialog(open, onClose, returnFocusTo)
  const { theme, setTheme } = useTheme()
  const { textSize, setTextSize } = useTextSize()
  if (!open) return null
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
        tabIndex={-1}
        className="relative max-h-[calc(100dvh-2rem)] w-full max-w-sm overflow-y-auto rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-lg"
      >
        <div className="flex items-center justify-between">
          <h2 className="px-3 text-lg font-semibold text-[var(--foreground)]">Settings</h2>
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 rounded-lg px-3 text-base text-[var(--foreground)] hover:text-[var(--accent)]"
          >
            Close
          </button>
        </div>
        <div className={heading}>Theme</div>
        <div role="radiogroup" aria-label="Theme">
          {THEMES.map(([t, label]) => (
            <Choice key={t} on={theme === t} onPick={() => setTheme(t)}>
              {label}
            </Choice>
          ))}
        </div>
        <div className={heading}>Text size</div>
        <div role="radiogroup" aria-label="Text size">
          {SIZES.map(([s, label]) => (
            <Choice key={s} on={textSize === s} onPick={() => setTextSize(s)}>
              {label}
            </Choice>
          ))}
        </div>
      </div>
    </div>
  )
}
