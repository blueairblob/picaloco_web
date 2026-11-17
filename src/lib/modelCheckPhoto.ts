import type { CheckMode } from '@/lib/modelCheckParams'

// One photo, answered again from the conflict list (?image=<image_no> on the checking page).

// How a new answer for the photo is saved. A photo last answered in the random sample stays blind (the
// model's guess is hidden), so the new answer still counts for accuracy; otherwise sure or unsure by
// the prediction shown.
export function photoMode(
  rec: { checked_mode: CheckMode | null; model_p: number | null },
  sureThreshold: number,
): CheckMode {
  if (rec.checked_mode === 'sample') return 'sample'
  return rec.model_p !== null && rec.model_p >= sureThreshold ? 'sure' : 'unsure'
}

export function photoCheckLink(taskId: string, imageNo: string, runId: number | null): string {
  const sp = new URLSearchParams()
  if (runId !== null) sp.set('run', String(runId))
  sp.set('image', imageNo)
  return `/admin/model-check/${encodeURIComponent(taskId)}?${sp.toString()}`
}

// The photo to answer again, exactly as written (image_no is never trimmed), or null.
export function parseCheckImage(sp: URLSearchParams): string | null {
  const raw = sp.get('image')
  return raw && raw.trim() ? raw : null
}
