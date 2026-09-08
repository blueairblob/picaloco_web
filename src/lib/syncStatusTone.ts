import type { SyncStatusRow } from '@/types/sync'

// Judgement call: this pipeline runs on demand during transient, on-site engagements, not on a
// fixed cron (see filemaker_sync/CLAUDE.md — cron/background automation is explicitly out of
// scope there). There's no "expected" sync cadence to compare against, so this threshold is a
// simple operator heuristic ("has anyone checked recently"), not a correctness guarantee.
export const STALE_AFTER_HOURS = 24

export type StatusTone = 'ok' | 'warning' | 'danger' | 'neutral'

export interface HeadlineStatus {
  label: string
  tone: StatusTone
}

export function getHeadlineStatus(row: SyncStatusRow | null): HeadlineStatus {
  if (!row) return { label: 'No sync recorded yet', tone: 'neutral' }
  if (!row.ok) return { label: 'Sync issue', tone: 'danger' }

  const ageHours = (Date.now() - new Date(row.run_at).getTime()) / (60 * 60 * 1000)
  if (ageHours > STALE_AFTER_HOURS) return { label: 'Stale', tone: 'warning' }
  return { label: 'Up to date', tone: 'ok' }
}
