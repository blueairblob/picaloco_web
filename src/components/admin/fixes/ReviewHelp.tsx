import { useRef } from 'react'

const btn =
  'inline-flex min-h-11 items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-base text-[var(--foreground)] hover:border-[var(--accent)] hover:text-[var(--accent)]'
const kbd = 'rounded border border-current px-1.5 font-mono text-sm'

const KEYS: [string, string][] = [
  ['Enter', 'Save & next: saves everything on the card, then shows the next photo'],
  ['Ctrl+Enter', 'Save & next while typing in a box (Enter on its own starts a new line)'],
  ['X', 'No loco in photo (covers every field) — press again to switch off'],
  ['N', 'Not visible, for this queue’s field — press again to switch off'],
  ['U', 'Put the new suggestion in the box'],
  ['E', 'Start typing in the box'],
  ['Esc', 'In a box: throw away what you typed there'],
  ['→ or S', 'Next photo, without saving'],
  ['←', 'Previous photo, without saving'],
]

// The review instructions, behind a button so the answer panel can sit beside the photo.
export function ReviewHelp({ title, instructions }: { title: string; instructions: string }) {
  const ref = useRef<HTMLDialogElement>(null)
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
        Help
      </button>
      <dialog
        ref={ref}
        aria-labelledby="review-help-title"
        onClick={(e) => e.target === ref.current && ref.current?.close()}
        className="m-auto w-[min(44rem,calc(100vw-2rem))] rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-0 text-[var(--foreground)] backdrop:bg-black/60"
      >
        <div className="flex max-h-[85dvh] flex-col gap-5 overflow-y-auto p-6">
          <div className="flex items-start justify-between gap-4">
            <h2 id="review-help-title" className="text-xl font-semibold">
              Help — {title}
            </h2>
            <button type="button" onClick={() => ref.current?.close()} className={btn}>
              Close
            </button>
          </div>

          <section className="flex flex-col gap-2">
            <h3 className="text-base font-semibold">What to type</h3>
            {instructions.trim() ? (
              <p className="whitespace-pre-wrap text-base">{instructions}</p>
            ) : (
              <p className="text-base italic text-[var(--muted)]">No format instructions yet.</p>
            )}
            <p className="text-base">One value per line. Leave a box as it is if it’s already right.</p>
          </section>

          <section className="flex flex-col gap-2">
            <h3 className="text-base font-semibold">How it works</h3>
            <ol className="list-decimal space-y-1 pl-6 text-base">
              <li>Look at the photo. Click it to zoom in.</li>
              <li>Check or type the values in each box, or choose No loco / Not visible on the right.</li>
              <li>
                Press <strong>Save &amp; next</strong>. Nothing is saved before that, so you can change your mind.
              </li>
            </ol>
          </section>

          <section className="flex flex-col gap-2">
            <h3 className="text-base font-semibold">Keyboard</h3>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-base">
              {KEYS.map(([k, what]) => (
                <div key={k} className="contents">
                  <dt>
                    <kbd className={kbd}>{k}</kbd>
                  </dt>
                  <dd>{what}</dd>
                </div>
              ))}
            </dl>
          </section>
        </div>
      </dialog>
    </>
  )
}
