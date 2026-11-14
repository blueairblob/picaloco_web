export type ReviewAction = 'confirm' | 'edit' | 'notVisible' | 'noLoco' | 'skip' | 'back' | 'cancelEdit'

const KEYS: Record<string, ReviewAction> = {
  enter: 'confirm',
  e: 'edit',
  n: 'notVisible',
  x: 'noLoco',
  s: 'skip',
  arrowright: 'skip',
  arrowleft: 'back',
}

export function isTypingTarget(target: { tagName: string; isContentEditable: boolean }): boolean {
  const tag = target.tagName.toUpperCase()
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable
}

// Ctrl/Cmd+Enter (save edit) is handled by the page, which knows about modifiers.
// Escape (discard the edit) only counts while typing, so a stray Escape never throws away work.
export function shortcutFor(
  key: string,
  target: { tagName: string; isContentEditable: boolean },
): ReviewAction | null {
  if (isTypingTarget(target)) return key === 'Escape' ? 'cancelEdit' : null
  return KEYS[key.toLowerCase()] ?? null
}
