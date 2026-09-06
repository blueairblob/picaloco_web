import { useState } from 'react'
import type { CatalogPhoto } from '@/types/catalog'
import { getThumbnailUrl } from '@/services/images'
import { MetadataRow } from './MetadataRow'

export function PhotoDetailView({ photo }: { photo: CatalogPhoto }) {
  const [imageFailed, setImageFailed] = useState(false)
  const builders = (photo.builders ?? []).filter((b) => b.builder_name || b.builder_code)

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[3fr_2fr]">
      <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
        {imageFailed ? (
          <div className="flex aspect-[4/3] items-center justify-center text-[var(--muted)]">
            Image not yet available
          </div>
        ) : (
          <img
            src={getThumbnailUrl(photo.image_no)}
            alt={photo.description ?? photo.image_no}
            onError={() => setImageFailed(true)}
            className="w-full object-contain"
          />
        )}
      </div>

      <div>
        <span className="inline-block rounded-full bg-[var(--accent)]/10 px-3 py-1 font-mono text-sm text-[var(--accent)]">
          {photo.image_no}
        </span>
        {photo.description && (
          <p className="mt-4 text-base leading-relaxed text-[var(--foreground)]">{photo.description}</p>
        )}

        <div className="mt-6">
          <MetadataRow label="Category" value={photo.category} />
          <MetadataRow label="Date taken" value={photo.date_taken ?? photo.imprecise_date} />
          <MetadataRow label="Circa" value={photo.circa} />
          <MetadataRow label="Photographer" value={photo.photographer} />
          <MetadataRow label="Location" value={photo.location} />
          <MetadataRow label="Route" value={photo.route} />
          <MetadataRow
            label="Organisation"
            value={
              photo.organisation
                ? `${photo.organisation}${photo.organisation_type ? ` (${photo.organisation_type})` : ''}`
                : null
            }
          />
          <MetadataRow label="Country" value={photo.country} />
          <MetadataRow label="Gauge" value={photo.gauge} />
          <MetadataRow label="Active area" value={photo.active_area} />
          <MetadataRow label="Corporate body" value={photo.corporate_body} />
          <MetadataRow label="Facility" value={photo.facility} />
          <MetadataRow label="Collection" value={photo.collection} />
        </div>

        {builders.length > 0 && (
          <div className="mt-6 border-t border-[var(--border)] pt-4">
            <h2 className="mb-2 text-sm font-medium text-[var(--foreground)]">Builders</h2>
            <ul className="flex flex-col gap-2">
              {builders.map((b, i) => (
                <li key={i} className="text-sm text-[var(--muted)]">
                  {b.builder_name}
                  {b.builder_code ? ` (${b.builder_code})` : ''}
                  {b.works_number ? ` — works no. ${b.works_number}` : ''}
                  {b.year_built ? `, ${b.year_built}` : ''}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}
