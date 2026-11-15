import { useState, type MouseEvent, type ReactNode, type RefObject } from 'react'
import { highlightParts } from '@/lib/highlight'
import { REVIEW_PHOTO_HEIGHT, type PhotoSize } from '@/lib/photoSize'
import { canUseSuggestion, isReviewed } from '@/lib/reviewDecision'
import type { ReviewAction } from '@/lib/reviewKeys'
import type { QueueEntry } from '@/hooks/useFixQueue'
import { formatWarnings, normaliseValues, type FixStatus } from '@/services/dataFixService'
import { getReviewImageUrl } from '@/services/images'

export type CardAction = ReviewAction | 'saveEdit'

export interface CardNotice {
  tone: 'info' | 'error'
  text: string
  onSignIn?: () => void
}

const STATUS_LABEL: Record<FixStatus, string> = {
  extracted: 'Not reviewed',
  verified: 'Verified',
  corrected: 'Corrected',
  none_visible: 'Not visible',
  no_loco: 'No loco',
}

const CONFIDENCE_LABEL = { none: 'no', low: 'low', med: 'medium', high: 'high' } as const

const btn =
  'inline-flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50'
const primaryBtn =
  'inline-flex items-center gap-2 rounded-lg border border-[var(--accent)] bg-[var(--accent)] px-3 py-2 text-sm font-medium text-[var(--accent-foreground)] hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50'
const kbd =
  'rounded border border-current px-1 font-mono text-[0.7rem] leading-4 opacity-80'
const markStyle = {
  background: 'color-mix(in srgb, var(--accent) 22%, transparent)',
  color: 'var(--foreground)',
  borderRadius: '0.2rem',
  padding: '0 0.1rem',
}

function Kbd({ children }: { children: ReactNode }) {
  return <kbd className={kbd}>{children}</kbd>
}

function ZoomImage({ imageNo, photoSize }: { imageNo: string; photoSize: PhotoSize }) {
  const [zoomed, setZoomed] = useState(false)
  const [origin, setOrigin] = useState('50% 50%')
  const [failed, setFailed] = useState(false)

  const follow = (e: MouseEvent<HTMLButtonElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    const x = ((e.clientX - r.left) / r.width) * 100
    const y = ((e.clientY - r.top) / r.height) * 100
    setOrigin(`${x}% ${y}%`)
  }

  if (failed) {
    return (
      <div className="flex h-48 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--background)] text-sm text-[var(--muted)]">
        No image for {imageNo}
      </div>
    )
  }

  return (
    <button
      type="button"
      // Keep keyboard focus where it was, so Enter still confirms after a click.
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => setZoomed((z) => !z)}
      onMouseMove={follow}
      aria-label={zoomed ? 'Zoom out' : 'Zoom in 2×'}
      className={`block w-full overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--background)] ${zoomed ? 'cursor-zoom-out' : 'cursor-zoom-in'}`}
    >
      <img
        src={getReviewImageUrl(imageNo)}
        alt={`Photo ${imageNo}`}
        onError={() => setFailed(true)}
        className={`mx-auto ${REVIEW_PHOTO_HEIGHT[photoSize]} w-full object-contain transition-transform duration-150`}
        style={{ transform: zoomed ? 'scale(2)' : undefined, transformOrigin: origin }}
      />
    </button>
  )
}

// The reviewed record's current answer, in words.
function currentReviewText(record: QueueEntry, notVisibleLabel: string): string {
  if (record.status === 'none_visible') return notVisibleLabel
  if (record.status === 'no_loco') return 'No loco in photo'
  return record.values.length > 0 ? record.values.join('; ') : 'none'
}

function Description({ text, terms }: { text: string | null; terms: string[] }) {
  if (!text) return <p className="text-sm italic text-[var(--muted)]">No description</p>
  return (
    <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--foreground)]">
      {highlightParts(text, terms).map((p, i) =>
        p.match ? (
          <mark key={i} style={markStyle}>
            {p.text}
          </mark>
        ) : (
          <span key={i}>{p.text}</span>
        ),
      )}
    </p>
  )
}

