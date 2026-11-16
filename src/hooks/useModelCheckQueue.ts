import { useCallback, useMemo, useState } from 'react'
import { useInfiniteQuery } from '@tanstack/react-query'
import { serializeCheckParams, type CheckParams } from '@/lib/modelCheckParams'
import { getCheckQueuePage, type CheckRecord } from '@/services/modelCheckService'

export const CHECK_PAGE_SIZE = 25

export interface CheckEntry extends CheckRecord {
  // Checked in this session: stays in the list so Back can revisit it and save a correction.
  done: boolean
  // Who saved the answer on this visit (the signed-in admin's email).
  checked_by: string | null
}

export type CheckPatch = Partial<Omit<CheckEntry, 'image_no'>>

// Loads a task's check queue 25 at a time (keyset on sort_key) and overlays local save results, so
// checked photos keep their place instead of dropping out of the server's list.
export function useModelCheckQueue(taskId: string, params: CheckParams) {
  const query = useInfiniteQuery({
    queryKey: ['model-check-queue', taskId, serializeCheckParams(params).toString()],
    queryFn: ({ pageParam }) => getCheckQueuePage(taskId, params, pageParam, CHECK_PAGE_SIZE),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => (last.length < CHECK_PAGE_SIZE ? undefined : last[last.length - 1].sort_key),
    // A refetch would drop checked photos from the list and shift everyone's position.
    staleTime: Infinity,
    gcTime: 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })

  const [patches, setPatches] = useState<Record<string, CheckPatch>>({})

  const records = useMemo<CheckEntry[]>(
    () =>
      (query.data?.pages.flat() ?? []).map((r) => ({ ...r, done: false, checked_by: null, ...patches[r.image_no] })),
    [query.data, patches],
  )

  const patch = useCallback((imageNo: string, p: CheckPatch) => {
    setPatches((prev) => ({ ...prev, [imageNo]: { ...prev[imageNo], ...p } }))
  }, [])

  return {
    records,
    patch,
    isPending: query.isPending,
    isError: query.isError,
    isLoadingError: query.isLoadingError,
    error: query.error,
    refetch: query.refetch,
    hasNextPage: query.hasNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
    isFetchNextPageError: query.isFetchNextPageError,
    fetchNextPage: query.fetchNextPage,
  }
}
