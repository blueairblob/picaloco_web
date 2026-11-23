// Local midnight of a yyyy-mm-dd day (plus whole days, month rollover handled by Date), as an ISO string.
export function dayStart(day: string, plus = 0): string | undefined {
  if (!day) return undefined
  const [y, m, d] = day.split('-').map(Number)
  return new Date(y, m - 1, d + plus).toISOString()
}

// yyyy-mm-dd strings compare correctly as text. Null when the range is fine (or open-ended).
export function dateRangeError(from: string, to: string): string | null {
  return from && to && from > to ? "The 'from' date is after the 'to' date." : null
}
