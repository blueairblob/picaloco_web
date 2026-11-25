import { Link } from 'react-router-dom'
import { SidebarTrigger, useSidebar } from '@/components/ui/sidebar'

export function Header() {
  const { isMobile, open, openMobile } = useSidebar()
  return (
    <header className="site-header border-b border-[var(--border)] bg-[var(--surface)]/80 backdrop-blur sticky top-0 z-10">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link to="/" className="site-title text-lg font-semibold tracking-tight text-[var(--foreground)] no-underline">
          RAT Photo Archive
        </Link>
        <SidebarTrigger
          aria-expanded={isMobile ? openMobile : open}
          className="size-11 rounded-full border border-[var(--border)] text-[var(--foreground)] hover:border-[var(--accent)] hover:text-[var(--accent)] [&_svg:not([class*='size-'])]:size-5"
        />
      </div>
    </header>
  )
}
