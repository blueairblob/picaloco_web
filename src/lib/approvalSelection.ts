// Remove only the acted-on keys from the selection.
export function removeKeys(selected: Set<string>, keys: Iterable<string>): Set<string> {
  const n = new Set(selected)
  for (const k of keys) n.delete(k)
  return n
}

// A rejection note is cleared only if it still reads as it did when sent, so text typed during an
// in-flight reject survives.
export function clearNoteIfSent(current: string | undefined, sent: string | undefined): string {
  return (current ?? '') === (sent ?? '') ? '' : (current ?? '')
}
