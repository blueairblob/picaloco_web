import type { CatalogPhoto } from '@/types/catalog'
import { PhotoCard } from './PhotoCard'

function SkeletonCard() {
  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
      <div className="aspect-[4/3] w-full animate-pulse bg-[var(--border)]" />
      <div className="flex flex-col gap-2 p-4">
        <div className="h-3 w-1/2 animate-pulse rounded bg-[var(--border)]" />
        <div className="h-3 w-3/4 animate-pulse rounded bg-[var(--border)]" />
      </div>
    </div>
  )
}

interface PhotoGridProps {
  photos: CatalogPhoto[]
  isLoading: boolean
  isError: boolean
}

export function PhotoGrid({ photos, isLoading, isError }: PhotoGridProps) {
  if (isError) {
    return (
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-10 text-center text-[var(--muted)]">
        Something went wrong talking to the archive. Please try again.
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 12 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    )
  }

  if (photos.length === 0) {
    return (
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-10 text-center text-[var(--muted)]">
        No photos match — try clearing a filter or broadening your search.
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
      {photos.map((photo) => (
        <PhotoCard key={photo.image_no} photo={photo} />
      ))}
    </div>
  )
}
