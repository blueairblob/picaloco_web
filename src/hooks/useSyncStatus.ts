import { useQuery } from '@tanstack/react-query'
import { getRecentSyncStatus } from '@/services/syncStatusService'

export const SYNC_STATUS_LIMIT = 20

export function useSyncStatus() {
  return useQuery({
    queryKey: ['sync-status', SYNC_STATUS_LIMIT],
    queryFn: () => getRecentSyncStatus(SYNC_STATUS_LIMIT),
    // This page is an operator glance-check, not a live dashboard — no need for the default
    // 30s staleTime's background refetch cadence to feel urgent, but a manual refocus should
    // still pick up a sync that just landed.
    refetchOnWindowFocus: true,
  })
}
