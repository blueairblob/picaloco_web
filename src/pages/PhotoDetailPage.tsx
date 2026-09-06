import { useQuery } from '@tanstack/react-query'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { getByImageNo } from '@/services/catalogService'
import { PhotoDetailView } from '@/components/detail/PhotoDetailView'
import { NotFoundPage } from './NotFoundPage'

export function PhotoDetailPage() {
  const { imageNo = '' } = useParams<{ imageNo: string }>()
  const [searchParams] = useSearchParams()
  const backHref = searchParams.get('from') ? `/?${searchParams.get('from')}` : '/'

  const { data, isLoading, isError } = useQuery({
    queryKey: ['photo', imageNo],
    queryFn: () => getByImageNo(imageNo),
    enabled: Boolean(imageNo),
  })

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
      <Link
        to={backHref}
        className="mb-6 inline-flex items-center gap-1 text-sm font-medium text-[var(--muted)] no-underline hover:text-[var(--accent)]"
      >
        ← Back to results
      </Link>

      {isLoading && <div className="text-[var(--muted)]">Loading…</div>}
      {isError && (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-10 text-center text-[var(--muted)]">
          Something went wrong talking to the archive. Please try again.
        </div>
      )}
      {!isLoading && !isError && !data && <NotFoundPage />}
      {data && <PhotoDetailView photo={data} />}
    </div>
  )
}
