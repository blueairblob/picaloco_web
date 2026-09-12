/**
 * POST /api/agent-storage-list -- relays one page of a Storage bucket listing on picaloco_agent's
 * behalf, so the agent never holds the service_role key. See api/agent-storage-upload.ts's own
 * docstring for the full reasoning (this endpoint exists for the same reason, opt-in the same way).
 *
 * Mirrors upload_images_oci.py's own _list_page_curl()/list_dest_objects() exactly -- one page per
 * call (prefix/limit/offset), same request shape Storage's own object/list endpoint expects, so the
 * relay is a thin passthrough rather than reimplementing the pagination logic here too.
 *
 * Body: { key: string, prefix?: string, limit?: number, offset?: number }
 * Response: { items: [{ name: string, ... }] } -- the raw Storage list-page response, passed through.
 */
import { createAdminClient, isValidAgentKey } from '../lib/agentAuth.js'

interface MinimalVercelRequest {
  method?: string
  body?: unknown
}
interface MinimalVercelResponse {
  status(code: number): { json(body: unknown): void }
}

const BUCKET = 'picaloco'  // see api/agent-storage-upload.ts's own comment on this constant
const DEFAULT_LIMIT = 1500 // oci Storage's own real per-request cap (see upload_images_oci.py)

export default async function handler(req: MinimalVercelRequest, res: MinimalVercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  let admin
  try {
    admin = createAdminClient()
  } catch (e) {
    res.status(500).json({ error: String(e) })
    return
  }

  const body = req.body as
    | { key?: unknown; prefix?: unknown; limit?: unknown; offset?: unknown }
    | undefined
  const key = typeof body?.key === 'string' ? body.key.trim() : ''
  const prefix = typeof body?.prefix === 'string' ? body.prefix : 'images/'
  const limit = typeof body?.limit === 'number' ? body.limit : DEFAULT_LIMIT
  const offset = typeof body?.offset === 'number' ? body.offset : 0
  if (!key) {
    res.status(400).json({ error: 'Missing key' })
    return
  }

  if (!(await isValidAgentKey(admin, key))) {
    res.status(403).json({ error: 'Invalid or revoked key' })
    return
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string
  const listRes = await fetch(`${process.env.VITE_SUPABASE_URL}/storage/v1/object/list/${BUCKET}`, {
    method: 'POST',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ prefix, limit, offset }),
  })

  if (!listRes.ok) {
    const text = await listRes.text().catch(() => '')
    console.error('Storage list failed:', listRes.status, text)
    res.status(502).json({ error: `Storage list failed (${listRes.status})` })
    return
  }

  const items = await listRes.json()
  res.status(200).json({ items })
}
