// Placeholder for admin pages that arrive in later tasks.
export function ComingSoon({ title }: { title: string }) {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-2 px-6 py-10">
      <h1 className="text-3xl font-semibold tracking-tight text-[var(--foreground)]">{title}</h1>
      <p className="text-[var(--muted)]">Coming soon</p>
    </div>
  )
}
