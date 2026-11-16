import type { MouseEvent, ReactNode, RefObject } from 'react'
import { highlightParts } from '@/lib/highlight'
import type { PhotoSize } from '@/lib/photoSize'
import type { Mark } from '@/lib/cardAnswer'
import { canUseSuggestion, isReviewed, type SaveDecision } from '@/lib/reviewDecision'
import type { ReviewAction } from '@/lib/reviewKeys'
import type { QueueEntry } from '@/hooks/useFixQueue'
import { formatWarnings, normaliseValues, type CompanionValue, type FixStatus } from '@/services/dataFixService'
import { ZoomImage } from '@/components/admin/fixes/ZoomImage'

export type CardAction = ReviewAction

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
const kbd =
  'inline-flex items-center rounded border border-current px-1 font-mono text-[0.7rem] leading-4 opacity-80'
const markStyle = {
  background: 'color-mix(in srgb, var(--accent) 22%, transparent)',
  color: 'var(--foreground)',
  borderRadius: '0.2rem',
  padding: '0 0.1rem',
}

function Kbd({ children }: { children: ReactNode }) {
  return <kbd className={kbd}>{children}</kbd>
}

const navBtn =
  'inline-flex min-h-12 items-center gap-3 rounded-lg border-2 border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-base font-semibold text-[var(--foreground)] hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50'

// Answer toggles (No loco / Not visible): lit while selected.
const toggleBase =
  'flex min-h-12 w-full items-center gap-3 rounded-lg border-2 px-3 py-2 text-left text-base disabled:cursor-not-allowed disabled:opacity-50'
const toggleOff = `${toggleBase} border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] hover:border-[var(--accent)]`
const toggleOn = `${toggleBase} border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_22%,var(--surface))] font-semibold text-[var(--foreground)]`
const saveBtn =
  'flex min-h-14 w-full items-center justify-center gap-3 rounded-lg border-2 border-[var(--accent)] bg-[var(--accent)] px-4 py-3 text-lg font-semibold text-[var(--accent-foreground)] hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50'
const fieldBox =
  'w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 font-mono text-base text-[var(--foreground)] focus:border-[var(--accent)] focus:outline-none'

function Check() {
  return (
    <svg className="size-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true">
      <path d="M5 12l5 5 9-10" />
    </svg>
  )
}

function Arrow({ dir }: { dir: 'left' | 'right' }) {
  return (
    // Sized in rem, so it grows with the page text on big screens.
    <svg className="size-6 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
      {dir === 'left' ? <path d="M19 12H5M11 6l-6 6 6 6" /> : <path d="M5 12h14M13 6l6 6-6 6" />}
    </svg>
  )
}

// The reviewed record's current answer, in words.
function currentReviewText(record: Pick<QueueEntry, 'status' | 'values'>, notVisibleLabel: string): string {
  if (record.status === 'none_visible') return notVisibleLabel
  if (record.status === 'no_loco') return 'No loco in photo'
  return record.values.length > 0 ? record.values.join('; ') : 'none'
}

function markText(mark: Mark, notVisibleLabel: string): string {
  return mark === 'no_loco' ? 'No loco in photo' : notVisibleLabel
}

// What a save writes, in words.
function decisionText(d: SaveDecision, notVisibleLabel: string): string {
  if (d.status === 'none_visible' || d.status === 'no_loco') return markText(d.status, notVisibleLabel)
  return d.values.join('; ')
}

