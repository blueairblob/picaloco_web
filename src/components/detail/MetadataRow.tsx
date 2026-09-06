export function MetadataRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null
  return (
    <div className="flex flex-col gap-0.5 border-b border-[var(--border)] py-2.5 last:border-0 sm:flex-row sm:gap-4">
      <span className="w-full shrink-0 text-sm text-[var(--muted)] sm:w-40">{label}</span>
      <span className="text-sm text-[var(--foreground)]">{value}</span>
    </div>
  )
}
