/**
 * POST /api/agent-auth -- picaloco_agent's activation gate (DB password half).
 *
 * Not a Supabase Edge Function: oci's supabase-edge-functions container has never actually had a
 * function deployed to it (crash-looping since setup, see filemaker_sync/devlog/worksheet.md) and
 * reviving it means live SSH work on infrastructure this session can't reach. Vercel already has a
 * proven deploy path for this repo, so the gate lives here instead -- same security property (the
 * real secret never reaches the client), different host.
 *
 * picaloco_agent ships with no DB password baked in. On first run it prompts for a registration key
 * and POSTs it here. This checks the key against rat.agent_licenses (server-side only, via the
 * service_role key -- never sent to the client) and, if valid and not revoked, returns the real
 * picaloco_agent Postgres password. Revoking a key (UPDATE ... SET revoked = true) cuts off that
 * install immediately, no new agent release needed.
 *
 * See lib/agentAuth.ts for the shared key-validation logic (also used by the Storage relay,
 * api/agent-storage-*.ts) and its own docstring for why rat.agent_licenses lives in `rat`, not the
 * conceptually tidier `rat_migration`.
 *
 * Requires two Vercel env vars (Project Settings -> Environment Variables, NOT the VITE_-prefixed
 * ones the client bundle uses -- these must stay server-only):
 *   SUPABASE_SERVICE_ROLE_KEY  -- oci's service_role key (lib/agentAuth.ts; also used by the Storage relay)
 *   AGENT_DB_PASSWORD          -- the picaloco_agent Postgres role's real password
 * VITE_SUPABASE_URL is reused as-is for the base URL -- it's already public, not a secret.
 */
import { createAdminClient, isValidAgentKey } from '../lib/agentAuth.js'

// Minimal local shape for what this function actually uses, rather than pulling in the full
// @vercel/node package for two interfaces -- that package's devtooling brought a transitive
// dependency tree with several known CVEs (ajv/path-to-regexp/undici), none of which are relevant
// here since Vercel compiles/runs the deployed function independently of this dev-only type dep.
interface MinimalVercelRequest {
  method?: string
  body?: unknown
}
interface MinimalVercelResponse {
  status(code: number): { json(body: unknown): void }
}

export default async function handler(req: MinimalVercelRequest, res: MinimalVercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const agentPassword = process.env.AGENT_DB_PASSWORD
  if (!agentPassword) {
    res.status(500).json({ error: 'Server not configured' })
    return
  }

  let admin
  try {
    admin = createAdminClient()
  } catch (e) {
    res.status(500).json({ error: String(e) })
    return
  }

  // Vercel's Node runtime auto-parses a JSON request body, but its shape is unknown until checked.
  const body = req.body as { key?: unknown } | undefined
  const key = typeof body?.key === 'string' ? body.key.trim() : ''
  if (!key) {
    res.status(400).json({ error: 'Missing key' })
    return
  }

  if (!(await isValidAgentKey(admin, key))) {
    res.status(403).json({ error: 'Invalid or revoked key' })
    return
  }

  res.status(200).json({ password: agentPassword })
}
