import { useState, type MouseEvent } from 'react'
import { REVIEW_PHOTO_HEIGHT, type PhotoSize } from '@/lib/photoSize'
import { getReviewImageUrl } from '@/services/images'

export function ZoomImage({ imageNo, photoSize }: { imageNo: string; photoSize: PhotoSize }) {
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
