export type ReviewAction = 'confirm' | 'edit' | 'notVisible' | 'noLoco' | 'skip' | 'back' | 'cancelEdit'

const KEYS: Record<string, ReviewAction> = {
  enter: 'confirm',
  e: 'edit',
  n: 'notVisible',
  x: 'noLoco',
  s: 'skip',
  arrowright: 'skip',
  arrowleft: 'back',
  escape: 'cancelEdit',
}

export function isTypingTarget(target: { tagName: string; isContentEditable: boolean }): boolean {
  const tag = target.tagName.toUpperCase()
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable
}

// Ctrl/Cmd+Enter (save edit) is handled by the page, which knows about modifiers.
export function shortcutFor(
  key: string,
  target: { tagName: string; isContentEditable: boolean },
): ReviewAction | null {
  const action = KEYS[key.toLowerCase()] ?? null
  if (isTypingTarget(target)) return action === 'cancelEdit' ? action : null
  return action
}
