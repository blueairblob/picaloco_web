export type CheckMode = 'sure' | 'unsure' | 'sample'

export interface CheckParams {
  run: number | null
  mode: CheckMode
  answer: string | null
  collection: string | null
}

const MODES: CheckMode[] = ['sure', 'unsure', 'sample']

function textOrNull(raw: string | null): string | null {
  const t = raw?.trim()
  return t ? t : null
}

export function parseCheckParams(sp: URLSearchParams): CheckParams {
  const rawMode = sp.get('mode') as CheckMode | null
  const mode: CheckMode = rawMode && MODES.includes(rawMode) ? rawMode : 'sure'
  const runRaw = sp.get('run')
  const run = runRaw && /^\d+$/.test(runRaw) ? Number(runRaw) : null
  // Sample mode takes no filters: filters would bias the blind sample.
  const blind = mode === 'sample'
  return {
    run,
    mode,
    answer: blind ? null : textOrNull(sp.get('answer')),
    collection: blind ? null : textOrNull(sp.get('collection')),
  }
}

export function serializeCheckParams(p: CheckParams): URLSearchParams {
  const sp = new URLSearchParams()
  if (p.run !== null) sp.set('run', String(p.run))
  if (p.mode !== 'sure') sp.set('mode', p.mode)
  if (p.mode !== 'sample') {
    if (p.answer) sp.set('answer', p.answer)
    if (p.collection) sp.set('collection', p.collection)
  }
  return sp
}

export function formatAccuracy(correct: number, n: number): string {
  if (n === 0) return 'No blind answers yet'
  return `${Math.round((correct / n) * 100)}% (${correct} of ${n})`
}
