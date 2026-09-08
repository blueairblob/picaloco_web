const UNITS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ['year', 365 * 24 * 60 * 60 * 1000],
  ['month', 30 * 24 * 60 * 60 * 1000],
  ['week', 7 * 24 * 60 * 60 * 1000],
  ['day', 24 * 60 * 60 * 1000],
  ['hour', 60 * 60 * 1000],
  ['minute', 60 * 1000],
]

const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })

/** "4 hours ago" / "in 2 minutes" style relative label for an ISO timestamp. */
export function formatRelativeTime(isoString: string): string {
  const diffMs = new Date(isoString).getTime() - Date.now()
  const absMs = Math.abs(diffMs)

  if (absMs < 45_000) return 'just now'

  const [unit, unitMs] = UNITS.find(([, ms]) => absMs >= ms) ?? UNITS[UNITS.length - 1]
  return rtf.format(Math.round(diffMs / unitMs), unit)
}

/** Absolute timestamp for a title/tooltip, alongside the relative label. */
export function formatAbsoluteTime(isoString: string): string {
  return new Date(isoString).toLocaleString('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}
