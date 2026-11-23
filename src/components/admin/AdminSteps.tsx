import { Link, useLocation } from 'react-router-dom'
import { ADMIN_STEPS, currentAdminStep } from '@/lib/adminWorkflow'
import { useAdminSession } from '@/hooks/useAdminSession'

// The step strip at the top of each admin overview page: where this page sits in the data's flow,
// and a link to every other step.
export function AdminSteps() {
  const current = currentAdminStep(useLocation().pathname)
  const { status } = useAdminSession()
  // Migration status is admin-only, so a volunteer isn't offered it.
  const steps = ADMIN_STEPS.map((step, i) => ({ step, i })).filter(({ step }) => status !== 'volunteer' || step.path !== '/admin')
  return (
    <nav aria-label="Admin workflow" className="mb-3">
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
        {steps.map(({ step, i }, n) => (
          <li key={step.path} className="flex items-center gap-2">
            {i === current ? (
              <span aria-current="step" className="rounded-full bg-[var(--accent)] px-3 py-1 font-medium text-[var(--background)]">
                {i + 1} {step.label}
              </span>
            ) : (
              <Link to={step.path} className="rounded-full px-3 py-1 text-[var(--accent)] no-underline hover:bg-[var(--surface)]">
                {i + 1} {step.label}
              </Link>
            )}
            {n < steps.length - 1 && (
              <span aria-hidden="true" className="text-[var(--muted)]">
                ›
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}
