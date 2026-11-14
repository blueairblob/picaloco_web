import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY — copy .env.example to .env.local and fill them in.',
  )
}

// Separate from the public client (which never persists a session): this one signs admins in.
export const adminSupabase = createClient(supabaseUrl, supabaseAnonKey, {
  db: { schema: 'rat' },
  auth: { persistSession: true, autoRefreshToken: true, storageKey: 'picaloco-admin-auth' },
})
