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
