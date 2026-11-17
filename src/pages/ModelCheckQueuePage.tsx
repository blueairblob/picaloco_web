import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { CardNotice } from '@/components/admin/fixes/ReviewCard'
import { PhotoSizeControl } from '@/components/admin/fixes/PhotoSizeControl'
import { CheckKeysHelp } from '@/components/admin/modelCheck/CheckKeysHelp'
import { ModelCheckCard } from '@/components/admin/modelCheck/ModelCheckCard'
import { useAdminSession } from '@/hooks/useAdminSession'
import { useModelCheckQueue } from '@/hooks/useModelCheckQueue'
import { usePhotoSize } from '@/hooks/usePhotoSize'
import { checkShortcut, type CheckAction } from '@/lib/modelCheckKeys'
import { linkPreview } from '@/lib/modelCheckLink'
import { formatAccuracy, parseCheckParams, serializeCheckParams, type CheckMode, type CheckParams } from '@/lib/modelCheckParams'
import { progressFor, queuePositionText, sampleComplete, SAMPLE_TARGET } from '@/lib/modelCheckProgress'
import {
  canSavePhoto,
  checkedByText,
  defaultPick,
  fixStateAfterSave,
  guardAfterSave,
  guardOnShow,
  modelThinksText,
  newPhotoGuardActive,
  type SaveGuard,
} from '@/lib/modelCheckView'
import type { PhotoSize } from '@/lib/photoSize'
import { adminSupabase } from '@/lib/supabase/adminClient'
import { getFixes, isSignedOutError } from '@/services/dataFixService'
import { getReviewImageUrl } from '@/services/images'
import { getRunProgress, getRuns, getTasks, saveModelAnswer, type ModelTask } from '@/services/modelCheckService'

const box = 'rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-10 text-center text-[var(--muted)]'
const linkBtn =
  'rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm text-[var(--foreground)] hover:border-[var(--accent)] hover:text-[var(--accent)]'

const bigBtn =
  'inline-flex min-h-11 items-center rounded-full border border-[var(--border)] px-5 text-base font-medium text-[var(--foreground)] no-underline hover:border-[var(--accent)] hover:text-[var(--accent)]'

const PREFETCH_WHEN_REMAINING = 5
const PRELOAD_IMAGES = 3

const MODE_LABEL: Record<CheckMode, string> = {
  sure: 'Sure',
  unsure: 'Unsure',
  sample: 'Random sample',
}

// Elements whose own Enter behaviour wins (keyboard users tabbing to a control expect it to fire).
function ownsEnter(el: HTMLElement | null): boolean {
  return !!el && ['BUTTON', 'A', 'SUMMARY'].includes(el.tagName)
}

