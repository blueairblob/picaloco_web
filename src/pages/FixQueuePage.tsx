import { useCallback, useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { QueueFilters } from '@/components/admin/fixes/QueueFilters'
import { ReviewCard, type CardAction, type CardNotice } from '@/components/admin/fixes/ReviewCard'
import { useFixQueue } from '@/hooks/useFixQueue'
import { parseQueueParams, serializeQueueParams, type QueueParams } from '@/lib/queueParams'
import { draftKey, reviewDrafts } from '@/lib/reviewDrafts'
import { isTypingTarget, shortcutFor } from '@/lib/reviewKeys'
import { adminSupabase } from '@/lib/supabase/adminClient'
import {
  getFixes,
  getValue,
  normaliseValues,
  reviewValue,
  type DataFix,
  type FixStatus,
  type QueueRecord,
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

// What Confirm saves, and what the edit box starts from: the record's values, else the suggestion.
function baselineValues(r: Pick<QueueRecord, 'values' | 'suggested_values'>): string[] {
  return r.values.length > 0 ? r.values : r.suggested_values
}

function sameValues(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i])
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

const SAVE_ACTIONS: CardAction[] = ['confirm', 'notVisible', 'noLoco', 'saveEdit']

function ReviewQueue({ fix, params }: { fix: DataFix; params: QueueParams }) {
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
  const baseline = rec ? baselineValues(rec) : []
  const storedDraft = rec ? reviewDrafts.get(key) : undefined
  const draft = storedDraft ?? baseline.join('\n')
  const dirty = storedDraft !== undefined && !sameValues(normaliseValues(storedDraft), baseline)

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
    reviewDrafts.set(key, text)
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

  const save = async (status: Exclude<FixStatus, 'extracted'>, values: string[]) => {
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
        // Any typed draft stays in reviewDrafts and is shown over the reloaded values.
        try {
          const fresh = await getValue(fix.id, target.image_no)
          if (fresh) {
            patch(target.image_no, fresh)
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

  const run = (action: CardAction) => {
    if (!rec) {
      if (action === 'back') goTo(index - 1)
      return
    }
    switch (action) {
      case 'confirm':
        if (dirty) {
          setNotice({ tone: 'info', text: 'You edited the values — Ctrl+Enter saves the edit, Esc discards it.' })
        } else if (baseline.length === 0) {
          setNotice({ tone: 'info', text: 'Nothing to confirm — press E to type a value, or use N / X.' })
        } else {
          void save('verified', baseline)
        }
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
        void save(sameValues(values, baseline) ? 'verified' : 'corrected', values)
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
        void save('none_visible', [])
        return
      case 'noLoco':
        void save('no_loco', [])
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

  if (queue.isPending) return <div className={box}>Loading…</div>
  if (queue.isError) {
    return (
      <div className={box}>
        Couldn't load the queue.{' '}
        <button type="button" onClick={() => void queue.refetch()} className="text-[var(--accent)] underline">
          Try again
        </button>
      </div>
    )
  }

  if (!rec) {
    if (queue.hasNextPage || queue.isFetchingNextPage) {
      if (queue.isFetchNextPageError) {
        return (
          <div className={box}>
            Couldn't load more records.{' '}
            <button type="button" onClick={() => void fetchNextPage()} className="text-[var(--accent)] underline">
              Try again
            </button>
          </div>
        )
      }
      return <div className={box}>Loading more…</div>
    }
    return (
      <div className={`${box} flex flex-col items-center gap-4`}>
        <p className="text-[var(--foreground)]">Nothing left for this filter</p>
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
    <ReviewCard
      key={rec.image_no}
      record={rec}
      position={`Record ${index + 1} of ${total}`}
      instructions={fix.instructions ?? ''}
      notVisibleLabel={notVisibleLabel(fix.id)}
      draft={draft}
      dirty={dirty}
      saving={saving}
      notice={notice}
      textareaRef={textareaRef}
      onDraftChange={setDraft}
      onAction={run}
      canGoBack={index > 0}
    />
  )
}

export function FixQueuePage() {
  const { fixId = '' } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const params = useMemo(() => parseQueueParams(searchParams), [searchParams])
  const queueKey = `${fixId}?${serializeQueueParams(params).toString()}`
  const fixes = useQuery({ queryKey: ['data-fixes'], queryFn: getFixes })
  const fix = fixes.data?.find((f) => f.id === fixId)

  const changeParams = (p: QueueParams) => {
    setSearchParams(serializeQueueParams(p), { replace: true })
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--foreground)]">
          {fix?.title ?? 'Data fix review'}
        </h1>
        <Link to="/admin/fixes" className="mt-1 inline-block text-sm text-[var(--accent)]">
          ← Data fixes
        </Link>
      </div>

      <QueueFilters key={`${params.collection ?? ''}\u0000${params.text ?? ''}`} params={params} onChange={changeParams} />

      {fixes.isError && <div className={box}>Something went wrong talking to the archive. Please try again.</div>}
      {fixes.isPending && <div className={box}>Loading…</div>}
      {fixes.isSuccess && !fix && <div className={box}>There is no data fix called “{fixId}”.</div>}
      {fix && <ReviewQueue key={queueKey} fix={fix} params={params} />}
    </div>
  )
}
