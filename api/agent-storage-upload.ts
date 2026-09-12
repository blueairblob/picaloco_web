/**
 * POST /api/agent-storage-upload -- relays a single image upload to oci's Storage on
 * picaloco_agent's behalf, so the agent never holds the service_role key at all.
 *
 * This is the bigger risk than the DB password (see api/agent-auth.ts): Supabase's service_role
 * key bypasses RLS across the ENTIRE database and Storage, not just images, and there's no
 * narrower "Storage-only" credential available. Instead of baking it into the agent the way the DB
 * password used to be, the agent sends its registration key + the image bytes here, and only this
 * function -- server-side, in Vercel's own env var store -- ever touches service_role.
 *
 * This is opt-in on the agent side (vendor/scripts/upload_images_oci.py's existing direct-
 * service_role path is UNCHANGED and still the default): filemaker_sync's own trusted, admin-run
 * use (disaster recovery, a full 141k-image migration) has no reason to pay Vercel's per-request
 * overhead for something that's already running on a machine with legitimate direct access. Only
 * picaloco_agent (an untrusted, remotely-distributed install) routes through this relay, via a new
 * --registration-key flag.
 *
 * Body: { key: string, image_no: string, data: string (base64-encoded .webp bytes) }
 * Response: { ok: true } on success; { ok: false, storage_invalid_key: true } for the known,
 * permanent InvalidKey rejection (see upload_images_oci.py's InvalidKeyError -- classified here too,
 * the same way, so the agent's own "known issue, not a real failure" handling keeps working
 * unchanged whether it's talking to Storage directly or through this relay); a 4xx/5xx JSON error
 * body for anything else.
 */
import { createAdminClient, isValidAgentKey } from '../lib/agentAuth.js'

interface MinimalVercelRequest {
  method?: string
  body?: unknown
}
interface MinimalVercelResponse {
  status(code: number): { json(body: unknown): void }
}

// Matches config.toml's [storage].bucket everywhere else in this project (sync_runner.py's
// generated config, filemaker_sync's own config.toml) -- not worth deriving from an env var for a
// value this stable and already public (it's part of VITE_IMAGES_BASE_URL).
const BUCKET = 'picaloco'
// Generous headroom over a real webp (~13KB full-size per filemaker_sync/devlog/worksheet.md) --
// just a sanity cap, not a tight limit.
const MAX_IMAGE_BYTES = 2 * 1024 * 1024

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

  const body = req.body as { key?: unknown; image_no?: unknown; data?: unknown } | undefined
  const key = typeof body?.key === 'string' ? body.key.trim() : ''
  const imageNo = typeof body?.image_no === 'string' ? body.image_no : ''
  const dataB64 = typeof body?.data === 'string' ? body.data : ''
  if (!key || !imageNo || !dataB64) {
    res.status(400).json({ error: 'Missing key, image_no, or data' })
    return
  }

  if (!(await isValidAgentKey(admin, key))) {
    res.status(403).json({ error: 'Invalid or revoked key' })
    return
  }

  let bytes: Buffer
  try {
    bytes = Buffer.from(dataB64, 'base64')
  } catch {
    res.status(400).json({ error: 'Invalid base64 data' })
    return
  }
  if (bytes.length === 0 || bytes.length > MAX_IMAGE_BYTES) {
    res.status(413).json({ error: 'Image missing or too large' })
    return
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string
  const storageUrl = `${process.env.VITE_SUPABASE_URL}/storage/v1/object/${BUCKET}/images/${encodeURIComponent(imageNo)}.webp`

  const uploadRes = await fetch(storageUrl, {
    method: 'POST',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'image/webp',
      'x-upsert': 'true',
    },
    body: bytes,
  })

  if (uploadRes.status === 400) {
    const text = await uploadRes.text()
    if (text.includes('InvalidKey')) {
      // Known, permanent, un-fixable-here -- see upload_images_oci.py's InvalidKeyError docstring
      // (devlog/worksheet.md Session 16). A 200 with ok:false, not a 4xx/5xx -- this isn't an error
      // in the relay or the request, it's an expected Storage-side rejection the caller already
      // knows how to classify separately from a real failure.
      res.status(200).json({ ok: false, storage_invalid_key: true })
      return
    }
  }

  if (!uploadRes.ok) {
    const text = await uploadRes.text().catch(() => '')
    console.error('Storage upload failed:', uploadRes.status, text)
    res.status(502).json({ error: `Storage upload failed (${uploadRes.status})` })
    return
  }

  res.status(200).json({ ok: true })
}
