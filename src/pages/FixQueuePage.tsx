import { useCallback, useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { BulkConfirmGrid } from '@/components/admin/fixes/BulkConfirmGrid'
import { QueueFilters } from '@/components/admin/fixes/QueueFilters'
import { ReviewCard, type CardAction, type CardNotice } from '@/components/admin/fixes/ReviewCard'
import { PhotoSizeControl } from '@/components/admin/fixes/PhotoSizeControl'
import { useFixQueue } from '@/hooks/useFixQueue'
import { usePhotoSize } from '@/hooks/usePhotoSize'
import type { PhotoSize } from '@/lib/photoSize'
import { emptyQueueMessage, parseQueueParams, serializeQueueParams, type QueueParams } from '@/lib/queueParams'
import { canUseSuggestion, decideSave, editBaseline, isReviewed, sameValues, type SaveDecision } from '@/lib/reviewDecision'
import { draftKey, isDraftOutdated, reviewDrafts } from '@/lib/reviewDrafts'
import { isTypingTarget, shortcutFor } from '@/lib/reviewKeys'
import { adminSupabase } from '@/lib/supabase/adminClient'
import {
  getFixes,
  getValue,
  isSignedOutError,
  normaliseValues,
  reviewValue,
  type DataFix,
} from '@/services/dataFixService'
import { getReviewImageUrl } from '@/services/images'

const box = 'rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-10 text-center text-[var(--muted)]'
const linkBtn =
  'rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm text-[var(--foreground)] hover:border-[var(--accent)] hover:text-[var(--accent)]'

const PREFETCH_WHEN_REMAINING = 5
const PRELOAD_IMAGES = 3

function notVisibleLabel(fixId: string): string {
  if (fixId === 'loco_name') return 'No name visible'
  if (fixId === 'loco_number') return 'No number visible'
  return 'Not visible'
}

// Checkboxes take no text, so review keys still work after clicking a filter toggle.
function keyTarget(el: HTMLElement | null) {
  if (el instanceof HTMLInputElement && (el.type === 'checkbox' || el.type === 'radio')) {
    return { tagName: 'DIV', isContentEditable: false }
  }
  return { tagName: el?.tagName ?? '', isContentEditable: el?.isContentEditable ?? false }
}

// Elements whose own Enter behaviour wins (keyboard users tabbing to a control expect it to fire).
function ownsEnter(el: HTMLElement | null): boolean {
  return !!el && ['BUTTON', 'A', 'SUMMARY'].includes(el.tagName)
}

const SAVE_ACTIONS: CardAction[] = ['confirm', 'useSuggestion', 'notVisible', 'noLoco', 'saveEdit']

function ReviewQueue({ fix, params, photoSize }: { fix: DataFix; params: QueueParams; photoSize: PhotoSize }) {
  const queue = useFixQueue(fix.id, params)
  const { records, patch } = queue
  const [index, setIndex] = useState(0)
  const [saving, setSaving] = useState(false)
  const savingRef = useRef(false)
  const [notice, setNotice] = useState<CardNotice | null>(null)
  const [, rerender] = useReducer((n: number) => n + 1, 0)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  const rec = records[index]
  const key = rec ? draftKey(fix.id, rec.image_no) : ''
  const baseline = rec ? editBaseline(rec) : []
  const storedDraft = rec ? reviewDrafts.get(key) : undefined
  const draft = storedDraft?.text ?? baseline.join('\n')
  const dirty = !!storedDraft && !sameValues(normaliseValues(storedDraft.text), baseline)
  // Typed before this record last changed (elsewhere, or before a reload): never dropped, but flagged.
  const draftOutdated = !!rec && !!storedDraft && dirty && isDraftOutdated(storedDraft, rec.updated_at)

  const { hasNextPage, isFetchingNextPage, isFetchNextPageError, fetchNextPage } = queue
  useEffect(() => {
    if (hasNextPage && !isFetchingNextPage && !isFetchNextPageError && records.length - index <= PREFETCH_WHEN_REMAINING) {
      void fetchNextPage()
    }
  }, [hasNextPage, isFetchingNextPage, isFetchNextPageError, fetchNextPage, records.length, index])

  const upcoming = records
    .slice(index + 1, index + 1 + PRELOAD_IMAGES)
    .map((r) => r.image_no)
    .join('\n')
  useEffect(() => {
    for (const imageNo of upcoming ? upcoming.split('\n') : []) {
      new Image().src = getReviewImageUrl(imageNo)
    }
  }, [upcoming])

  const setDraft = (text: string) => {
    if (!rec) return
    // Keep the original base while typing on: only an explicit save or the stale reload rebases it.
    reviewDrafts.set(key, { text, baseUpdatedAt: storedDraft ? storedDraft.baseUpdatedAt : rec.updated_at })
    rerender()
  }

  const rebaseDraft = (k: string, updatedAt: string) => {
    const d = reviewDrafts.get(k)
    if (d) reviewDrafts.set(k, { text: d.text, baseUpdatedAt: updatedAt })
    rerender()
  }

  const discardDraft = () => {
    if (!rec) return
    reviewDrafts.delete(key)
    rerender()
  }

  const goTo = (to: number) => {
    setIndex(Math.max(0, Math.min(to, records.length)))
    setNotice(null)
  }

  const signInAgain = () => {
    void adminSupabase.auth.signOut({ scope: 'local' })
  }

  // Whether the latest page-load failure means the session is gone (shown as the signed-out notice).
  // The answer is tagged with the error it was worked out for, so a cleared or newer error never
  // reuses it.
  const [signedOutCheck, setSignedOutCheck] = useState<{ error: unknown; signedOut: boolean } | null>(null)
  const loadError = queue.error
  useEffect(() => {
    if (!loadError) return
    let cancelled = false
    void isSignedOutError(loadError).then((signedOut) => {
      if (!cancelled) setSignedOutCheck({ error: loadError, signedOut })
    })
    return () => {
      cancelled = true
    }
  }, [loadError])
  const loadSignedOut = !!loadError && signedOutCheck?.error === loadError && signedOutCheck.signedOut

  const save = async ({ status, values }: SaveDecision) => {
    if (!rec || savingRef.current) return
    const target = rec
    const targetKey = key
    const at = index
    savingRef.current = true
    setSaving(true)
    setNotice(null)
    try {
      const outcome = await reviewValue({
        imageNo: target.image_no,
        fixId: fix.id,
        values,
        status,
        expectedUpdatedAt: target.updated_at,
      })
      if (outcome.ok) {
        patch(target.image_no, {
          status,
          values: status === 'none_visible' || status === 'no_loco' ? [] : values,
          needs_recheck: false,
          // The server's string, untouched: the next save (after Back) sends it straight back.
          updated_at: outcome.updated_at,
          done: true,
        })
        reviewDrafts.delete(targetKey)
        setIndex(at + 1)
        return
      }
      if (outcome.reason === 'stale') {
        // Any typed draft stays in reviewDrafts and is shown over the reloaded values; this notice
        // already tells the reviewer, so the draft is rebased onto the reloaded record.
        try {
          const fresh = await getValue(fix.id, target.image_no)
          if (fresh) {
            patch(target.image_no, fresh)
            rebaseDraft(targetKey, fresh.updated_at)
            setNotice({ tone: 'info', text: 'Someone else changed this record — reloaded' })
          } else {
            setNotice({ tone: 'error', text: 'This record no longer exists — skip it.' })
          }
        } catch {
          setNotice({
            tone: 'error',
            text: 'Someone else changed this record, and reloading it failed. Go Back and forward to retry.',
          })
        }
        return
      }
      if (outcome.reason === 'signed-out') {
        setNotice({ tone: 'error', text: 'Signed out — sign in again', onSignIn: signInAgain })
      } else if (outcome.reason === 'forbidden') {
        setNotice({ tone: 'error', text: "This account isn't allowed to review fixes." })
      } else {
        setNotice({ tone: 'error', text: `Couldn't save: ${outcome.message}. Nothing was lost — try again.` })
      }
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }

  const editedNotice = () =>
    setNotice({
      tone: 'info',
      text: 'You edited the values — Ctrl+Enter saves the edit; Esc in the box or Discard throws it away.',
    })

  const run = (action: CardAction) => {
    if (!rec) {
      if (action === 'back') goTo(index - 1)
      return
    }
    switch (action) {
      case 'confirm':
        if (dirty) {
          editedNotice()
        } else if (!isReviewed(rec) && baseline.length === 0) {
          setNotice({ tone: 'info', text: 'Nothing to confirm — press E to type a value, or use N / X.' })
        } else {
          // An open record: confirm its values (else the suggestion). A reviewed one: keep it as it is.
          void save(decideSave(rec, 'confirm'))
        }
        return
      case 'useSuggestion':
        if (!canUseSuggestion(rec)) return
        if (dirty) {
          editedNotice()
          return
        }
        void save(decideSave(rec, 'useSuggestion'))
        return
      case 'saveEdit': {
        const values = normaliseValues(draft)
        if (values.length === 0) {
          setNotice({
            tone: 'info',
            text: `The box is empty — use N (${notVisibleLabel(fix.id)}) or X (No loco in photo).`,
          })
          return
        }
        if (draftOutdated) {
          // Make the reviewer look first: this press acknowledges, the next one saves.
          rebaseDraft(key, rec.updated_at)
          setNotice({
            tone: 'info',
            text: 'This record changed after you typed your edit. Check it against the photo, then press Ctrl+Enter again to save.',
          })
          return
        }
        void save(decideSave(rec, 'edit', values))
        return
      }
      case 'edit': {
        const el = textareaRef.current
        if (el) {
          el.focus()
          el.setSelectionRange(el.value.length, el.value.length)
        }
        return
      }
      case 'cancelEdit':
        discardDraft()
        setNotice(null)
        textareaRef.current?.blur()
        return
      case 'notVisible':
        void save({ status: 'none_visible', values: [] })
        return
      case 'noLoco':
        void save({ status: 'no_loco', values: [] })
        return
      case 'skip':
        goTo(index + 1)
        return
      case 'back':
        goTo(index - 1)
        return
    }
  }

  // The window listener is attached once and always calls the latest render's handler.
  const runRef = useRef(run)
  useLayoutEffect(() => {
    runRef.current = run
  })
  const onKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.altKey || e.isComposing || e.defaultPrevented) return
    const el = e.target instanceof HTMLElement ? e.target : null
    const inEditBox = !!el && el.dataset.reviewEdit !== undefined
    const target = keyTarget(el)
    if (isTypingTarget(target) && !inEditBox) return // filter fields and other inputs keep their keys
    if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey && ownsEnter(el)) return

    let action: CardAction | null
    if (e.ctrlKey || e.metaKey) {
      action = e.key === 'Enter' ? 'saveEdit' : null
    } else {
      action = shortcutFor(e.key, target)
    }
    if (!action) return
    e.preventDefault()
    if (savingRef.current) return
    if (e.repeat && SAVE_ACTIONS.includes(action)) return // a held key must not review a run of records
    runRef.current(action)
  }, [])

  useEffect(() => {
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onKeyDown])

  const signedOutNotice = (
    <>
      Signed out — sign in again{' '}
      <button type="button" onClick={signInAgain} className="text-[var(--accent)] underline">
        Sign in again
      </button>
    </>
  )

  if (queue.isPending) return <div className={box}>Loading…</div>
  // Full-page error only when nothing loaded; refetch() is safe here because there's no review state.
  if (queue.isLoadingError) {
    return (
      <div className={box}>
        {loadSignedOut ? (
          signedOutNotice
        ) : (
          <>
            Couldn't load the queue.{' '}
            <button type="button" onClick={() => void queue.refetch()} className="text-[var(--accent)] underline">
              Try again
            </button>
          </>
        )}
      </div>
    )
  }

  // A later page failed: never refetch() (it reloads every page, dropping reviewed records and
  // shifting positions) — retry just the next page.
  const moreFailed = queue.isFetchNextPageError ? (
    loadSignedOut ? (
      signedOutNotice
    ) : (
      <>
        Couldn't load more records.{' '}
        <button type="button" onClick={() => void fetchNextPage()} className="text-[var(--accent)] underline">
          Retry
        </button>
      </>
    )
  ) : null

  if (!rec) {
    if (queue.hasNextPage || queue.isFetchingNextPage) {
      return <div className={box}>{moreFailed ?? 'Loading more…'}</div>
    }
    return (
      <div className={`${box} flex flex-col items-center gap-4`}>
        <p className="text-[var(--foreground)]">{emptyQueueMessage(params, records.length > 0)}</p>
        <div className="flex flex-wrap justify-center gap-2">
          {records.length > 0 && (
            <button type="button" onClick={() => goTo(index - 1)} className={linkBtn}>
              <kbd className="font-mono text-xs">←</kbd> Back
            </button>
          )}
          <Link to="/admin/fixes" className={`${linkBtn} no-underline`}>
            Back to data fixes
          </Link>
        </div>
      </div>
    )
  }

  const total = `${records.length}${queue.hasNextPage ? '+' : ''}`
  return (
    <>
      {moreFailed && (
        <div role="status" className="rounded-lg border border-[var(--danger)] px-3 py-2 text-sm text-[var(--danger)]">
          {moreFailed}
        </div>
      )}
      <ReviewCard
        key={rec.image_no}
        photoSize={photoSize}
        record={rec}
        position={`Record ${index + 1} of ${total}`}
        instructions={fix.instructions ?? ''}
        notVisibleLabel={notVisibleLabel(fix.id)}
        draft={draft}
        dirty={dirty}
        draftOutdated={draftOutdated}
        saving={saving}
        notice={notice}
        textareaRef={textareaRef}
        onDraftChange={setDraft}
        onAction={run}
        canGoBack={index > 0}
      />
    </>
  )
}

