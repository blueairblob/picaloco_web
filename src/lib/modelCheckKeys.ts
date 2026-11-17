import { isTypingTarget } from '@/lib/reviewKeys'
import type { ModelAnswerDef } from '@/services/modelCheckService'

export type CheckAction =
  | { type: 'pick'; answerId: string }
  | { type: 'save' }
  | { type: 'skip' }
  | { type: 'back' }

export function checkShortcut(
  key: string,
  target: { tagName: string; isContentEditable: boolean },
  answers: ModelAnswerDef[],
): CheckAction | null {
  if (isTypingTarget(target)) return null
  if (/^[0-9]$/.test(key)) {
    const a = answers.find((x) => x.key === key)
    return a ? { type: 'pick', answerId: a.id } : null
  }
  switch (key.toLowerCase()) {
    case 'enter':
      return { type: 'save' }
    case 's':
    case 'arrowright':
      return { type: 'skip' }
    case 'arrowleft':
      return { type: 'back' }
    default:
      return null
  }
}

// Keys help: one row per answer, with the task's optional per-answer guidance (answers[].hint).
export function answerHelpRows(answers: ModelAnswerDef[]): { key: string; text: string; hint: string | null }[] {
  return answers.map((a) => ({
    key: a.key,
    text: `Pick ${a.label}`,
    hint: typeof a.hint === 'string' && a.hint.trim() ? a.hint.trim() : null,
  }))
}
