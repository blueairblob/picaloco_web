import { useCallback, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getCompanionValues, type CompanionValue } from '@/services/dataFixService'

const keyFor = (imageNo: string | undefined, fixIds: string[]) =>
  ['data-fix-companions', imageNo, fixIds.join(',')] as const

// The other fixes' rows for the photo on screen, fetched once and cached; the next few photos are
// prefetched so the card never waits.
export function useCompanions(imageNo: string | undefined, fixIds: string[], upcoming: string[]) {
  const client = useQueryClient()
  const idsKey = fixIds.join(',')
  const query = useQuery({
    queryKey: keyFor(imageNo, fixIds),
    queryFn: () => getCompanionValues(imageNo as string, fixIds),
    enabled: !!imageNo && fixIds.length > 0,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })

  const upcomingKey = upcoming.join('\n')
  useEffect(() => {
    if (fixIds.length === 0) return
    for (const next of upcomingKey ? upcomingKey.split('\n') : []) {
      void client.prefetchQuery({
        queryKey: keyFor(next, fixIds),
        queryFn: () => getCompanionValues(next, fixIds),
        staleTime: Infinity,
      })
    }
    // fixIds is represented by idsKey
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, upcomingKey, idsKey])

  const setRow = useCallback(
    (fixId: string, patch: Partial<CompanionValue>) => {
      client.setQueryData<CompanionValue[]>(keyFor(imageNo, fixIds), (old) =>
        old?.map((r) => (r.fix_id === fixId ? { ...r, ...patch } : r)),
      )
    },
    // fixIds is represented by idsKey
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [client, imageNo, idsKey],
  )

  return {
    rows: query.data,
    isError: query.isError,
    refetch: () => void query.refetch(),
    setRow,
  }
}
