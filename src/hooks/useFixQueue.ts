import { useCallback, useMemo, useState } from 'react'
import { useInfiniteQuery } from '@tanstack/react-query'
import { serializeQueueParams, type QueueParams } from '@/lib/queueParams'
import { getQueuePage, type QueueRecord } from '@/services/dataFixService'

export const QUEUE_PAGE_SIZE = 25

export interface QueueEntry extends QueueRecord {
  // Reviewed in this session: stays in the list so Back can revisit and re-review it.
  done: boolean
}

export type QueuePatch = Partial<Omit<QueueEntry, 'image_no'>>

// Loads a fix's queue 25 at a time (keyset on image_no) and overlays local review results, so
// reviewed records keep their place instead of dropping out of the server's filtered list.
export function useFixQueue(fixId: string, params: QueueParams) {
  const query = useInfiniteQuery({
    queryKey: ['data-fix-queue', fixId, serializeQueueParams(params).toString()],
    queryFn: ({ pageParam }) => getQueuePage(fixId, params, pageParam, QUEUE_PAGE_SIZE),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => (last.length < QUEUE_PAGE_SIZE ? undefined : last[last.length - 1].image_no),
    // A refetch would drop reviewed records from the list and shift everyone's position.
    staleTime: Infinity,
    gcTime: 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })

  const [patches, setPatches] = useState<Record<string, QueuePatch>>({})

  const records = useMemo<QueueEntry[]>(
    () => (query.data?.pages.flat() ?? []).map((r) => ({ ...r, done: false, ...patches[r.image_no] })),
    [query.data, patches],
  )

  const patch = useCallback((imageNo: string, p: QueuePatch) => {
    setPatches((prev) => ({ ...prev, [imageNo]: { ...prev[imageNo], ...p } }))
  }, [])

  return {
    records,
    patch,
    isPending: query.isPending,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    hasNextPage: query.hasNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
    isFetchNextPageError: query.isFetchNextPageError,
    fetchNextPage: query.fetchNextPage,
  }
}
