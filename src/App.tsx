import { useEffect, useState } from 'react'
import { Route, Routes, useHref, useLocation, useNavigate } from 'react-router-dom'
import { RouterProvider } from 'react-aria-components'
import { Header } from '@/components/layout/Header'
import { AppSidebar } from '@/components/layout/AppSidebar'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { SearchPage } from '@/pages/SearchPage'
import { PhotoDetailPage } from '@/pages/PhotoDetailPage'
import { AdminPage } from '@/pages/AdminPage'
import { DataFixesPage } from '@/pages/DataFixesPage'
import { FixQueuePage } from '@/pages/FixQueuePage'
import { ModelCheckPage } from '@/pages/ModelCheckPage'
import { ModelCheckQueuePage } from '@/pages/ModelCheckQueuePage'
import { RequireAdmin } from '@/components/admin/RequireAdmin'
import { AdminSessionProvider } from '@/components/admin/AdminSessionProvider'
import { ApprovalsPage } from '@/pages/ApprovalsPage'
import { ChangesPage } from '@/pages/ChangesPage'
import { VolunteersPage } from '@/pages/VolunteersPage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { useTextSize } from '@/hooks/useTextSize'
import { readSidebarOpen } from '@/lib/sidebarCookie'

export function App() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  // Read once: the provider writes the cookie on every toggle but never reads it back.
  const [sidebarOpen] = useState(readSidebarOpen)
  // The Data Fixes and model check photo pages.
  const reviewing = pathname.startsWith('/admin/fixes') || pathname.startsWith('/admin/model-check')
  useTextSize() // applies the stored text size on load
  // These pages scale their text with the window (see .scale-text in index.css).
  useEffect(() => {
    document.documentElement.classList.toggle('scale-text', reviewing)
  }, [reviewing])
  // One shared sign-in session and role for the sidebar, the guards and every page.
  // RouterProvider: the sidebar's react-aria links navigate in-app instead of reloading the page.
  return (
    <AdminSessionProvider>
      <RouterProvider navigate={navigate} useHref={useHref}>
        <SidebarProvider defaultOpen={sidebarOpen}>
          <AppSidebar />
          <SidebarInset>
            <Header />
            <Routes>
              <Route path="/" element={<SearchPage />} />
              <Route path="/photo/:imageNo" element={<PhotoDetailPage />} />
              <Route path="/admin" element={<AdminPage />} />
              <Route path="/admin/volunteers" element={<RequireAdmin><VolunteersPage /></RequireAdmin>} />
              <Route path="/admin/approvals" element={<RequireAdmin><ApprovalsPage /></RequireAdmin>} />
              <Route path="/admin/changes" element={<RequireAdmin><ChangesPage /></RequireAdmin>} />
              <Route path="/admin/fixes" element={<RequireAdmin allowVolunteers><DataFixesPage /></RequireAdmin>} />
              <Route path="/admin/fixes/:fixId" element={<RequireAdmin allowVolunteers><FixQueuePage /></RequireAdmin>} />
              <Route path="/admin/model-check" element={<RequireAdmin allowVolunteers><ModelCheckPage /></RequireAdmin>} />
              <Route path="/admin/model-check/:taskId" element={<RequireAdmin allowVolunteers><ModelCheckQueuePage /></RequireAdmin>} />
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </SidebarInset>
        </SidebarProvider>
      </RouterProvider>
    </AdminSessionProvider>
  )
}
