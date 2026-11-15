import { PHOTO_SIZES, type PhotoSize } from '@/lib/photoSize'

const base =
  'min-h-11 rounded-lg border px-4 py-2 text-base hover:border-[var(--accent)]'
const idle = 'border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)]'
const pressed = 'border-[var(--accent)] bg-[var(--accent)] font-medium text-[var(--accent-foreground)]'

export function PhotoSizeControl({ value, onChange }: { value: PhotoSize; onChange: (s: PhotoSize) => void }) {
  return (
    <div role="group" aria-label="Photo size" className="flex flex-wrap items-center gap-2">
      <span className="text-base text-[var(--foreground)]">Photo size</span>
      {PHOTO_SIZES.map((s) => (
        <button
          key={s.id}
          type="button"
          aria-pressed={value === s.id}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onChange(s.id)}
          className={`${base} ${value === s.id ? pressed : idle}`}
        >
          {s.label}
        </button>
      ))}
    </div>
  )
}
