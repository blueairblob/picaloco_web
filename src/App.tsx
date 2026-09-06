import { Route, Routes } from 'react-router-dom'
import { Header } from '@/components/layout/Header'
import { SearchPage } from '@/pages/SearchPage'
import { PhotoDetailPage } from '@/pages/PhotoDetailPage'
import { NotFoundPage } from '@/pages/NotFoundPage'

export function App() {
  return (
    <>
      <Header />
      <Routes>
        <Route path="/" element={<SearchPage />} />
        <Route path="/photo/:imageNo" element={<PhotoDetailPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </>
  )
}
