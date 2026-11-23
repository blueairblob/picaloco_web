// A person's email for display. While the people list is still loading, show a neutral label rather
// than the "unknown" fallback; if loading failed, fall back.
export function personLabel(
  people: { user_id: string; email: string }[] | undefined,
  id: string,
  fallback: string,
  failed = false,
): string {
  if (!people) return failed ? fallback : 'Loading…'
  return people.find((p) => p.user_id === id)?.email ?? fallback
}
