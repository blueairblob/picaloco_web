import { useQuery } from '@tanstack/react-query'
import { useAdminSession } from '@/hooks/useAdminSession'
import { myHeld } from '@/services/approvalService'

// For a trainee only: how many saves wait for approval, and the ones an admin sent back.
export function HeldPanel() {
  const { status, inTraining } = useAdminSession()
  const trainee = status === 'volunteer' && inTraining
  const held = useQuery({ queryKey: ['my-held'], queryFn: myHeld, enabled: trainee })
  if (!trainee || !held.data) return null
  const waiting = held.data.filter((h) => h.decision === 'pending').length
  const sentBack = held.data.filter((h) => h.decision === 'rejected')
  if (waiting === 0 && sentBack.length === 0) return null
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 text-sm text-[var(--foreground)]">
      {waiting > 0 && <p>{waiting} waiting for approval</p>}
      {sentBack.length > 0 && (
        <div>
          <h2 className="mb-2 text-sm font-medium uppercase tracking-wide text-[var(--muted)]">Sent back</h2>
          <ul className="flex flex-col gap-1">
            {sentBack.map((h) => (
              <li key={`${h.kind}:${h.id}`}>
                {h.image_no} <span className="text-[var(--muted)]">({h.subject})</span>
                {h.note && <span>: {h.note}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
