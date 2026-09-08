import type { StatusTone } from '@/lib/syncStatusTone'

const TONE_CLASSES: Record<StatusTone, string> = {
  ok: 'border-[var(--success)]/30 bg-[var(--success)]/10 text-[var(--success)]',
  warning: 'border-[var(--warning)]/30 bg-[var(--warning)]/10 text-[var(--warning)]',
  danger: 'border-[var(--danger)]/30 bg-[var(--danger)]/10 text-[var(--danger)]',
  neutral: 'border-[var(--muted)]/30 bg-[var(--muted)]/10 text-[var(--muted)]',
}

export function StatusBadge({ label, tone }: { label: string; tone: StatusTone }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ${TONE_CLASSES[tone]}`}
    >
      {label}
    </span>
  )
}
