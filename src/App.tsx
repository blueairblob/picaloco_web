import { useEffect } from 'react'
import { Link, Route, Routes, useLocation } from 'react-router-dom'
import { Header } from '@/components/layout/Header'
import { SearchPage } from '@/pages/SearchPage'
import { PhotoDetailPage } from '@/pages/PhotoDetailPage'
import { AdminPage } from '@/pages/AdminPage'
import { DataFixesPage } from '@/pages/DataFixesPage'
import { FixQueuePage } from '@/pages/FixQueuePage'
import { RequireAdmin } from '@/components/admin/RequireAdmin'
import { NotFoundPage } from '@/pages/NotFoundPage'

export function App() {
  const { pathname } = useLocation()
  const reviewing = pathname.startsWith('/admin/fixes')
  // The Data Fixes pages scale their text with the window (see .scale-text in index.css).
  useEffect(() => {
    document.documentElement.classList.toggle('scale-text', reviewing)
  }, [reviewing])
  return (
    <>
      <Header />
      <Routes>
        <Route path="/" element={<SearchPage />} />
        <Route path="/photo/:imageNo" element={<PhotoDetailPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/admin/fixes" element={<RequireAdmin><DataFixesPage /></RequireAdmin>} />
        <Route path="/admin/fixes/:fixId" element={<RequireAdmin><FixQueuePage /></RequireAdmin>} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
      {/* Not on the review pages: every line of height there goes to the photo. */}
      {!reviewing && (
        <footer className="mx-auto w-full max-w-6xl px-6 py-6 text-center">
          <Link to="/admin" className="text-xs text-[var(--muted)] no-underline hover:text-[var(--accent)]">
            Migration status
          </Link>
        </footer>
      )}
    </>
  )
}
