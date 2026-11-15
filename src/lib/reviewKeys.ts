export type ReviewAction =
  | 'confirm'
  | 'useSuggestion'
  | 'edit'
  | 'notVisible'
  | 'noLoco'
  | 'skip'
  | 'back'
  | 'cancelEdit'

const KEYS: Record<string, ReviewAction> = {
  enter: 'confirm',
  u: 'useSuggestion',
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

// Ctrl/Cmd+Enter (Save & next from inside a box) is handled by the page, which knows about modifiers.
// Escape (discard the edit) only counts while typing, so a stray Escape never throws away work.
export function shortcutFor(
  key: string,
  target: { tagName: string; isContentEditable: boolean },
): ReviewAction | null {
  if (isTypingTarget(target)) return key === 'Escape' ? 'cancelEdit' : null
  return KEYS[key.toLowerCase()] ?? null
}

// Ctrl/Cmd+Enter in a box is Save & next. From the other field's box, a main record that needs a
// recheck and wasn't touched is never implicitly "kept": the reviewer must look at it first.
export function ctrlEnterAction(
  inOtherBox: boolean,
  mainTouched: boolean,
  mainNeedsRecheck: boolean,
): 'confirm' | 'chooseMain' {
  return inOtherBox && !mainTouched && mainNeedsRecheck ? 'chooseMain' : 'confirm'
}
