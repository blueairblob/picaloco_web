export type ShowMode = 'all' | 'reviews' | 'held' | 'undos'

export const SHOW_OPTIONS: [ShowMode, string][] = [
  ['all', 'All'],
  ['reviews', 'Reviews and answers'],
  ['held', 'Held for approval'],
  ['undos', 'Undos'],
]

export function showKinds(mode: ShowMode): string[] | undefined {
  switch (mode) {
    case 'reviews':
      return ['fix_review', 'fix_model_check', 'answer']
    case 'held':
      return ['held_submitted', 'held_approved', 'held_rejected']
    case 'undos':
      return ['fix_undo', 'answer_withdrawn']
    default:
      return undefined
  }
}

export type Question =
  | { kind: 'fix'; id: string; label: string }
  | { kind: 'task'; id: string; label: string }
  | { kind: 'all' }

export function questionOptions(
  fixes: { id: string; title: string }[],
  tasks: { id: string; question: string }[],
): Question[] {
  return [
    ...fixes.map((f): Question => ({ kind: 'fix', id: f.id, label: f.title })),
    ...tasks.map((t): Question => ({ kind: 'task', id: t.id, label: t.question })),
    { kind: 'all' },
  ]
}

export function questionParams(q: Question): { fixId?: string; taskId?: string } {
  if (q.kind === 'fix') return { fixId: q.id }
  if (q.kind === 'task') return { taskId: q.id }
  return {}
}

export function questionKey(q: Question): string {
  return q.kind === 'all' ? 'all' : `${q.kind}:${q.id}`
}

export function parseQuestionKey(key: string, options: Question[]): Question {
  return options.find((o) => questionKey(o) === key) ?? { kind: 'all' }
}
