import { useEffect } from 'react'
import { Route, Routes, useLocation } from 'react-router-dom'
import { Header } from '@/components/layout/Header'
import { SearchPage } from '@/pages/SearchPage'
import { PhotoDetailPage } from '@/pages/PhotoDetailPage'
import { AdminPage } from '@/pages/AdminPage'
import { DataFixesPage } from '@/pages/DataFixesPage'
import { FixQueuePage } from '@/pages/FixQueuePage'
import { ModelCheckPage } from '@/pages/ModelCheckPage'
import { ModelCheckQueuePage } from '@/pages/ModelCheckQueuePage'
import { RequireAdmin } from '@/components/admin/RequireAdmin'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { useTextSize } from '@/hooks/useTextSize'

export function App() {
  const { pathname } = useLocation()
  // The Data Fixes and model check photo pages.
  const reviewing = pathname.startsWith('/admin/fixes') || pathname.startsWith('/admin/model-check')
  useTextSize() // applies the stored text size on load
  // These pages scale their text with the window (see .scale-text in index.css).
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
        <Route path="/admin/model-check" element={<RequireAdmin><ModelCheckPage /></RequireAdmin>} />
        <Route path="/admin/model-check/:taskId" element={<RequireAdmin><ModelCheckQueuePage /></RequireAdmin>} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </>
  )
}
