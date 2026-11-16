import { useRef } from 'react'
import type { ModelAnswerDef } from '@/services/modelCheckService'

const btn =
  'inline-flex min-h-11 items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-base text-[var(--foreground)] hover:border-[var(--accent)] hover:text-[var(--accent)]'
const kbd = 'rounded border border-current px-1.5 font-mono text-sm'

const KEYS: [string, string][] = [
  ['Enter', 'Save & next: saves the ticked answer, then shows the next photo'],
  ['→ or S', 'Next photo, without saving'],
  ['←', 'Previous photo, without saving'],
]

// The check page's keys, behind a button so the answer panel can sit beside the photo.
export function CheckKeysHelp({ answers }: { answers: ModelAnswerDef[] }) {
  const ref = useRef<HTMLDialogElement>(null)
  const rows: [string, string][] = [...answers.map((a): [string, string] => [a.key, `Pick ${a.label}`]), ...KEYS]
  return (
    <>
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => ref.current?.showModal()}
        className={btn}
      >
        <span aria-hidden="true" className="flex size-6 items-center justify-center rounded-full border-2 border-current font-bold">
          ?
        </span>
        Keys
      </button>
      <dialog
        ref={ref}
        aria-labelledby="check-keys-title"
        onClick={(e) => e.target === ref.current && ref.current?.close()}
        className="m-auto w-[min(40rem,calc(100vw-2rem))] rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-0 text-[var(--foreground)] backdrop:bg-black/60"
      >
        <div className="flex max-h-[85dvh] flex-col gap-5 overflow-y-auto p-6">
          <div className="flex items-start justify-between gap-4">
            <h2 id="check-keys-title" className="text-xl font-semibold">
              Keys
            </h2>
            <button type="button" onClick={() => ref.current?.close()} className={btn}>
              Close
            </button>
          </div>
          <p className="text-base">
            Look at the photo (click it to zoom in), pick what it mainly shows, then press <strong>Save &amp; next</strong>.
            Nothing is saved before that.
          </p>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-base">
            {rows.map(([k, what]) => (
              <div key={k} className="contents">
                <dt>
                  <kbd className={kbd}>{k}</kbd>
                </dt>
                <dd>{what}</dd>
              </div>
            ))}
          </dl>
        </div>
      </dialog>
    </>
  )
}
