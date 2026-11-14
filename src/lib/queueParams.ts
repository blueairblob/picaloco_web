import { CONFIDENCE_ORDER, type FixConfidence, type FixStatus } from '@/services/dataFixService'

export const FIX_STATUSES: FixStatus[] = ['extracted', 'verified', 'corrected', 'none_visible', 'no_loco']

export interface QueueParams {
  confidence: FixConfidence[]
  status: FixStatus[]
  includeRecheck: boolean
  collection: string | null
  text: string | null
}

export const DEFAULT_QUEUE_PARAMS: QueueParams = {
  confidence: [],
  status: ['extracted'],
  includeRecheck: true,
  collection: null,
  text: null,
}

function parseList<T extends string>(raw: string, allowed: readonly T[]): T[] {
  const out: T[] = []
  for (const part of raw.split(',')) {
    const v = part.trim() as T
    if (allowed.includes(v) && !out.includes(v)) out.push(v)
  }
  return out
}

function textOrNull(raw: string | null): string | null {
  const t = raw?.trim()
  return t ? t : null
}

// An absent `status` key means the default (open records); `status=` (empty) means no statuses,
// so only needs-recheck rows come back when recheck is on.
export function parseQueueParams(sp: URLSearchParams): QueueParams {
  const status = sp.get('status')
  return {
    confidence: parseList(sp.get('confidence') ?? '', CONFIDENCE_ORDER),
    status: status === null ? [...DEFAULT_QUEUE_PARAMS.status] : parseList(status, FIX_STATUSES),
    includeRecheck: sp.get('recheck') !== '0',
    collection: textOrNull(sp.get('collection')),
    text: textOrNull(sp.get('q')),
  }
}

export function serializeQueueParams(p: QueueParams): URLSearchParams {
  const sp = new URLSearchParams()
  if (p.confidence.length > 0) sp.set('confidence', p.confidence.join(','))
  const isDefaultStatus = p.status.length === 1 && p.status[0] === 'extracted'
  if (!isDefaultStatus) sp.set('status', p.status.join(','))
  if (!p.includeRecheck) sp.set('recheck', '0')
  if (p.collection) sp.set('collection', p.collection)
  if (p.text) sp.set('q', p.text)
  return sp
}
