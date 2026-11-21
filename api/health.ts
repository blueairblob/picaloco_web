/**
 * GET /api/health -- can the server answer a search? 200 {"ok":true,...} or 503 {"ok":false,reason}.
 * Watched by the uptime monitor (docs/ops-manual/uptime-monitors.md, monitor 2). Uses only the URL
 * and anon key the site already ships; no secret is involved. Logic and tests: lib/health.ts.
 */
import { checkHealth } from '../lib/health.js'

interface MinimalVercelRequest {
  method?: string
}
interface MinimalVercelResponse {
  setHeader(name: string, value: string): void
  status(code: number): { json(body: unknown): void; end(): void }
}

export default async function handler(req: MinimalVercelRequest, res: MinimalVercelResponse) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD')
    res.status(405).json({ ok: false, reason: 'method not allowed' })
    return
  }
  const result = await checkHealth({ url: process.env.VITE_SUPABASE_URL, key: process.env.VITE_SUPABASE_ANON_KEY })
  if (req.method === 'HEAD') res.status(result.status).end()
  else res.status(result.status).json(result.body)
}
