/**
 * Shared server-side helpers for picaloco_agent's activation gate -- used by both
 * api/agent-auth.ts (DB password exchange) and api/agent-storage-*.ts (the Storage relay).
 *
 * Lives outside api/ deliberately: Vercel treats every file directly under api/ as its own route,
 * so shared code has to live elsewhere or it'd register as a broken endpoint of its own.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// The schema-scoped client's generic params don't unify with the default (schema "public")
// SupabaseClient type -- `any` here rather than fighting the generics for an internal helper only
// ever constructed by createAdminClient() below.
type AdminClient = SupabaseClient<any, any, any, any, any>

export function createAdminClient(): AdminClient {
  const url = process.env.VITE_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    throw new Error('Server not configured: missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  }
  // `rat`, not `rat_migration` -- see api/agent-auth.ts's own docstring for why the conceptually
  // tidier schema doesn't actually work on this instance (confirmed live, 2026-09-11).
  return createClient(url, serviceKey, { db: { schema: 'rat' }, auth: { persistSession: false } })
}

/** True if `key` is a real, non-revoked row in rat.agent_licenses. Best-effort bumps
 * last_used_at on success -- a failed timestamp update shouldn't block a valid key. */
export async function isValidAgentKey(admin: AdminClient, key: string): Promise<boolean> {
  const { data, error } = await admin
    .from('agent_licenses')
    .select('id, revoked')
    .eq('key', key)
    .maybeSingle()

  if (error) {
    // Same reasoning as api/agent-auth.ts: a genuine query error (bad schema/grant/connection) is
    // logged, never conflated with "key not found" -- that conflation is exactly what made this
    // project's first live debugging pass (Session 19) so hard to diagnose.
    console.error('agent_licenses lookup failed:', error)
    return false
  }
  if (!data || data.revoked) {
    return false
  }

  admin
    .from('agent_licenses')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', data.id)
    .then(({ error: updateError }) => {
      if (updateError) console.error('agent_licenses last_used_at update failed:', updateError)
    })
  return true
}