export function FixQueuePage() {
  const { fixId = '' } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const params = useMemo(() => parseQueueParams(searchParams), [searchParams])
  const queueKey = `${fixId}?${serializeQueueParams(params).toString()}`
  const fixes = useQuery({ queryKey: ['data-fixes'], queryFn: getFixes })
  const fix = fixes.data?.find((f) => f.id === fixId)

  const [grid, setGrid] = useState(false)
  const [photoSize, setPhotoSize] = usePhotoSize()
  const highOnly = params.confidence.length === 1 && params.confidence[0] === 'high'
  const showGrid = grid && highOnly
  if (grid && !highOnly) setGrid(false) // filter moved off high-only: forget the grid choice

  const changeParams = (p: QueueParams) => {
    setSearchParams(serializeQueueParams(p), { replace: true })
  }

  return (
    <div className="mx-auto flex w-full max-w-[100rem] flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--foreground)]">
          {fix?.title ?? 'Data fix review'}
        </h1>
        <Link to="/admin/fixes" className="mt-1 inline-block text-sm text-[var(--accent)]">
          ← Data fixes
        </Link>
      </div>

      <QueueFilters key={`${params.collection ?? ''}\u0000${params.text ?? ''}`} params={params} onChange={changeParams} />

      {fix && (
        <div className="flex flex-wrap items-center gap-4">
          {highOnly && (
            <button
              type="button"
              aria-pressed={showGrid}
              onClick={() => setGrid((g) => !g)}
              className={linkBtn}
            >
              {showGrid ? 'Single review' : 'Grid'}
            </button>
          )}
          <PhotoSizeControl value={photoSize} onChange={setPhotoSize} />
        </div>
      )}

      {fixes.isError && <div className={box}>Something went wrong talking to the archive. Please try again.</div>}
      {fixes.isPending && <div className={box}>Loading…</div>}
      {fixes.isSuccess && !fix && <div className={box}>There is no data fix called “{fixId}”.</div>}
      {fix && showGrid && <BulkConfirmGrid key={queueKey} fixId={fix.id} params={params} photoSize={photoSize} />}
      {fix && !showGrid && <ReviewQueue key={queueKey} fix={fix} params={params} photoSize={photoSize} />}
    </div>
  )
}
