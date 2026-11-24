import { useEffect, useRef, type RefObject } from 'react'

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

// Escape closes, Tab cycles inside the container, focus moves in on open and returns on close
// (to `returnFocusTo` when given, else to whatever had focus at open; Safari/Firefox on macOS
// don't focus a button on click, so callers pass the button's ref).
// Keys never reach the page's own shortcuts while open: keys from outside the dialog are stopped
// in the capture phase, keys inside it in the bubble phase (pages listen on window; native
// Enter/Space activation of buttons still works).
export function useModalDialog(
  open: boolean,
  onClose: () => void,
  returnFocusTo?: RefObject<HTMLElement | null>,
  focus?: {
    // Element to focus on open instead of the first one (null falls back to the first).
    initialFocus?: () => HTMLElement | null
    // Return false to skip restoring focus on cleanup (another dialog is taking over).
    restoreFocus?: () => boolean
  },
) {
  const ref = useRef<HTMLDivElement | null>(null)
  const onCloseRef = useRef(onClose)
  const returnRef = useRef(returnFocusTo)
  const focusRef = useRef(focus)
  useEffect(() => {
    onCloseRef.current = onClose
    returnRef.current = returnFocusTo
    focusRef.current = focus
  })

  useEffect(() => {
    if (!open) return
    const node = ref.current
    const opener = document.activeElement as HTMLElement | null
    const returnTo = returnRef.current
    const items = () => Array.from(node?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])
    ;(focusRef.current?.initialFocus?.() ?? items()[0] ?? node)?.focus()

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onCloseRef.current()
        return
      }
      if (e.key === 'Tab') {
        const list = items()
        if (list.length === 0) {
          e.preventDefault()
          return
        }
        const first = list[0]
        const last = list[list.length - 1]
        const active = document.activeElement
        if (!node?.contains(active)) {
          e.preventDefault()
          first.focus()
        } else if (active === node) {
          e.preventDefault()
          ;(e.shiftKey ? last : first).focus()
        } else if (e.shiftKey && active === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && active === last) {
          e.preventDefault()
          first.focus()
        }
        return
      }
      if (!node?.contains(e.target as Node)) e.stopPropagation()
    }
    const stopInside = (e: KeyboardEvent) => e.stopPropagation()
    window.addEventListener('keydown', onKeyDown, true)
    node?.addEventListener('keydown', stopInside)
    return () => {
      window.removeEventListener('keydown', onKeyDown, true)
      node?.removeEventListener('keydown', stopInside)
      const target = returnTo?.current ?? opener
      target?.focus?.()
    }
  }, [open])

  return ref
}
