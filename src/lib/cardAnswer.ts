// The answer a reviewer builds up on one card before Save & next. "No loco in photo" (X) covers the
// whole photo; "Not visible" (N) is per field. Pressing either only selects it; nothing is saved until
// Save & next, which saves every field on the card together.
import { decideSave, editBaseline, isReviewed, sameValues, type DecisionRecord, type SaveDecision } from '@/lib/reviewDecision'
import { normaliseValues, type FixStatus } from '@/services/dataFixService'

export type Mark = 'none_visible' | 'no_loco'

// What the reviewer switched on or off on this card visit. undefined = untouched, so the saved answer
// shows (a lit button for a record already saved as not visible / no loco).
export interface CardToggles {
  noLoco?: boolean
  notVisible: Record<string, boolean | undefined>
}

export const NO_TOGGLES: CardToggles = { notVisible: {} }

// One field on the card. dirty = an unsaved typed edit exists; typed text always beats a saved mark.
export interface FieldState {
  fixId: string
  status: FixStatus
  dirty: boolean
}

export function savedMark(status: FixStatus): Mark | null {
  return status === 'none_visible' || status === 'no_loco' ? status : null
}

// Whether X shows lit. Follows the main field's saved answer until the reviewer presses it.
export function noLocoOn(main: FieldState, t: CardToggles): boolean {
  return t.noLoco ?? (!main.dirty && main.status === 'no_loco')
}

export function fieldMark(f: FieldState, t: CardToggles): Mark | null {
  if (t.noLoco ?? (!f.dirty && f.status === 'no_loco')) return 'no_loco'
  if (t.notVisible[f.fixId] ?? (!f.dirty && f.status === 'none_visible')) return 'none_visible'
  return null
}

export function toggleNoLoco(main: FieldState, t: CardToggles): CardToggles {
  return { ...t, noLoco: !noLocoOn(main, t) }
}

// N on a field that shows "No loco" switches that off and selects "Not visible" instead.
export function toggleNotVisible(f: FieldState, t: CardToggles): CardToggles {
  const mark = fieldMark(f, t)
  return {
    noLoco: mark === 'no_loco' ? false : t.noLoco,
    notVisible: { ...t.notVisible, [f.fixId]: mark !== 'none_visible' },
  }
}

// Typing in a field means there is something to read: its marks switch off.
export function clearMarks(f: FieldState, t: CardToggles): CardToggles {
  return {
    noLoco: fieldMark(f, t) === 'no_loco' ? false : t.noLoco,
    notVisible: { ...t.notVisible, [f.fixId]: false },
  }
}

// Whether the reviewer changed anything for the main field on this visit.
export function mainTouched(main: FieldState, t: CardToggles): boolean {
  return main.dirty || t.noLoco !== undefined || t.notVisible[main.fixId] !== undefined
}

// What Save & next writes for the main field; 'empty' when there is nothing to save (box empty, no mark).
export function mainDecision(
  rec: DecisionRecord,
  draftText: string,
  dirty: boolean,
  mark: Mark | null,
): SaveDecision | 'empty' {
  if (mark) return { status: mark, values: [] }
  // Typed, or a saved mark switched off: the box is the answer.
  if (dirty || savedMark(rec.status)) {
    const values = normaliseValues(draftText)
    return values.length > 0 ? decideSave(rec, 'edit', values) : 'empty'
  }
  const d = decideSave(rec, 'confirm')
  return d.values.length > 0 ? d : 'empty'
}

// What Save & next writes for another field on the photo; null = leave it as it is. Saved only when
// the reviewer changed it: typed in it, or selected a mark it doesn't already have. Switching a mark
// off without typing anything saves nothing, so no answer is ever invented.
export function companionTarget(
  row: DecisionRecord,
  draftText: string | undefined,
  dirty: boolean,
  mark: Mark | null,
): SaveDecision | null {
  if (!dirty && (!mark || mark === savedMark(row.status))) return null
  let target: SaveDecision
  if (mark) {
    target = { status: mark, values: [] }
  } else {
    const values = normaliseValues(draftText ?? editBaseline(row).join('\n'))
    target = values.length > 0 ? decideSave(row, 'edit', values) : { status: 'none_visible', values: [] }
  }
  if (isReviewed(row) && target.status === row.status && sameValues(target.values, row.values)) return null
  return target
}
