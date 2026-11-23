export function chunk<T>(items: T[], size: number): T[][] {
  if (!(size >= 1)) throw new Error('chunk size must be at least 1')
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

export interface BatchResult {
  undone?: number
  withdrawn?: number
  changed_since?: unknown[]
  fills_left?: unknown[]
  skipped?: unknown[]
}
export interface BatchTotals {
  done: number
  changedSince: number
  notUndoneHere: number
  skipped: number
}

export function sumBatchResults(rs: BatchResult[]): BatchTotals {
  const t: BatchTotals = { done: 0, changedSince: 0, notUndoneHere: 0, skipped: 0 }
  for (const r of rs) {
    t.done += (r.undone ?? 0) + (r.withdrawn ?? 0)
    t.changedSince += r.changed_since?.length ?? 0
    t.notUndoneHere += r.fills_left?.length ?? 0
    t.skipped += r.skipped?.length ?? 0
  }
  return t
}

export const batchSummaryText = (t: BatchTotals) =>
  `${t.done} undone, ${t.changedSince} changed since, ${t.notUndoneHere} not undone here, ${t.skipped} skipped`