function CheckQueue({
  task,
  params,
  photoSize,
  fixTitles,
}: {
  task: ModelTask
  params: CheckParams
  photoSize: PhotoSize
  fixTitles: Record<string, string>
}) {
  const queue = useModelCheckQueue(task.id, params)
  const { records, patch } = queue
  const { email } = useAdminSession()
  const [index, setIndex] = useState(0)
  const [saving, setSaving] = useState(false)
  const savingRef = useRef(false)
  const [notice, setNotice] = useState<CardNotice | null>(null)
  const blind = params.mode === 'sample'
  const queryClient = useQueryClient()

  // Random sample counts everyone's blind answers towards SAMPLE_TARGET; refetched after each save.
  const progress = useQuery({ queryKey: ['model-progress'], queryFn: getRunProgress, enabled: blind })
  const stats = progressFor(progress.data ?? [], task.id, params.run)
  const blindDone = stats?.n_blind ?? 0
  // Photos answered in this sitting (sure and unsure show this count).
  const [sessionSaved, setSessionSaved] = useState<ReadonlySet<string>>(new Set())
  // At the target the page stops on a finish screen until "Keep going" is pressed.
  const [keepGoing, setKeepGoing] = useState(false)
  const finished = blind && progress.isSuccess && sampleComplete(blindDone) && !keepGoing
  const finishedRef = useRef(finished)
  useLayoutEffect(() => {
    finishedRef.current = finished
  })

  const rec = records[index]
  // The answer picked on this card visit; moving to another photo forgets it.
  const [pickState, setPickState] = useState<{ imageNo: string; answerId: string } | null>(null)
  const picked = rec ? (pickState?.imageNo === rec.image_no ? pickState.answerId : defaultPick(task, params.mode, rec)) : null

  // When the current photo appeared, for the double-press guard.
  const shownAt = useRef(0)
  // The photo just saved, held until another photo is shown (set synchronously on success).
  const savedGuard = useRef<SaveGuard>(null)
  const shownImage = rec?.image_no ?? ''
  useLayoutEffect(() => {
    shownAt.current = performance.now()
    savedGuard.current = guardOnShow(savedGuard.current, shownImage)
  }, [shownImage])

  const upcoming = records
    .slice(index + 1, index + 1 + PRELOAD_IMAGES)
    .map((r) => r.image_no)
    .join('\n')

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

  const goTo = (to: number) => {
    setIndex(Math.max(0, Math.min(to, records.length)))
    setPickState(null)
    setNotice(null)
  }

  const signInAgain = () => {
    void adminSupabase.auth.signOut({ scope: 'local' })
  }

  // Whether the latest page-load failure means the session is gone, tagged with the error it was
  // worked out for so a cleared or newer error never reuses it.
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

  const save = async () => {
    // One save at a time: the ref is set before the first await, so a second press is ignored.
    if (!rec || !picked || savingRef.current) return
    // A key pressed after a save but before the page advanced still sees the saved photo: refuse it.
    if (!canSavePhoto(savedGuard.current, rec.image_no)) return
    const target = rec
    const answer = picked
    const at = index
    savingRef.current = true
    setSaving(true)
    setNotice(null)
    try {
      const outcome = await saveModelAnswer({
        taskId: task.id,
        imageNo: target.image_no,
        answer,
        mode: params.mode,
        // The blind sample showed nothing, so it records nothing as shown.
        shownRunId: blind ? null : params.run,
        shownAnswer: blind ? null : target.model_answer,
      })
      if (outcome.ok) {
        savedGuard.current = guardAfterSave(target.image_no)
        setSessionSaved((s) => new Set(s).add(target.image_no))
        void queryClient.invalidateQueries({ queryKey: ['model-progress'] })
        patch(target.image_no, {
          done: true,
          checked_answer: answer,
          checked_at: new Date().toISOString(),
          checked_by: email,
          fix_state: fixStateAfterSave(target.fix_state, outcome.filled),
        })
        setPickState(null)
        setIndex(at + 1)
        return
      }
      if (outcome.reason === 'signed-out') {
        setNotice({ tone: 'error', text: 'Signed out — sign in again', onSignIn: signInAgain })
      } else if (outcome.reason === 'forbidden') {
        setNotice({ tone: 'error', text: "This account isn't allowed to check model answers." })
      } else {
        setNotice({ tone: 'error', text: `Couldn't save: ${outcome.message}. Nothing was lost — try again.` })
      }
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }

  const pick = (answerId: string) => {
    if (!rec || savingRef.current) return
    setPickState({ imageNo: rec.image_no, answerId })
    setNotice(null)
  }

  const run = (action: CheckAction) => {
    switch (action.type) {
      case 'pick':
        pick(action.answerId)
        return
      case 'save':
        if (newPhotoGuardActive(performance.now(), shownAt.current)) return
        void save()
        return
      case 'skip':
        if (rec) goTo(index + 1)
        return
      case 'back':
        goTo(index - 1)
        return
    }
  }

  // The window listener is attached once and always calls the latest render's handler.
  const runRef = useRef(run)
  const answersRef = useRef(task.answers)
  useLayoutEffect(() => {
    runRef.current = run
    answersRef.current = task.answers
  })
  const onKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return // browser and system shortcuts are never ours
    if (e.isComposing || e.defaultPrevented) return
    if (finishedRef.current) return // the finish screen has only its own buttons
    if (document.querySelector('dialog[open]')) return // Keys help is open: its keys are its own
    if (document.querySelector('[role="menu"]')) return // the user menu is open
    const el = e.target instanceof HTMLElement ? e.target : null
    if (el?.closest('[role="menu"]')) return
    if (e.key === 'Enter' && ownsEnter(el)) return
    const action = checkShortcut(
      e.key,
      { tagName: el?.tagName ?? '', isContentEditable: el?.isContentEditable ?? false },
      answersRef.current,
    )
    if (!action) return
    e.preventDefault()
    if (savingRef.current) return
    if (e.repeat && action.type === 'save') return // a held Enter must not save a run of photos
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
  if (queue.isLoadingError) {
    return (
      <div className={box}>
        {loadSignedOut ? (
          signedOutNotice
        ) : (
          <>
            Couldn't load the photos.{' '}
            <button type="button" onClick={() => void queue.refetch()} className="text-[var(--accent)] underline">
              Try again
            </button>
          </>
        )}
      </div>
    )
  }

  // A later page failed: never refetch() (it reloads every page and shifts positions) — retry just
  // the next page.
  const moreFailed = queue.isFetchNextPageError ? (
    loadSignedOut ? (
      signedOutNotice
    ) : (
      <>
        Couldn't load more photos.{' '}
        <button type="button" onClick={() => void fetchNextPage()} className="text-[var(--accent)] underline">
          Retry
        </button>
      </>
    )
  ) : null

  if (finished) {
    return (
      <div className={`${box} flex flex-col items-center gap-4 text-base`}>
        <h2 className="text-2xl font-semibold text-[var(--foreground)]">Sample complete</h2>
        <p className="text-lg text-[var(--foreground)]">
          Accuracy {formatAccuracy(stats?.n_blind_correct ?? 0, stats?.n_blind ?? 0)}
        </p>
        <p>
          {SAMPLE_TARGET} blind answers are enough to judge the model. More answers make the figure more precise.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={() => {
              shownAt.current = performance.now() // the next photo gets the full new-photo guard
              setKeepGoing(true)
            }}
            className={bigBtn}
          >
            Keep going
          </button>
          <Link to="/admin/model-check" className={bigBtn}>
            Back to overview
          </Link>
        </div>
      </div>
    )
  }

  if (!rec) {
    if (queue.hasNextPage || queue.isFetchingNextPage) {
      return <div className={box}>{moreFailed ?? 'Loading more…'}</div>
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
          <Link to="/admin/model-check" className={`${linkBtn} no-underline`}>
            Back to model check
          </Link>
        </div>
      </div>
    )
  }

  return (
    <>
      {moreFailed && (
        <div role="status" className="rounded-lg border border-[var(--danger)] px-3 py-2 text-sm text-[var(--danger)]">
          {moreFailed}
        </div>
      )}
      <ModelCheckCard
        key={rec.image_no}
        task={task}
        record={rec}
        position={queuePositionText(params.mode, blindDone, sessionSaved.size)}
        photoSize={photoSize}
        modelThinks={modelThinksText(task, params.mode, rec.model_answer, rec.model_p)}
        picked={picked}
        notes={picked ? linkPreview(task, picked, rec.fix_state, fixTitles).notes : []}
        checkedBy={rec.checked_at ? checkedByText(rec.checked_by, rec.checked_at) : null}
        saving={saving}
        notice={notice}
        canGoBack={index > 0}
        onPick={(id) => run({ type: 'pick', answerId: id })}
        onSave={() => run({ type: 'save' })}
        onSkip={() => run({ type: 'skip' })}
        onBack={() => run({ type: 'back' })}
      />
    </>
  )
}

export function ModelCheckQueuePage() {
  const { taskId = '' } = useParams()
  const [searchParams] = useSearchParams()
  const params = useMemo(() => parseCheckParams(searchParams), [searchParams])
  const [photoSize, setPhotoSize] = usePhotoSize()

  const tasks = useQuery({ queryKey: ['model-tasks'], queryFn: getTasks })
  const task = tasks.data?.find((t) => t.id === taskId)
  const fixes = useQuery({ queryKey: ['data-fixes'], queryFn: getFixes })
  const fixTitles = useMemo(() => Object.fromEntries((fixes.data ?? []).map((f) => [f.id, f.title])), [fixes.data])

  // Sure and unsure check one run's predictions. With no run in the link, use the newest.
  const needsRun = params.mode !== 'sample' && params.run === null
  const runs = useQuery({ queryKey: ['model-runs', taskId], queryFn: () => getRuns(taskId), enabled: needsRun && !!task })
  const newestRun = runs.data?.[0]?.id ?? null
  const effective = useMemo<CheckParams | null>(() => {
    if (!needsRun) return params
    return newestRun === null ? null : { ...params, run: newestRun }
  }, [needsRun, params, newestRun])
  const queueKey = effective ? `${taskId}?${serializeCheckParams(effective).toString()}` : ''

  return (
    <div className="mx-auto flex w-full max-w-[100rem] flex-1 flex-col gap-3 px-4 py-3 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <div className="flex flex-wrap items-baseline gap-x-4">
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--foreground)]">
            Model check · {MODE_LABEL[params.mode]}
          </h1>
          <Link to="/admin/model-check" className="text-sm text-[var(--accent)]">
            ← Model check
          </Link>
        </div>
        {task && (
          <div className="flex flex-wrap items-center gap-4">
            <PhotoSizeControl value={photoSize} onChange={setPhotoSize} />
            <CheckKeysHelp answers={task.answers} />
          </div>
        )}
      </div>

      {(tasks.isError || runs.isError) && (
        <div className={box}>Something went wrong talking to the archive. Please try again.</div>
      )}
      {(tasks.isPending || (needsRun && !!task && runs.isPending)) && <div className={box}>Loading…</div>}
      {tasks.isSuccess && !task && <div className={box}>There is no question called “{taskId}”.</div>}
      {task && needsRun && runs.isSuccess && newestRun === null && (
        <div className={box}>No model run has been loaded for this question yet.</div>
      )}
      {task && effective && (
        <CheckQueue key={queueKey} task={task} params={effective} photoSize={photoSize} fixTitles={fixTitles} />
      )}
    </div>
  )
}
