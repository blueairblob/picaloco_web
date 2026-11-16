import type { FixStateEntry, ModelTask } from '@/services/modelCheckService'

const NO_LOCO = 'No loco'

// Mirrors the SQL rule in rat.save_model_answer exactly. A not-a-loco answer fills every linked
// field with No loco only if all of them are untouched extractions with no confidence (all or
// nothing); otherwise nothing is filled and each field that blocks it gets a note.
export function linkPreview(
  task: ModelTask,
  answerId: string,
  fixState: Record<string, FixStateEntry> | null,
  fixTitles: Record<string, string>,
): { fills: string[]; notes: string[] } {
  const none = { fills: [] as string[], notes: [] as string[] }
  const links = task.links
  if (!links || !fixState) return none
  const answer = task.answers.find((a) => a.id === answerId)
  if (!answer) return none
  const title = (id: string) => fixTitles[id] ?? id
  const ids = links.fix_ids

  if (answer[links.no_answer_flag] === false) {
    const entries = ids.map((id) => fixState[id])
    if (entries.some((s) => !s)) return none
    if (entries.every((s) => s.status === 'extracted' && s.confidence === 'none')) {
      if (ids.length === 0) return none
      return { fills: [...ids], notes: [`Also saves: ${ids.map((id) => `${title(id)} — ${NO_LOCO}`).join(', ')}`] }
    }
    const notes: string[] = []
    for (const id of ids) {
      const s = fixState[id]
      if (s.status === 'extracted' && s.confidence !== 'none') {
        const v = (s.values.length > 0 ? s.values : s.suggested_values).join('; ')
        if (v) notes.push(`Description names ${v} — ${title(id)} not changed`)
      } else if (s.status !== 'extracted' && s.status !== 'no_loco' && s.values.length > 0) {
        notes.push(`${title(id)} was saved as ${s.values.join('; ')} — not changed`)
      }
    }
    return { fills: [], notes }
  }

  const notes: string[] = []
  for (const id of ids) {
    if (fixState[id]?.status === 'no_loco') notes.push(`${title(id)} was saved as ${NO_LOCO} — not changed`)
  }
  return { fills: [], notes }
}
