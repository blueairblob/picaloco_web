// The site's health check: can the server answer a search? Used by GET /api/health, which the free
// uptime monitor watches (the free plan can't send the headers the server needs, so this function
// sends them instead). Answers never include the key.
export const HEALTH_PATH = '/rest/v1/mobile_catalog_view?select=image_no&limit=1'
export const HEALTH_TIMEOUT_MS = 10_000

export type HealthResult = {
  status: 200 | 503
  body: { ok: true; image_no: string } | { ok: false; reason: string }
}

type FetchFn = (url: string, init?: RequestInit) => Promise<Response>

const down = (reason: string): HealthResult => ({ status: 503, body: { ok: false, reason } })

export async function checkHealth(opts: {
  url: string | undefined
  key: string | undefined
  fetchFn?: FetchFn
  timeoutMs?: number
}): Promise<HealthResult> {
  const { url, key, fetchFn = fetch, timeoutMs = HEALTH_TIMEOUT_MS } = opts
  if (!url || !key) return down('health check not configured')

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  let res: Response
  try {
    res = await fetchFn(url.replace(/\/+$/, '') + HEALTH_PATH, {
      headers: { apikey: key, 'Accept-Profile': 'rat' },
      signal: controller.signal,
    })
  } catch {
    return down(controller.signal.aborted ? `no answer within ${timeoutMs} ms` : 'server unreachable')
  } finally {
    clearTimeout(timer)
  }

  if (!res.ok) return down(`server answered ${res.status}`)
  let rows: unknown
  try {
    rows = await res.json()
  } catch {
    return down('answer was not a search row')
  }
  if (!Array.isArray(rows)) return down('answer was not a search row')
  const first = rows[0] as { image_no?: unknown } | undefined
  if (!first) return down('no rows returned')
  if (typeof first.image_no !== 'string') return down('answer was not a search row')
  return { status: 200, body: { ok: true, image_no: first.image_no } }
}
