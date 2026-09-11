/**
 * POST /api/agent-auth -- picaloco_agent's activation gate.
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
 * WHY rat, NOT rat_migration (confirmed live, 2026-09-11): this oci instance's PostgREST only
 * exposes schemas it's been explicitly configured to serve over the REST API, and `rat` is the only
 * one that's ever needed that (mobile_catalog_view, see src/lib/supabase/client.ts) --
 * rat_migration has only ever been reached via *direct* Postgres connections (psycopg2/pyodbc) in
 * filemaker_sync/picaloco_agent, never through supabase-js/PostgREST. A real, valid key in
 * rat_migration.agent_licenses was silently unreachable this way -- every lookup failed the same
 * way a genuinely bad key would, with no error surfaced to tell them apart. Table grants are
 * per-table, not schema-wide, so being in `rat` doesn't expose this to anon -- it has no grant
 * either way, same as before.
 *
 * Requires three Vercel env vars (Project Settings -> Environment Variables, NOT the VITE_-prefixed
 * ones the client bundle uses -- these must stay server-only):
 *   SUPABASE_SERVICE_ROLE_KEY  -- oci's service_role key (also needed later for the Storage relay)
 *   AGENT_DB_PASSWORD          -- the picaloco_agent Postgres role's real password
 * VITE_SUPABASE_URL is reused as-is for the base URL -- it's already public, not a secret.
 */
import { createClient } from '@supabase/supabase-js'

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

  const url = process.env.VITE_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const agentPassword = process.env.AGENT_DB_PASSWORD
  if (!url || !serviceKey || !agentPassword) {
    res.status(500).json({ error: 'Server not configured' })
    return
  }

  // Vercel's Node runtime auto-parses a JSON request body, but its shape is unknown until checked.
  const body = req.body as { key?: unknown } | undefined
  const key = typeof body?.key === 'string' ? body.key.trim() : ''
  if (!key) {
    res.status(400).json({ error: 'Missing key' })
    return
  }

  // Own client, service_role -- deliberately NOT the shared anon client src/lib/supabase/client.ts
  // exports (that one's anon-scoped by design; this table must never be anon-readable). Same `rat`
  // schema as that shared client uses, though -- see the module docstring for why rat_migration,
  // the conceptually-tidier choice, doesn't actually work here.
  const admin = createClient(url, serviceKey, {
    db: { schema: 'rat' },
    auth: { persistSession: false },
  })

  const { data, error } = await admin
    .from('agent_licenses')
    .select('id, revoked')
    .eq('key', key)
    .maybeSingle()

  if (error) {
    // A genuine infrastructure problem (bad schema/grant/connection) -- distinct from "key not
    // found" below on purpose. Conflating these two is exactly what made the rat_migration mistake
    // above so hard to diagnose: a real, valid key and a wrong one produced the identical response.
    // TEMPORARY: surfacing the actual PostgREST error in the response itself (not just server logs)
    // while diagnosing why moving the table to `rat` didn't fix this on its own -- revert once
    // resolved, no need to expose internals in the steady state.
    console.error('agent_licenses lookup failed:', error)
    res.status(500).json({ error: 'Activation lookup failed', detail: error })
    return
  }
  if (!data || data.revoked) {
    res.status(403).json({ error: 'Invalid or revoked key' })
    return
  }

  // Best-effort -- a failed timestamp update shouldn't block a legitimately valid key.
  await admin
    .from('agent_licenses')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', data.id)
    .then(({ error: updateError }) => {
      if (updateError) console.error('agent_licenses last_used_at update failed:', updateError)
    })

  res.status(200).json({ password: agentPassword })
}
