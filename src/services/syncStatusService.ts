import { supabase } from '@/lib/supabase/client'
import type { SyncStatusRow } from '@/types/sync'

const TABLE = 'sync_status'

export async function getRecentSyncStatus(limit = 20): Promise<SyncStatusRow[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .order('run_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return (data ?? []) as SyncStatusRow[]
}
