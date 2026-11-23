import type { HeldMine } from '@/services/approvalService'

const DAY_MS = 24 * 60 * 60 * 1000

// Items sent back within the last `days` days, newest first.
export function recentRejected(held: HeldMine[], now: number, days = 30): HeldMine[] {
  const cutoff = now - days * DAY_MS
  return held
    .filter((h) => h.decision === 'rejected' && h.decided_at !== null && Date.parse(h.decided_at) >= cutoff)
    .sort((a, b) => Date.parse(b.decided_at as string) - Date.parse(a.decided_at as string))
}
