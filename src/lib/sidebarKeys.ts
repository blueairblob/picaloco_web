// Ctrl/Cmd+B opens and closes the sidebar from anywhere, except in a text box (where it belongs to
// the text) and while a modal such as Settings is open (the sidebar is behind it).
export function shouldToggleSidebar(e: {
  key: string
  ctrlKey: boolean
  metaKey: boolean
  target: { tagName: string; isContentEditable: boolean } | null
  modalOpen: boolean
}): boolean {
  if (e.key !== 'b' || !(e.ctrlKey || e.metaKey)) return false
  if (e.modalOpen) return false
  const t = e.target
  if (t && (['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName) || t.isContentEditable)) return false
  return true
}
