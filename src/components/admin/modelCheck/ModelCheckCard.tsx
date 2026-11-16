import type { MouseEvent, ReactNode } from 'react'
import { ZoomImage } from '@/components/admin/fixes/ZoomImage'
import type { CardNotice } from '@/components/admin/fixes/ReviewCard'
import type { CheckEntry } from '@/hooks/useModelCheckQueue'
import { MODEL_CHECK_PHOTO_HEIGHT, type PhotoSize } from '@/lib/photoSize'
import type { ModelTask } from '@/services/modelCheckService'

const kbd =
  'inline-flex items-center rounded border border-current px-1 font-mono text-[0.7rem] leading-4 opacity-80'
const navBtn =
  'inline-flex min-h-12 items-center gap-3 rounded-lg border-2 border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-base font-semibold text-[var(--foreground)] hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50'
const rowBase =
  'flex min-h-11 w-full items-center gap-3 rounded-lg border-2 px-3 py-1.5 text-left text-base disabled:cursor-not-allowed disabled:opacity-50'
const rowOff = `${rowBase} border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] hover:border-[var(--accent)]`
const rowOn = `${rowBase} border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_22%,var(--surface))] font-semibold text-[var(--foreground)]`
const saveBtn =
  'flex min-h-12 w-full items-center justify-center gap-3 rounded-lg border-2 border-[var(--accent)] bg-[var(--accent)] px-4 py-2 text-lg font-semibold text-[var(--accent-foreground)] hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50'

function Kbd({ children }: { children: ReactNode }) {
  return <kbd className={kbd}>{children}</kbd>
}

function Check() {
  return (
    <svg className="size-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true">
      <path d="M5 12l5 5 9-10" />
    </svg>
  )
}

function Arrow({ dir }: { dir: 'left' | 'right' }) {
  return (
    <svg className="size-6 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
      {dir === 'left' ? <path d="M19 12H5M11 6l-6 6 6 6" /> : <path d="M5 12h14M13 6l6 6-6 6" />}
    </svg>
  )
}

export interface ModelCheckCardProps {
  task: ModelTask
  record: CheckEntry
  position: string
  photoSize: PhotoSize
  // Null in sample mode: the blind sample never shows the model's answer.
  modelThinks: string | null
  picked: string | null
  // linkPreview notes for the picked answer.
  notes: string[]
  checkedBy: string | null
  saving: boolean
  notice: CardNotice | null
  canGoBack: boolean
  onPick: (answerId: string) => void
  onSave: () => void
  onSkip: () => void
  onBack: () => void
}

export function ModelCheckCard({
  task,
  record,
  position,
  photoSize,
  modelThinks,
  picked,
  notes,
  checkedBy,
  saving,
  notice,
  canGoBack,
  onPick,
  onSave,
  onSkip,
  onBack,
}: ModelCheckCardProps) {
  // Buttons never take focus on click, so Enter keeps meaning Save & next.
  const noFocus = (e: MouseEvent) => e.preventDefault()
  const meta = [record.image_no, record.collection, record.date_taken, record.cd_no ? `CD ${record.cd_no}` : null].filter(
    (v): v is string => !!v,
  )

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="flex min-w-0 flex-col gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3 sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-[var(--muted)]">
          <span>{position}</span>
          <span className="flex flex-wrap items-center gap-2">
            {checkedBy && <span className="font-medium text-[var(--foreground)]">{checkedBy}</span>}
            {record.done && (
              <span className="rounded-full bg-[var(--accent)] px-2 py-0.5 text-xs text-[var(--accent-foreground)]">Done</span>
            )}
          </span>
        </div>

        <ZoomImage imageNo={record.image_no} photoSize={photoSize} heights={MODEL_CHECK_PHOTO_HEIGHT} />

        <nav aria-label="Move between photos" className="flex flex-wrap items-center justify-between gap-2">
          <button type="button" onMouseDown={noFocus} onClick={onBack} disabled={saving || !canGoBack} className={navBtn}>
            <Arrow dir="left" /> Back
          </button>
          <span className="text-sm text-[var(--muted)]">Back and Next don’t save</span>
          <button type="button" onMouseDown={noFocus} onClick={onSkip} disabled={saving} className={navBtn}>
            Next (skip) <Kbd>S</Kbd> <Arrow dir="right" />
          </button>
        </nav>

        <p className="truncate text-sm text-[var(--muted)]" title={meta.join(' · ')}>
          {meta.join(' · ')}
        </p>
        {record.description ? (
          <p className="whitespace-pre-wrap text-base leading-relaxed text-[var(--foreground)]">{record.description}</p>
        ) : (
          <p className="text-sm italic text-[var(--muted)]">No description</p>
        )}
      </div>

      <aside
        aria-label="Answer"
        className="flex flex-col gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3 sm:p-4 lg:sticky lg:top-4"
      >
        <h2 id="model-check-question" className="text-xl font-semibold text-[var(--foreground)]">
          {task.question}
        </h2>
        {modelThinks && <p className="text-base text-[var(--muted)]">{modelThinks}</p>}

        <div role="radiogroup" aria-labelledby="model-check-question" className="flex flex-col gap-1">
          {task.answers.map((a) => {
            const on = picked === a.id
            return (
              <button
                key={a.id}
                type="button"
                role="radio"
                aria-checked={on}
                onMouseDown={noFocus}
                onClick={() => onPick(a.id)}
                disabled={saving}
                className={on ? rowOn : rowOff}
              >
                <Kbd>{a.key}</Kbd>
                <span className="flex-1">{a.label}</span>
                <span
                  aria-hidden="true"
                  className={`flex size-6 shrink-0 items-center justify-center rounded border-2 ${on ? 'border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-foreground)]' : 'border-[var(--muted)]'}`}
                >
                  {on && <Check />}
                </span>
              </button>
            )
          })}
        </div>

        {notes.length > 0 && (
          <ul className="flex flex-col gap-1 text-sm text-[var(--foreground)]">
            {notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
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

        <button type="button" onMouseDown={noFocus} onClick={onSave} disabled={saving || !picked} className={saveBtn}>
          {saving ? 'Saving…' : 'Save & next'} <Kbd>Enter</Kbd>
        </button>
      </aside>
    </div>
  )
}
