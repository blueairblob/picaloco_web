import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { LogInIcon, LogOutIcon, SearchIcon, SettingsIcon } from 'lucide-react'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  useSidebar,
} from '@/components/ui/sidebar'
import { useAdminSession } from '@/hooks/useAdminSession'
import { menuSections } from '@/lib/roles'
import { isCurrent } from '@/lib/menuPanel'
import { footerAccount } from '@/lib/sidebarFooter'
import { listPeople } from '@/services/volunteerService'
import { SettingsDialog } from './SettingsDialog'

// The header's trigger: where focus goes when the sidebar it was in closes or its button goes away.
function focusTrigger() {
  document.querySelector<HTMLElement>('[data-sidebar="trigger"]')?.focus()
}

export function AppSidebar() {
  const { pathname, key } = useLocation()
  const { status, email, inTraining, signOut } = useAdminSession()
  const { isMobile, state, openMobile, setOpenMobile } = useSidebar()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const settingsButton = useRef<HTMLButtonElement>(null)

  // Same key as the Volunteers page, so the count and that page share one fetch.
  const people = useQuery({ queryKey: ['people'], queryFn: listPeople, enabled: status === 'admin' })
  const heldTotal = (people.data ?? []).reduce((n, p) => n + p.held_count, 0)

  // Phones: following a link closes the sheet (every navigation gets a new key, even to this page).
  useEffect(() => {
    setOpenMobile(false)
  }, [key, setOpenMobile])

  // Wide screens: collapsing (Ctrl/Cmd+B or the trigger) while focus is inside would drop it to
  // <body> once the sidebar goes inert, so hand it to the trigger. focusin tracks the last focus,
  // since the browser may already have blurred it by the time this runs.
  const focusInside = useRef(false)
  useEffect(() => {
    const onFocusIn = (e: FocusEvent) => {
      focusInside.current = e.target instanceof Element && !!e.target.closest('[data-slot="sidebar"]')
    }
    document.addEventListener('focusin', onFocusIn)
    return () => document.removeEventListener('focusin', onFocusIn)
  }, [])
  useLayoutEffect(() => {
    if (isMobile || state !== 'collapsed' || !focusInside.current) return
    const active = document.activeElement
    if (!active || active === document.body || active.closest('[data-slot="sidebar"]')) focusTrigger()
  }, [isMobile, state])

  // On phones Settings lives inside the sheet, so closing the sheet by any route forgets it.
  if (isMobile && !openMobile && settingsOpen) {
    setSettingsOpen(false)
  }

  const account = footerAccount(status, email)

  // Phones: inside the sheet, which keeps focus and hides everything outside it.
  // Wide screens: on top of the page (the sidebar's own layer sits under the header).
  const settings = (
    <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} returnFocusTo={settingsButton} />
  )

  return (
    // A closed wide-screen sidebar is only moved off screen: inert keeps Tab out of it.
    <Sidebar collapsible="offcanvas" inert={!isMobile && state === 'collapsed'}>
      <SidebarHeader>
        <div className="px-2 py-1 text-base font-semibold tracking-tight">RAT Photo Archive</div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                href="/"
                isActive={isCurrent('/', pathname)}
                aria-current={isCurrent('/', pathname) ? 'page' : undefined}
              >
                <SearchIcon aria-hidden="true" />
                <span>Search the archive</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>

        {menuSections(status, inTraining).map((section) => (
          <SidebarGroup key={section.title}>
            <SidebarGroupLabel>{section.title}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {section.items.map((step, i) => {
                  const held = step.path === '/admin/approvals' && status === 'admin' && heldTotal > 0
                  return (
                    <SidebarMenuItem key={step.path}>
                      <SidebarMenuButton
                        href={step.path}
                        isActive={isCurrent(step.path, pathname)}
                        aria-current={isCurrent(step.path, pathname) ? 'page' : undefined}
                        size={step.hint ? 'lg' : 'default'}
                        className={step.hint ? 'h-auto min-h-12' : undefined}
                      >
                        <span aria-hidden="true" className="flex size-4 shrink-0 items-center justify-center text-xs text-sidebar-foreground/70">
                          {i + 1}
                        </span>
                        <span className="flex min-w-0 flex-col leading-tight">
                          <span className="truncate">{step.label}</span>
                          {step.hint && <span className="text-xs whitespace-normal text-sidebar-foreground/70">{step.hint}</span>}
                          {held && <span className="sr-only">{`, ${heldTotal} held`}</span>}
                        </span>
                      </SidebarMenuButton>
                      {held && <SidebarMenuBadge aria-hidden="true">{heldTotal}</SidebarMenuBadge>}
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
              {section.note && <p className="px-2 py-1 text-xs text-sidebar-foreground/70">{section.note}</p>}
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarSeparator />
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton ref={settingsButton} onPress={() => setSettingsOpen(true)}>
              <SettingsIcon aria-hidden="true" />
              <span>Settings</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          {account.kind === 'signin' && (
            <SidebarMenuItem>
              <SidebarMenuButton href="/admin/fixes">
                <LogInIcon aria-hidden="true" />
                <span>Sign in (admin)</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
          {account.kind === 'account' && (
            <>
              {account.email && (
                <div className="truncate px-2 pt-1 text-xs text-sidebar-foreground/70" title={account.email}>
                  {account.email}
                </div>
              )}
              <SidebarMenuItem>
                <SidebarMenuButton
                  onPress={() => {
                    // Phones: closing the sheet returns focus to the trigger. Wide screens: this
                    // button goes away once signed out, so focus moves there first.
                    if (isMobile) setOpenMobile(false)
                    else focusTrigger()
                    void signOut()
                  }}
                >
                  <LogOutIcon aria-hidden="true" />
                  <span>Sign out</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </>
          )}
        </SidebarMenu>
      </SidebarFooter>

      {isMobile ? settings : createPortal(settings, document.body)}
    </Sidebar>
  )
}
