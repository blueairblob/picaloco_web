import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY — copy .env.example to .env.local and fill them in.',
  )
}

// Not typed against ./types.ts's Database generic: postgrest-js's generic constraints expect a
// fuller shape (Insert/Update/Relationships) than this hand-authored, read-only-view type provides.
// Domain types (src/types/catalog.ts) are applied explicitly at each service function's boundary
// instead — see services/*.ts.
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  db: { schema: 'rat' },
  auth: { persistSession: false },
  realtime: { params: { eventsPerSecond: 0 } },
})
