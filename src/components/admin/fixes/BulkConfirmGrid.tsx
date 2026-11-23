import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { emptyQueueMessage, gridQueueParams, serializeQueueParams, type QueueParams } from '@/lib/queueParams'
import {
  confirmMany,
  getQueuePage,
  isSignedOutError,
  toConfirmItems,
  type QueueRecord,
} from '@/services/dataFixService'
import { useAdminSession } from '@/hooks/useAdminSession'
import { roleChangedMessage } from '@/lib/roleChange'
import { adminSupabase } from '@/lib/supabase/adminClient'
import { getReviewImageUrl } from '@/services/images'
import { GRID_COLUMNS, TILE_LABEL, type PhotoSize } from '@/lib/photoSize'

export const GRID_SIZE = 24

const box = 'rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-10 text-center text-[var(--muted)]'
const btn =
  'rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm text-[var(--foreground)] hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-50'

const overlayBg = { background: 'color-mix(in srgb, var(--surface) 85%, transparent)' }

interface Props {
  fixId: string
  params: QueueParams
  photoSize: PhotoSize
}

export function BulkConfirmGrid({ fixId, params, photoSize }: Props) {
  const queryClient = useQueryClient()
  const { status: sessionStatus, inTraining, refreshRole } = useAdminSession()
  const trainee = sessionStatus === 'volunteer' && inTraining
  const [after, setAfter] = useState<string | null>(null)
  const [unticked, setUnticked] = useState<ReadonlySet<string>>(new Set())
  const [confirming, setConfirming] = useState(false)
  const [result, setResult] = useState<{ done: number; of: number } | null>(null)
  // roleChanged: the notice to show when the save was refused because the role changed.
  const [error, setError] = useState<{ message: string; signedOut: boolean; roleChanged: string | null } | null>(null)

  // Only open records: a ticked tile is always one that Confirm will actually confirm.
  const gridParams = useMemo(() => gridQueueParams(params), [params])
  const paramsString = serializeQueueParams(gridParams).toString()
  const page = useQuery({
    queryKey: ['data-fix-grid', fixId, paramsString, after],
    queryFn: () => getQueuePage(fixId, gridParams, after, GRID_SIZE),
    staleTime: Infinity,
    gcTime: 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })
  const records: QueueRecord[] = useMemo(() => page.data ?? [], [page.data])
  const items = useMemo(() => toConfirmItems(records, unticked), [records, unticked])

  const toggle = (imageNo: string) => {
    if (confirming || result) return
    setUnticked((prev) => {
      const next = new Set(prev)
      if (!next.delete(imageNo)) next.add(imageNo)
      return next
    })
  }

  const confirm = async () => {
    // The role picks the save RPC (trainee or not): never save before it is known.
    if (confirming || items.length === 0 || sessionStatus === 'loading') return
    setConfirming(true)
    setError(null)
    try {
      const done = await confirmMany(fixId, items, { trainee })
      setResult({ done, of: items.length })
      void queryClient.removeQueries({ queryKey: ['data-fix-queue', fixId] })
      void queryClient.invalidateQueries({ queryKey: ['data-fix-progress'] })
      if (trainee) void queryClient.invalidateQueries({ queryKey: ['my-held'] })
    } catch (e) {
      const message = e instanceof Error ? e.message : (e as { message?: string })?.message ?? 'Unknown error'
      const forbidden = (e as { code?: string } | null)?.code === '42501'
      const roleChanged = roleChangedMessage(forbidden, message, trainee)
      if (roleChanged) refreshRole()
      setError({ message, signedOut: await isSignedOutError(e), roleChanged })
    } finally {
      setConfirming(false)
    }
  }

  const next = () => {
    const last = records[records.length - 1]
    if (!last) return
    setAfter(last.image_no)
    setUnticked(new Set())
    setResult(null)
    setError(null)
  }

  if (page.isPending) return <div className={box}>Loading…</div>
  if (page.isError) {
    return (
      <div className={box}>
        Couldn't load the grid.{' '}
        <button type="button" onClick={() => void page.refetch()} className="text-[var(--accent)] underline">
          Try again
        </button>
      </div>
    )
  }
  if (records.length === 0) {
    return (
      <div className={`${box} flex flex-col items-center gap-4`}>
        <p className="text-[var(--foreground)]">{emptyQueueMessage(params, after !== null)}</p>
        <Link to="/admin/fixes" className={`${btn} no-underline`}>
          Back to data fixes
        </Link>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => void confirm()} disabled={confirming || items.length === 0 || !!result || sessionStatus === 'loading'} className={btn}>
          {confirming ? 'Confirming…' : `Confirm ${items.length}`}
        </button>
        {result && (
          <span role="status" className="text-sm text-[var(--foreground)]">
            {trainee ? 'Sent for approval' : 'Confirmed'} {result.done} of {result.of}
            {result.done < result.of && ' — the rest changed meanwhile and stay in the queue'}
          </span>
        )}
        <button type="button" onClick={next} disabled={confirming} className={btn}>
          Next {GRID_SIZE}
        </button>
        {!result && <span className="text-sm text-[var(--muted)]">Click a photo to untick it; unticked ones stay for single review.</span>}
      </div>
      {error && (
        <div role="alert" className="rounded-lg border border-[var(--danger)] px-3 py-2 text-sm text-[var(--danger)]">
          {error.signedOut ? (
            <>
              Signed out — sign in again{' '}
              <button
                type="button"
                className="underline"
                onClick={() => void adminSupabase.auth.signOut({ scope: 'local' })}
              >
                Sign in again
              </button>
            </>
          ) : error.roleChanged ? (
            <>{error.roleChanged}</>
          ) : (
            <>Couldn't confirm: {error.message}. Your ticks are kept — try again.</>
          )}
        </div>
      )}
      <ul className={`grid gap-3 ${GRID_COLUMNS[photoSize]}`}>
        {records.map((r) => {
          const ticked = !unticked.has(r.image_no)
          return (
            <li key={r.image_no}>
              <button
                type="button"
                aria-pressed={ticked}
                onClick={() => toggle(r.image_no)}
                className={`relative block w-full overflow-hidden rounded-xl border-2 bg-[var(--surface)] text-left ${
                  ticked ? 'border-[var(--accent)]' : 'border-[var(--border)] opacity-40'
                }`}
              >
                <img
                  src={getReviewImageUrl(r.image_no)}
                  alt={r.image_no}
                  loading="lazy"
                  className="aspect-[4/3] w-full object-cover"
                />
                <span className={`absolute inset-x-0 top-0 px-2 py-1 ${TILE_LABEL[photoSize]} font-semibold text-[var(--foreground)]`} style={overlayBg}>
                  {r.suggested_values.join('; ')}
                </span>
                <span className="absolute inset-x-0 bottom-0 flex justify-between px-2 py-0.5 text-xs text-[var(--muted)]" style={overlayBg}>
                  <span>{r.image_no}</span>
                  <span aria-hidden>{ticked ? '✓' : '✕'}</span>
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
