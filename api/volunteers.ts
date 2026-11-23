/**
 * POST /api/volunteers -- create or reset volunteer accounts, or set the caller's own password.
 * Needs the caller's access token (Authorization: Bearer). Logic and tests: lib/volunteers.ts.
 * This is the only place SUPABASE_SERVICE_ROLE_KEY is read.
 */
import { handleVolunteers } from '../lib/volunteers.js'

interface MinimalVercelRequest {
  method?: string
  body?: unknown
  headers: Record<string, string | string[] | undefined>
}
interface MinimalVercelResponse {
  setHeader(name: string, value: string): void
  status(code: number): { json(body: unknown): void; end(): void }
}

export default async function handler(req: MinimalVercelRequest, res: MinimalVercelResponse) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    res.status(405).json({ error: 'method not allowed' })
    return
  }
  // Vercel parses the JSON body lazily and throws from the getter when it is malformed.
  let body: unknown
  try {
    body = req.body
  } catch {
    res.status(400).json({ error: 'bad request' })
    return
  }
  const auth = req.headers.authorization
  const result = await handleVolunteers({
    url: process.env.VITE_SUPABASE_URL,
    anonKey: process.env.VITE_SUPABASE_ANON_KEY,
    serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    authHeader: Array.isArray(auth) ? auth[0] : auth,
    body,
  })
  res.status(result.status).json(result.body)
}