function Description({ text, terms }: { text: string | null; terms: string[] }) {
  if (!text) return <p className="text-sm italic text-[var(--muted)]">No description</p>
  return (
    <p className="whitespace-pre-wrap text-base leading-relaxed text-[var(--foreground)]">
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

function Pill({ tone, children }: { tone: 'muted' | 'warning' | 'accent'; children: ReactNode }) {
  const cls =
    tone === 'accent'
      ? 'bg-[var(--accent)] text-[var(--accent-foreground)]'
      : tone === 'warning'
        ? 'border border-[var(--warning)] text-[var(--warning)]'
        : 'border border-[var(--border)] text-[var(--muted)]'
  return <span className={`rounded-full px-2 py-0.5 text-xs ${cls}`}>{children}</span>
}

// One field's box: the bold field name, the values, and what the reviewer needs to know about them.
function FieldBox({
  id,
  editKey,
  title,
  status,
  savedValues,
  needsRecheck,
  draft,
  dirty,
  draftOutdated,
  mark,
  notVisibleLabel,
  suggestion,
  confidence,
  newSuggestion,
  saving,
  textareaRef,
  onChange,
  onDiscard,
}: {
  id: string
  editKey: string
  title: string
  status: FixStatus
  savedValues: string[]
  needsRecheck: boolean
  draft: string
  dirty: boolean
  draftOutdated: boolean
  mark: Mark | null
  notVisibleLabel: string
  suggestion: string[]
  confidence: string
  newSuggestion: boolean
  saving: boolean
  textareaRef?: RefObject<HTMLTextAreaElement | null>
  onChange: (text: string) => void
  onDiscard: () => void
}) {
  const reviewed = status !== 'extracted'
  const warnings = mark ? [] : formatWarnings(normaliseValues(draft))
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label htmlFor={id} className="text-lg text-[var(--foreground)]">
          <strong className="font-bold">{title}</strong>{' '}
          <span className="text-sm text-[var(--muted)]">(one per line)</span>
        </label>
        <span className="flex flex-wrap gap-2">
          {needsRecheck && <Pill tone="warning">Needs recheck</Pill>}
          <Pill tone="muted">{STATUS_LABEL[status] ?? status}</Pill>
        </span>
      </div>
      <div className="relative">
        <textarea
          id={id}
          ref={textareaRef}
          data-review-edit={editKey}
          rows={2}
          value={draft}
          // Read-only while saving, so nothing typed mid-save is overwritten when the save lands.
          readOnly={saving}
          onChange={(e) => onChange(e.target.value)}
          className={`${fieldBox} block ${mark ? 'text-transparent' : ''}`}
        />
        {/* Over the box, not below it, so selecting an answer never moves the page. Clicks go through to
            the box: typing there switches the answer off. */}
        {mark && (
          <p className="pointer-events-none absolute inset-0 flex items-center px-3 text-base font-semibold text-[var(--accent)]">
            Will be saved as: {markText(mark, notVisibleLabel)}
          </p>
        )}
      </div>
      {reviewed ? (
        <p className="text-sm text-[var(--muted)]">
          Saved answer: <span className="font-medium text-[var(--foreground)]">{currentReviewText({ status, values: savedValues }, notVisibleLabel)}</span>
        </p>
      ) : (
        <p className="text-sm text-[var(--muted)]">
          Suggestion: <span className="text-[var(--foreground)]">{suggestion.length > 0 ? suggestion.join(', ') : 'none'}</span> (
          {confidence})
        </p>
      )}
      {reviewed && newSuggestion && (
        <p className="text-sm text-[var(--warning)]">
          New suggestion: <span className="font-medium text-[var(--foreground)]">{suggestion.join('; ')}</span> ({confidence})
        </p>
      )}
      {draftOutdated && (
        <p role="alert" className="rounded-lg border-2 border-[var(--warning)] px-3 py-2 text-sm font-medium text-[var(--warning)]">
          Your unsaved edit was typed before this record changed — check it before saving.
        </p>
      )}
      {dirty && !mark && (
        <div className="flex flex-wrap items-center gap-2 text-sm text-[var(--warning)]">
          <span>Edited, not saved yet. Esc in the box or Discard throws it away.</span>
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={onDiscard} disabled={saving} className={btn}>
            Discard
          </button>
        </div>
      )}
      {warnings.length > 0 && (
        <ul className="text-sm text-[var(--warning)]">
          {warnings.map((w) => (
            <li key={w}>⚠ {w}</li>
          ))}
        </ul>
      )}
    </div>
  )
}

function Toggle({
  on,
  label,
  keyHint,
  disabled,
  onClick,
}: {
  on: boolean
  label: string
  keyHint?: string
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      disabled={disabled}
      className={on ? toggleOn : toggleOff}
    >
      <span
        aria-hidden="true"
        className={`flex size-6 shrink-0 items-center justify-center rounded border-2 ${on ? 'border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-foreground)]' : 'border-[var(--muted)]'}`}
      >
        {on && <Check />}
      </span>
      <span className="flex-1">{label}</span>
      {keyHint && <Kbd>{keyHint}</Kbd>}
    </button>
  )
}

export interface CompanionView {
  fixId: string
  title: string
  notVisibleLabel: string
  row: CompanionValue
  draft: string
  dirty: boolean
  draftOutdated: boolean
  mark: Mark | null
  // What Save & next would write for it; null = left as it is.
  target: SaveDecision | null
}

export interface ReviewCardProps {
  record: QueueEntry
  position: string
  fieldTitle: string
  notVisibleLabel: string
  draft: string
  dirty: boolean
  draftOutdated: boolean
  mark: Mark | null
  noLoco: boolean
  // What Save & next would write for this queue's field; null = nothing to save yet.
  mainTarget: SaveDecision | null
  saving: boolean
  notice: CardNotice | null
  textareaRef: RefObject<HTMLTextAreaElement | null>
  onDraftChange: (text: string) => void
  onAction: (action: CardAction) => void
  canGoBack: boolean
  photoSize: PhotoSize
  companions: CompanionView[]
  companionsState: 'loading' | 'error' | 'ready'
  companionTitles: string[]
  onCompanionRetry: () => void
  onCompanionDraftChange: (fixId: string, text: string) => void
  onCompanionDiscard: (fixId: string) => void
  onCompanionNotVisible: (fixId: string) => void
}

export function ReviewCard({
  record,
  position,
  fieldTitle,
  notVisibleLabel,
  draft,
  dirty,
  draftOutdated,
  mark,
  noLoco,
  mainTarget,
  saving,
  notice,
  textareaRef,
  onDraftChange,
  onAction,
  canGoBack,
  photoSize,
  companions,
  companionsState,
  companionTitles,
  onCompanionRetry,
  onCompanionDraftChange,
  onCompanionDiscard,
  onCompanionNotVisible,
}: ReviewCardProps) {
  const reviewed = isReviewed(record)
  const offerSuggestion = canUseSuggestion(record)
  const confidenceOf = (c: string) => `${CONFIDENCE_LABEL[c as keyof typeof CONFIDENCE_LABEL] ?? c} confidence`
  const terms = [...record.values, ...record.suggested_values.filter((v) => !record.values.includes(v))]
  const noFocus = (e: MouseEvent) => e.preventDefault()
  const act = (a: CardAction) => () => onAction(a)
  const meta = [record.image_no, record.collection, record.date_taken, record.cd_no ? `CD ${record.cd_no}` : null].filter(
    (v): v is string => !!v,
  )
  const saves = [
    ...(mainTarget ? [`${fieldTitle}: ${decisionText(mainTarget, notVisibleLabel)}`] : []),
    ...companions.filter((c) => c.target).map((c) => `${c.title}: ${decisionText(c.target as SaveDecision, c.notVisibleLabel)}`),
  ]

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="flex min-w-0 flex-col gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3 sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-[var(--muted)]">
          <span>{position}</span>
          <span className="flex flex-wrap gap-2">
            {record.done && <Pill tone="accent">Done</Pill>}
          </span>
        </div>

        <ZoomImage imageNo={record.image_no} photoSize={photoSize} />

        <nav aria-label="Move between photos" className="flex flex-wrap items-center justify-between gap-2">
          <button type="button" onMouseDown={noFocus} onClick={act('back')} disabled={saving || !canGoBack} className={navBtn}>
            <Arrow dir="left" /> Back
          </button>
          <span className="text-sm text-[var(--muted)]">Back and Next don’t save</span>
          <button type="button" onMouseDown={noFocus} onClick={act('skip')} disabled={saving} className={navBtn}>
            Next (skip) <Kbd>S</Kbd> <Arrow dir="right" />
          </button>
        </nav>

        <p className="truncate text-sm text-[var(--muted)]" title={meta.join(' · ')}>
          {meta.join(' · ')}
        </p>
        <Description text={record.description} terms={terms} />

        <div className="grid gap-4 border-t border-[var(--border)] pt-3 md:grid-cols-2">
          <FieldBox
            id="review-values"
            editKey=""
            title={fieldTitle}
            status={record.status}
            savedValues={record.values}
            needsRecheck={record.needs_recheck}
            draft={draft}
            dirty={dirty}
            draftOutdated={draftOutdated}
            mark={mark}
            notVisibleLabel={notVisibleLabel}
            suggestion={record.suggested_values}
            confidence={confidenceOf(record.confidence)}
            newSuggestion={offerSuggestion}
            saving={saving}
            textareaRef={textareaRef}
            onChange={onDraftChange}
            onDiscard={act('cancelEdit')}
          />
          {companionsState === 'loading' && companionTitles.length > 0 && (
            <p className="text-sm text-[var(--muted)]">Loading {companionTitles.join(', ')}…</p>
          )}
          {companionsState === 'error' && companionTitles.length > 0 && (
            <div className="flex flex-wrap items-center gap-3 text-sm text-[var(--danger)]">
              Couldn't load {companionTitles.join(', ')} for this photo.
              <button type="button" onMouseDown={noFocus} onClick={onCompanionRetry} className={btn}>
                Retry
              </button>
            </div>
          )}
          {companionsState === 'ready' &&
            companions.map((c) => (
              <FieldBox
                key={c.fixId}
                id={`review-values-${c.fixId}`}
                editKey={c.fixId}
                title={c.title}
                status={c.row.status}
                savedValues={c.row.values}
                needsRecheck={c.row.needs_recheck}
                draft={c.draft}
                dirty={c.dirty}
                draftOutdated={c.draftOutdated}
                mark={c.mark}
                notVisibleLabel={c.notVisibleLabel}
                suggestion={c.row.suggested_values}
                confidence={confidenceOf(c.row.confidence)}
                newSuggestion={canUseSuggestion(c.row)}
                saving={saving}
                onChange={(text) => onCompanionDraftChange(c.fixId, text)}
                onDiscard={() => onCompanionDiscard(c.fixId)}
              />
            ))}
        </div>
      </div>

      <aside
        aria-label="Answer"
        className="flex flex-col gap-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 lg:sticky lg:top-4"
      >
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-medium uppercase tracking-wide text-[var(--muted)]">Whole photo</h2>
          <Toggle on={noLoco} label="No loco in photo" keyHint="X" disabled={saving} onClick={act('noLoco')} />
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-medium uppercase tracking-wide text-[var(--muted)]">Can’t read it</h2>
          <Toggle on={mark === 'none_visible'} label={notVisibleLabel} keyHint="N" disabled={saving} onClick={act('notVisible')} />
          {companionsState === 'ready' &&
            companions.map((c) => (
              <Toggle
                key={c.fixId}
                on={c.mark === 'none_visible'}
                label={c.notVisibleLabel}
                disabled={saving}
                onClick={() => onCompanionNotVisible(c.fixId)}
              />
            ))}
        </section>

        {offerSuggestion && (
          <button type="button" onMouseDown={noFocus} onClick={act('useSuggestion')} disabled={saving} className={btn}>
            Use new suggestion <Kbd>U</Kbd>
          </button>
        )}

        {notice && (
          <div
            role="status"
            className={`rounded-lg border px-3 py-2 text-sm ${
              notice.tone === 'error' ? 'border-[var(--danger)] text-[var(--danger)]' : 'border-[var(--warning)] text-[var(--warning)]'
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

        <div className="flex flex-col gap-2 border-t border-[var(--border)] pt-4">
          {saves.length > 0 ? (
            <div className="text-sm text-[var(--muted)]">
              {reviewed && !dirty && !mark && saves.length === 1 ? 'Keeps' : 'Saves'}:
              <ul className="mt-1 text-base text-[var(--foreground)]">
                {saves.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-sm text-[var(--muted)]">Nothing to save yet — type a value or choose an answer above.</p>
          )}
          <button type="button" onMouseDown={noFocus} onClick={act('confirm')} disabled={saving} className={saveBtn}>
            {saving ? 'Saving…' : 'Save & next'} <Kbd>Enter</Kbd>
          </button>
        </div>
      </aside>
    </div>
  )
}