export interface ReviewCardProps {
  record: QueueEntry
  position: string
  instructions: string
  notVisibleLabel: string
  draft: string
  dirty: boolean
  draftOutdated: boolean
  saving: boolean
  notice: CardNotice | null
  textareaRef: RefObject<HTMLTextAreaElement | null>
  onDraftChange: (text: string) => void
  onAction: (action: CardAction) => void
  canGoBack: boolean
  photoSize: PhotoSize
}

export function ReviewCard({
  record,
  position,
  instructions,
  notVisibleLabel,
  draft,
  dirty,
  draftOutdated,
  saving,
  notice,
  textareaRef,
  onDraftChange,
  onAction,
  canGoBack,
  photoSize,
}: ReviewCardProps) {
  const warnings = formatWarnings(normaliseValues(draft))
  const reviewed = isReviewed(record)
  const offerSuggestion = canUseSuggestion(record)
  const confidence = `${CONFIDENCE_LABEL[record.confidence] ?? record.confidence} confidence`
  const terms = [...record.values, ...record.suggested_values.filter((v) => !record.values.includes(v))]
  const noFocus = (e: MouseEvent) => e.preventDefault()
  const act = (a: CardAction) => () => onAction(a)

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <div className="flex min-w-0 flex-col gap-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-[var(--muted)]">
          <span>{position}</span>
          <span className="flex flex-wrap gap-2">
            {record.done && (
              <span className="rounded-full bg-[var(--accent)] px-2 py-0.5 text-xs text-[var(--accent-foreground)]">
                Done
              </span>
            )}
            {record.needs_recheck && (
              <span className="rounded-full border border-[var(--warning)] px-2 py-0.5 text-xs text-[var(--warning)]">
                Needs recheck
              </span>
            )}
            <span className="rounded-full border border-[var(--border)] px-2 py-0.5 text-xs">
              {STATUS_LABEL[record.status] ?? record.status}
            </span>
          </span>
        </div>

        <ZoomImage imageNo={record.image_no} photoSize={photoSize} />

        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-4">
          {(
            [
              ['Image', record.image_no],
              ['Collection', record.collection],
              ['Date', record.date_taken],
              ['CD', record.cd_no],
            ] as const
          ).map(([label, value]) => (
            <div key={label} className="min-w-0">
              <dt className="text-xs uppercase tracking-wide text-[var(--muted)]">{label}</dt>
              <dd className="truncate text-[var(--foreground)]" title={value ?? undefined}>
                {value || '—'}
              </dd>
            </div>
          ))}
        </dl>

        <Description text={record.description} terms={terms} />

        <div className="flex flex-col gap-2">
          <label htmlFor="review-values" className="text-sm font-medium text-[var(--foreground)]">
            Values <span className="font-normal text-[var(--muted)]">(one per line)</span>
          </label>
          <textarea
            id="review-values"
            ref={textareaRef}
            data-review-edit=""
            rows={3}
            value={draft}
            // Read-only while saving, so nothing typed mid-save is overwritten when the save lands.
            readOnly={saving}
            onChange={(e) => onDraftChange(e.target.value)}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 font-mono text-sm text-[var(--foreground)] focus:border-[var(--accent)] focus:outline-none"
          />
          {reviewed ? (
            <>
              <p className="text-sm text-[var(--muted)]">
                Current review:{' '}
                <span className="font-medium text-[var(--foreground)]">{currentReviewText(record, notVisibleLabel)}</span>
              </p>
              {offerSuggestion && (
                <p className="text-sm text-[var(--warning)]">
                  New suggestion:{' '}
                  <span className="font-medium text-[var(--foreground)]">{record.suggested_values.join('; ')}</span> (
                  {confidence})
                </p>
              )}
            </>
          ) : (
            <p className="text-sm text-[var(--muted)]">
              Suggestion:{' '}
              <span className="text-[var(--foreground)]">
                {record.suggested_values.length > 0 ? record.suggested_values.join(', ') : 'none'}
              </span>{' '}
              ({confidence})
            </p>
          )}
          {draftOutdated && (
            <p
              role="alert"
              className="rounded-lg border-2 border-[var(--warning)] px-3 py-2 text-sm font-medium text-[var(--warning)]"
            >
              Your unsaved edit was typed before this record changed — check it before saving.
            </p>
          )}
          {dirty && (
            <p className="text-sm text-[var(--warning)]">
              Edited — <Kbd>Ctrl+Enter</Kbd> saves; <Kbd>Esc</Kbd> in the box or Discard throws it away.
            </p>
          )}
          {warnings.length > 0 && (
            <ul className="text-sm text-[var(--warning)]">
              {warnings.map((w) => (
                <li key={w}>⚠ {w}</li>
              ))}
            </ul>
          )}
        </div>

        {notice && (
          <div
            role="status"
            className={`rounded-lg border px-3 py-2 text-sm ${
              notice.tone === 'error'
                ? 'border-[var(--danger)] text-[var(--danger)]'
                : 'border-[var(--warning)] text-[var(--warning)]'
            }`}
          >
            {notice.text}
            {notice.onSignIn && (
              <button type="button" onClick={notice.onSignIn} className="ml-3 underline">
                Sign in again
              </button>
            )}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <button type="button" onMouseDown={noFocus} onClick={act('confirm')} disabled={saving} className={primaryBtn}>
            {reviewed ? 'Keep current' : 'Confirm'} <Kbd>Enter</Kbd>
          </button>
          {offerSuggestion && (
            <button
              type="button"
              onMouseDown={noFocus}
              onClick={act('useSuggestion')}
              disabled={saving}
              className={btn}
            >
              Use suggestion <Kbd>U</Kbd>
            </button>
          )}
          {dirty ? (
            <>
              <button type="button" onMouseDown={noFocus} onClick={act('saveEdit')} disabled={saving} className={primaryBtn}>
                Save edit <Kbd>Ctrl+Enter</Kbd>
              </button>
              <button type="button" onMouseDown={noFocus} onClick={act('cancelEdit')} disabled={saving} className={btn}>
                Discard edit <Kbd>Esc</Kbd>
              </button>
            </>
          ) : (
            <button type="button" onMouseDown={noFocus} onClick={act('edit')} disabled={saving} className={btn}>
              Edit <Kbd>E</Kbd>
            </button>
          )}
          <button type="button" onMouseDown={noFocus} onClick={act('notVisible')} disabled={saving} className={btn}>
            {notVisibleLabel} <Kbd>N</Kbd>
          </button>
          <button type="button" onMouseDown={noFocus} onClick={act('noLoco')} disabled={saving} className={btn}>
            No loco in photo <Kbd>X</Kbd>
          </button>
          <button type="button" onMouseDown={noFocus} onClick={act('back')} disabled={saving || !canGoBack} className={btn}>
            <Kbd>←</Kbd> Back
          </button>
          <button type="button" onMouseDown={noFocus} onClick={act('skip')} disabled={saving} className={btn}>
            Skip <Kbd>S</Kbd>
            <Kbd>→</Kbd>
          </button>
        </div>
        {saving && <p className="text-sm text-[var(--muted)]">Saving…</p>}
      </div>

      <aside className="h-fit rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 text-sm sm:p-6">
        <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--muted)]">Format instructions</h2>
        {instructions.trim() ? (
          <p className="whitespace-pre-wrap text-[var(--foreground)]">{instructions}</p>
        ) : (
          <p className="italic text-[var(--muted)]">No format instructions yet</p>
        )}
      </aside>
    </div>
  )
}
