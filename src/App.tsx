import { Link, Route, Routes } from 'react-router-dom'
import { Header } from '@/components/layout/Header'
import { SearchPage } from '@/pages/SearchPage'
import { PhotoDetailPage } from '@/pages/PhotoDetailPage'
import { AdminPage } from '@/pages/AdminPage'
import { NotFoundPage } from '@/pages/NotFoundPage'

export function App() {
  return (
    <>
      <Header />
      <Routes>
        <Route path="/" element={<SearchPage />} />
        <Route path="/photo/:imageNo" element={<PhotoDetailPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
      <footer className="mx-auto w-full max-w-6xl px-6 py-6 text-center">
        <Link to="/admin" className="text-xs text-[var(--muted)] no-underline hover:text-[var(--accent)]">
          Migration status
        </Link>
      </footer>
    </>
  )
}
