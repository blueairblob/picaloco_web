import { Link } from 'react-router-dom'
import { SidebarTrigger, useSidebar } from '@/components/ui/sidebar'
import { Tooltip, TooltipTrigger } from '@/components/ui/tooltip'

export function Header() {
  const { isMobile, open, openMobile } = useSidebar()
  return (
    <header className="site-header border-b border-[var(--border)] bg-[var(--surface)]/80 backdrop-blur sticky top-0 z-10">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-6 py-4">
        <TooltipTrigger delay={500}>
          <SidebarTrigger
            aria-label="Menu (Ctrl/Cmd+B)"
            aria-expanded={isMobile ? openMobile : open}
            className="size-11 rounded-full border border-[var(--border)] text-[var(--foreground)] hover:border-[var(--accent)] hover:text-[var(--accent)] [&_svg:not([class*='size-'])]:size-5"
          />
          <Tooltip placement="bottom">Menu (Ctrl/Cmd+B)</Tooltip>
        </TooltipTrigger>
        <Link to="/" className="site-title text-lg font-semibold tracking-tight text-[var(--foreground)] no-underline">
          RAT Photo Archive
        </Link>
      </div>
    </header>
  )
}
