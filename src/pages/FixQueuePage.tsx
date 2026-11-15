import { useCallback, useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { BulkConfirmGrid } from '@/components/admin/fixes/BulkConfirmGrid'
import { QueueFilters } from '@/components/admin/fixes/QueueFilters'
import { ReviewCard, type CardAction, type CardNotice, type CompanionView } from '@/components/admin/fixes/ReviewCard'
import { PhotoSizeControl } from '@/components/admin/fixes/PhotoSizeControl'
import { ReviewHelp } from '@/components/admin/fixes/ReviewHelp'
import { useCompanions } from '@/hooks/useCompanions'
import { useFixQueue, type QueueEntry } from '@/hooks/useFixQueue'
import { usePhotoSize } from '@/hooks/usePhotoSize'
import type { PhotoSize } from '@/lib/photoSize'
import { emptyQueueMessage, parseQueueParams, serializeQueueParams, type QueueParams } from '@/lib/queueParams'
import {
  NO_TOGGLES,
  clearMarks,
  companionTarget,
  fieldMark,
  mainDecision,
  mainTouched,
  noLocoOn,
  toggleNoLoco,
  toggleNotVisible,
  type CardToggles,
  type FieldState,
} from '@/lib/cardAnswer'
import { carriedCompanions, companionBlockMessage, isCompanionDirty } from '@/lib/companionSave'
import { canUseSuggestion, editBaseline, sameValues, type SaveDecision } from '@/lib/reviewDecision'
import { draftKey, isDraftOutdated, reviewDrafts } from '@/lib/reviewDrafts'
import { ctrlEnterAction, isTypingTarget, shortcutFor } from '@/lib/reviewKeys'
import { adminSupabase } from '@/lib/supabase/adminClient'
import {
  getFixes,
  getValue,
  isSignedOutError,
  normaliseValues,
  reviewValue,
  type DataFix,
  type FixStatus,
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

// A held key must not save a run of records, or flicker a toggle on and off.
const NO_REPEAT: CardAction[] = ['confirm', 'useSuggestion', 'notVisible', 'noLoco']

function ReviewQueue({
  fix,
  params,
  photoSize,
  companionFixes,
}: {
  fix: DataFix
  params: QueueParams
  photoSize: PhotoSize
  companionFixes: DataFix[]
}) {
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

  // No loco / Not visible selections on this card visit. Nothing is saved until Save & next, and
  // moving to another photo forgets them (the photo then shows its saved answer again).
  const [toggleState, setToggleState] = useState<{ imageNo: string; t: CardToggles }>({ imageNo: '', t: NO_TOGGLES })
  const toggles = rec && toggleState.imageNo === rec.image_no ? toggleState.t : NO_TOGGLES
  const setToggles = (t: CardToggles) => {
    if (rec) setToggleState({ imageNo: rec.image_no, t })
  }
  const mainField: FieldState = { fixId: fix.id, status: rec?.status ?? 'extracted', dirty }
  const mainMark = fieldMark(mainField, toggles)
  const noLoco = noLocoOn(mainField, toggles)

  const companionIds = companionFixes.map((f) => f.id)
  const upcoming = records
    .slice(index + 1, index + 1 + PRELOAD_IMAGES)
    .map((r) => r.image_no)
    .join('\n')
  const companionData = useCompanions(rec?.image_no, companionIds, upcoming ? upcoming.split('\n') : [])
  const companionRows = companionData.rows
  const companionsState: 'loading' | 'error' | 'ready' =
    companionIds.length === 0 || companionRows ? 'ready' : companionData.isError ? 'error' : 'loading'
  const companionViews: CompanionView[] = []
  if (rec && companionRows) {
    for (const f of companionFixes) {
      const row = companionRows.find((r) => r.fix_id === f.id)
      if (!row) continue
      const stored = reviewDrafts.get(draftKey(f.id, rec.image_no))
      const text = stored?.text ?? editBaseline(row).join('\n')
      const isDirty = !!stored && isCompanionDirty(row, stored.text)
      const mark = fieldMark({ fixId: f.id, status: row.status, dirty: isDirty }, toggles)
      companionViews.push({
        fixId: f.id,
        title: f.title,
        notVisibleLabel: notVisibleLabel(f.id),
        row,
        draft: text,
        dirty: isDirty,
        draftOutdated: !!stored && isDirty && isDraftOutdated(stored, row.updated_at),
        mark,
        target: companionTarget(row, stored?.text, isDirty, mark),
      })
    }
  }

  const { hasNextPage, isFetchingNextPage, isFetchNextPageError, fetchNextPage } = queue
  useEffect(() => {
    if (hasNextPage && !isFetchingNextPage && !isFetchNextPageError && records.length - index <= PREFETCH_WHEN_REMAINING) {
      void fetchNextPage()
    }
  }, [hasNextPage, isFetchingNextPage, isFetchNextPageError, fetchNextPage, records.length, index])

  useEffect(() => {
    for (const imageNo of upcoming ? upcoming.split('\n') : []) {
      new Image().src = getReviewImageUrl(imageNo)
    }
  }, [upcoming])

  const setDraft = (text: string) => {
    if (!rec) return
    setToggles(clearMarks(mainField, toggles))
    // Keep the original base while typing on: only an explicit save or the stale reload rebases it.
    reviewDrafts.set(key, { text, baseUpdatedAt: storedDraft ? storedDraft.baseUpdatedAt : rec.updated_at })
    rerender()
  }

  const rebaseDraft = (k: string, updatedAt: string) => {
    const d = reviewDrafts.get(k)
    if (d) reviewDrafts.set(k, { text: d.text, baseUpdatedAt: updatedAt })
    rerender()
  }

  // Companion fixes the reviewer has edited (or been shown) on this card visit; reset per record.
  const touchedRef = useRef<{ imageNo: string; ids: Set<string> }>({ imageNo: '', ids: new Set() })
  const touched = (imageNo: string) => {
    if (touchedRef.current.imageNo !== imageNo) touchedRef.current = { imageNo, ids: new Set() }
    return touchedRef.current.ids
  }

  const setCompanionDraft = (fixId: string, text: string) => {
    const row = companionRows?.find((r) => r.fix_id === fixId)
    if (!rec || !row) return
    const k = draftKey(fixId, rec.image_no)
    touched(rec.image_no).add(fixId)
    setToggles(clearMarks({ fixId, status: row.status, dirty: true }, toggles))
    if (!isCompanionDirty(row, text)) {
      reviewDrafts.delete(k)
    } else {
      const stored = reviewDrafts.get(k)
      reviewDrafts.set(k, { text, baseUpdatedAt: stored ? stored.baseUpdatedAt : row.updated_at })
    }
    rerender()
  }

  const toggleCompanionNotVisible = (fixId: string) => {
    const c = companionViews.find((v) => v.fixId === fixId)
    if (!c) return
    setToggles(toggleNotVisible({ fixId, status: c.row.status, dirty: c.dirty }, toggles))
  }

  const discardCompanionDraft = (fixId: string) => {
    if (!rec) return
    reviewDrafts.delete(draftKey(fixId, rec.image_no))
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

  // Saves each edited companion before the main save. Returns true when it's fine to carry on; on
  // any problem it shows a notice (prefixed with the companion's title) and returns false.
  const saveCompanions = async (target: QueueEntry, saved: string[]): Promise<boolean> => {
    for (const c of companionViews) {
      const decision = c.target
      if (!decision) continue
      const k = draftKey(c.fixId, target.image_no)
      const stored = reviewDrafts.get(k)
      if (stored && c.dirty && !c.mark && isDraftOutdated(stored, c.row.updated_at)) {
        rebaseDraft(k, c.row.updated_at)
        setNotice({
          tone: 'info',
          text: `${c.title} changed after you typed your edit. Check it against the photo, then save again.`,
        })
        return false
      }
      const outcome = await reviewValue({
        imageNo: target.image_no,
        fixId: c.fixId,
        values: decision.values,
        status: decision.status,
        expectedUpdatedAt: c.row.updated_at,
      })
      if (outcome.ok) {
        const status: FixStatus = decision.status
        companionData.setRow(c.fixId, {
          status,
          values: status === 'none_visible' || status === 'no_loco' ? [] : decision.values,
          needs_recheck: false,
          updated_at: outcome.updated_at,
        })
        reviewDrafts.delete(k)
        saved.push(c.title)
        continue
      }
      if (outcome.reason === 'stale') {
        try {
          const fresh = await getValue(c.fixId, target.image_no)
          if (fresh) {
            companionData.setRow(c.fixId, fresh)
            rebaseDraft(k, fresh.updated_at)
            setNotice({ tone: 'info', text: `${c.title}: Someone else changed this record — reloaded` })
          } else {
            setNotice({ tone: 'error', text: `${c.title}: This record no longer exists.` })
          }
        } catch {
          setNotice({
            tone: 'error',
            text: `${c.title}: Someone else changed this record, and reloading it failed. Go Back and forward to retry.`,
          })
        }
      } else if (outcome.reason === 'signed-out') {
        setNotice({ tone: 'error', text: `${c.title}: Signed out — sign in again`, onSignIn: signInAgain })
      } else if (outcome.reason === 'forbidden') {
        setNotice({ tone: 'error', text: `${c.title}: This account isn't allowed to review fixes.` })
      } else {
        setNotice({
          tone: 'error',
          text: `${c.title}: Couldn't save: ${outcome.message}. Nothing was lost — try again.`,
        })
      }
      return false
    }
    return true
  }

  const save = async ({ status, values }: SaveDecision) => {
    if (!rec || savingRef.current) return
    // A stored companion edit must never be skipped just because its row isn't loaded.
    // Nor a selected No loco, which also answers the fields that haven't loaded.
    const blocked = companionBlockMessage(
      companionsState,
      companionFixes
        .filter((f) => toggles.noLoco === true || !!reviewDrafts.get(draftKey(f.id, rec.image_no)))
        .map((f) => f.title),
    )
    if (blocked) {
      setNotice({ tone: 'info', text: blocked })
      return
    }
    // An edit carried in from an earlier visit is shown first; the next save action saves it.
    const carried = carriedCompanions(
      companionViews.filter((c) => c.dirty).map((c) => c.fixId),
      touched(rec.image_no),
    )
    if (carried.length > 0) {
      // Name every carried edit: the next save action saves all of them.
      const shown = companionViews.filter((v) => carried.includes(v.fixId))
      if (shown.length > 0) {
        const parts = shown.map((c) => {
          const vals = normaliseValues(c.draft)
          return `${c.title}: ${vals.length > 0 ? vals.join('; ') : c.notVisibleLabel}`
        })
        const one = shown.length === 1
        setNotice({
          tone: 'info',
          text: `This photo has ${one ? 'an unsaved edit' : 'unsaved edits'} from earlier (${parts.join(' · ')}). Press Save & next again to save ${one ? 'it' : 'them'}, or Discard ${one ? 'it' : 'them'}.`,
        })
        document.getElementById(`review-values-${shown[0].fixId}`)?.scrollIntoView({ block: 'center' })
      }
      for (const id of carried) touched(rec.image_no).add(id)
      return
    }
    const target = rec
    const targetKey = key
    const at = index
    const savedTitles: string[] = []
    const failNotice = (n: CardNotice) =>
      setNotice(savedTitles.length > 0 ? { ...n, text: `${n.text} (${savedTitles.join(', ')} was saved.)` } : n)
    savingRef.current = true
    setSaving(true)
    setNotice(null)
    try {
      if (!(await saveCompanions(target, savedTitles))) return
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
            failNotice({ tone: 'info', text: 'Someone else changed this record — reloaded' })
          } else {
            failNotice({ tone: 'error', text: 'This record no longer exists — skip it.' })
          }
        } catch {
          failNotice({
            tone: 'error',
            text: 'Someone else changed this record, and reloading it failed. Go Back and forward to retry.',
          })
        }
        return
      }
      if (outcome.reason === 'signed-out') {
        failNotice({ tone: 'error', text: 'Signed out — sign in again', onSignIn: signInAgain })
      } else if (outcome.reason === 'forbidden') {
        failNotice({ tone: 'error', text: "This account isn't allowed to review fixes." })
      } else {
        failNotice({ tone: 'error', text: `Couldn't save: ${outcome.message}. Nothing was lost — try again.` })
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
      case 'confirm': {
        // Save & next: everything on the card, as shown.
        const decision = mainDecision(rec, draft, dirty, mainMark)
        if (decision === 'empty') {
          const kept = companionViews.filter((c) => c.target).map((c) => c.title)
          setNotice({
            tone: 'info',
            text:
              `Nothing to save for ${fix.title} — type it in the box, or choose ${notVisibleLabel(fix.id)} or No loco in photo.` +
              (kept.length > 0 ? ` Your ${kept.join(', ')} answer is kept until then.` : ''),
          })
          return
        }
        if (dirty && !mainMark && draftOutdated) {
          // Make the reviewer look first: this press acknowledges, the next one saves.
          rebaseDraft(key, rec.updated_at)
          setNotice({
            tone: 'info',
            text: 'This record changed after you typed your edit. Check it against the photo, then press Save & next again.',
          })
          return
        }
        void save(decision)
        return
      }
      case 'useSuggestion':
        // Puts the new suggestion in the box; Save & next saves it.
        if (!canUseSuggestion(rec)) return
        setDraft(rec.suggested_values.join('\n'))
        return
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
        setToggles(toggleNotVisible(mainField, toggles))
        setNotice(null)
        return
      case 'noLoco':
        setToggles(toggleNoLoco(mainField, toggles))
        setNotice(null)
        return
      case 'skip':
        goTo(index + 1)
        return
      case 'back':
        goTo(index - 1)
        return
    }
  }

  const chooseMain = (companionFixId: string) => {
    const title = companionFixes.find((f) => f.id === companionFixId)?.title ?? 'other fix'
    setNotice({
      tone: 'info',
      text: `${fix.title} needs a recheck — look at it first. Press Save & next to keep it as it is (your ${title} answer is saved with it), or change it.`,
    })
  }

  // The window listener is attached once and always calls the latest render's handler.
  const runRef = useRef(run)
  const currentKeyState = () => ({
    mainNeedsRecheck: !!rec?.needs_recheck,
    chooseMain,
    mainTouched: mainTouched(mainField, toggles),
    discardCompanion: discardCompanionDraft,
    clearNotice: () => setNotice(null),
  })
  const keyState = useRef(currentKeyState())
  useLayoutEffect(() => {
    runRef.current = run
    keyState.current = currentKeyState()
  })
  const onKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.altKey || e.isComposing || e.defaultPrevented) return
    if (document.querySelector('dialog[open]')) return // Help is open: its keys are its own
    const el = e.target instanceof HTMLElement ? e.target : null
    const inEditBox = !!el && el.dataset.reviewEdit !== undefined
    const target = keyTarget(el)
    if (isTypingTarget(target) && !inEditBox) return // filter fields and other inputs keep their keys
    if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey && ownsEnter(el)) return

    // '' is the main box; a fix id is that fix's companion box.
    const companionBox = inEditBox && el?.dataset.reviewEdit ? el.dataset.reviewEdit : null
    let action: CardAction | 'chooseMain' | null
    if (e.ctrlKey || e.metaKey) {
      action =
        e.key === 'Enter' && inEditBox
          ? ctrlEnterAction(!!companionBox, keyState.current.mainTouched, keyState.current.mainNeedsRecheck)
          : null
    } else {
      action = shortcutFor(e.key, target)
    }
    if (!action) return
    e.preventDefault()
    if (savingRef.current) return
    if (action === 'chooseMain') {
      keyState.current.chooseMain(companionBox ?? '')
      return
    }
    if (action === 'cancelEdit' && companionBox) {
      keyState.current.discardCompanion(companionBox)
      keyState.current.clearNotice()
      el?.blur()
      return
    }
    if (e.repeat && NO_REPEAT.includes(action)) return
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
        notVisibleLabel={notVisibleLabel(fix.id)}
        draft={draft}
        dirty={dirty}
        draftOutdated={draftOutdated}
        mark={mainMark}
        noLoco={noLoco}
        mainTarget={(() => {
          const d = mainDecision(rec, draft, dirty, mainMark)
          return d === 'empty' ? null : d
        })()}
        saving={saving}
        notice={notice}
        textareaRef={textareaRef}
        onDraftChange={setDraft}
        onAction={run}
        canGoBack={index > 0}
        fieldTitle={fix.title}
        companions={companionViews}
        companionsState={companionsState}
        companionTitles={companionFixes.map((f) => f.title)}
        onCompanionRetry={companionData.refetch}
        onCompanionDraftChange={setCompanionDraft}
        onCompanionDiscard={discardCompanionDraft}
        onCompanionNotVisible={toggleCompanionNotVisible}
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
    <div className="mx-auto flex w-full max-w-[100rem] flex-1 flex-col gap-3 px-4 py-3 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <div className="flex flex-wrap items-baseline gap-x-4">
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--foreground)]">
            {fix?.title ?? 'Data fix review'}
          </h1>
          <Link to="/admin/fixes" className="text-sm text-[var(--accent)]">
            ← Data fixes
          </Link>
        </div>
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
          <ReviewHelp title={fix.title} instructions={fix.instructions ?? ''} />
        </div>
        )}
      </div>

      <QueueFilters key={`${params.collection ?? ''}\u0000${params.text ?? ''}`} params={params} onChange={changeParams} />

      {fixes.isError && <div className={box}>Something went wrong talking to the archive. Please try again.</div>}
      {fixes.isPending && <div className={box}>Loading…</div>}
      {fixes.isSuccess && !fix && <div className={box}>There is no data fix called “{fixId}”.</div>}
      {fix && showGrid && <BulkConfirmGrid key={queueKey} fixId={fix.id} params={params} photoSize={photoSize} />}
      {fix && !showGrid && (
        <ReviewQueue
          key={queueKey}
          fix={fix}
          params={params}
          photoSize={photoSize}
          companionFixes={(fixes.data ?? []).filter((f) => f.id !== fix.id).sort((a, b) => a.sort_order - b.sort_order)}
        />
      )}
    </div>
  )
}
