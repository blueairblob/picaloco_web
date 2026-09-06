import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import type { CatalogPhoto } from '@/types/catalog'
import { getThumbnailUrl } from '@/services/images'

export function PhotoCard({ photo }: { photo: CatalogPhoto }) {
  const [imageFailed, setImageFailed] = useState(false)
  const [searchParams] = useSearchParams()
  const meta = [photo.category, photo.location, photo.date_taken].filter(Boolean).join(' · ')

  return (
    <Link
      to={`/photo/${encodeURIComponent(photo.image_no)}?from=${encodeURIComponent(searchParams.toString())}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] no-underline shadow-sm transition duration-150 hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="aspect-[4/3] w-full overflow-hidden bg-[var(--background)]">
        {imageFailed ? (
          <div className="flex h-full w-full items-center justify-center text-xs text-[var(--muted)]">
            Image not yet available
          </div>
        ) : (
          <img
            src={getThumbnailUrl(photo.image_no)}
            alt={photo.description ?? photo.image_no}
            loading="lazy"
            onError={() => setImageFailed(true)}
            className="h-full w-full object-cover transition duration-150 group-hover:scale-105"
          />
        )}
      </div>
      <div className="flex flex-col gap-1 p-4">
        <span className="font-mono text-xs text-[var(--muted)]">{photo.image_no}</span>
        {meta && <span className="text-sm text-[var(--foreground)]">{meta}</span>}
      </div>
    </Link>
  )
}
