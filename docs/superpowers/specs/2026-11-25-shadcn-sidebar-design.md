# shadcn Sidebar navigation: design

Date: 2026-11-25. Status: draft for approval.
This replaces section 3 (the slide-in menu) of `2026-11-24-changes-table-and-nav-design.md`. The Settings window and the Changes page work stay as they are.

## Intent

The user wants the navigation to look and behave like the shadcn Sidebar (https://ui.shadcn.com/docs/components/aria/sidebar), and gave two caveats:

- It collapses completely, to nothing, not to an icon strip.
- Settings and the account sit at the bottom.

The thick-client tools in the filemaker repos (tkinter today) are to move to Electron, so shadcn/ui becomes the shared React UI kit. The real component is installed rather than imitated, so the Electron app can reuse it.

## Decisions (user)

- **The kit:** shadcn's actual Sidebar component (React Aria variant), installed with the shadcn CLI.
- **Collapse:** `collapsible="offcanvas"` (collapses completely); never `icon`.
- **Footer:** Settings and the account at the bottom of the sidebar.

## Design

- **Setup:** add shadcn to picaloco_web with the CLI: `components.json`, `src/lib/utils.ts` (`cn`), `src/components/ui/`, and whatever dependencies the Sidebar needs.
  - The existing `@/*` alias already points at `src`.
  - Add only the components the Sidebar needs (plus Sheet for phones). Nothing extra.
- **Theme:** map shadcn's tokens onto the existing colour variables in `src/index.css`, so all four themes (light, dark, bespoke, system, set through `data-theme`) keep working without a `.dark` class. For example, `--sidebar: var(--surface)`, `--sidebar-foreground: var(--foreground)`, `--sidebar-border: var(--border)`, `--sidebar-accent` from `--accent`, `--sidebar-ring: var(--accent)`, and the same for any base tokens the components read (`--background`, `--foreground`, `--muted-foreground` and so on).
  - shadcn's own oklch palette is not used.
- **Layout:**
  - `SidebarProvider` wraps the app (inside the existing providers).
  - The page content goes in `SidebarInset`.
  - The header gets a `SidebarTrigger` where the Menu button is now.
  - Wide screens: the sidebar sits beside the content and pushes it across. The trigger and Ctrl/Cmd+B open and close it, and it stays closed or open across visits.
  - Phones: it opens as a sheet over the page.
  - Default: open on wide screens.
- **Contents, top to bottom:**
  - **`SidebarHeader`:** "RAT Photo Archive".
  - **`SidebarContent`:** these groups, using `SidebarGroup` and `SidebarGroupLabel`:
    - Search the archive.
    - Archive workflow (role-filtered `menuSections`, with the hints as secondary text and the trainee note).
    - People, for admins, with the held count as a `SidebarMenuBadge` on Approvals.
    - The current page uses `isActive` from the existing `isCurrent`.
  - **`SidebarFooter`:**
    - Settings, which opens the existing Settings window.
    - The account: email and Sign out, or "Sign in (admin)" when signed out.
  - On phones, the sheet closes after following a link.
- **Removed:** `MenuPanel.tsx` and the panel half of `useModalDialog`'s callers. The Settings window keeps `useModalDialog`.
- **Kept:** `menuSections`, `isCurrent`, the held-count query, the in-page `AdminSteps` nav, and every behaviour from today's menu (role and state handling, including the 'error' state showing the email and Sign out).
- **Accessibility:** the shadcn component's own keyboard and ARIA handling is used. Keys pressed inside the sidebar must not trigger the review pages' shortcuts, so the existing `[aria-modal="true"]`-style guard is extended to the sidebar and sheet, or the sidebar stops propagation the way the panel did.

## Testing

- vitest stays lib-level: the existing `menuSections` and `isCurrent` tests, plus any new pure helper.
- `npm test`, `npm run lint` and `npm run build` pass.
- Browser check by the controller on a local dev server:
  - toggle, Ctrl/Cmd+B, and the remembered state;
  - phone width shows a sheet that closes when you follow a link;
  - the footer Settings opens the window;
  - typing in the sidebar doesn't trigger page shortcuts;
  - light and dark themes.

## Left to the builder

- Sidebar width: shadcn's default, about 16rem.
- Icons for items: optional, from whichever icon set the Sidebar install brings (lucide).
- The exact token mapping, as long as every theme reads correctly.
