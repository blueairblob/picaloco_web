# shadcn Sidebar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the slide-in MenuPanel with shadcn's Sidebar (React Aria variant, `collapsible="offcanvas"`), with Settings and the account in its footer.

**Architecture:**
- The shadcn CLI copies the Sidebar source into `src/components/ui/`.
- Its colour tokens map onto the existing CSS variables, so all four `data-theme` themes keep working.
- An `AppSidebar` component builds the nav from the existing `menuSections` and `isCurrent` helpers.
- `SidebarProvider` and `SidebarInset` wrap the app layout.

**Tech Stack:** Vite, React 19, TS, Tailwind v4, the shadcn CLI (npm, `package-lock.json`), vitest, oxlint.

**Spec:** `picaloco_web/docs/superpowers/specs/2026-11-25-shadcn-sidebar-design.md`

Repo: W = `/mnt/d/dev/PROJECTS/RAT_Trains_Project/work_picaloco_dev/picaloco_web`, branch `ai-volunteer`.

## Global Constraints

- **shadcn:** use the real component added by the CLI (`npx shadcn@latest add sidebar`, React Aria variant). Add only what the Sidebar pulls in. If the CLI asks for a style or base colour, take the defaults; the tokens are overridden in `src/index.css` anyway.
- **Collapse:** `collapsible="offcanvas"` (collapses completely). Never `icon`.
- **Theme:** no `.dark` class. Every shadcn token used by the added components maps to existing variables (`--surface`, `--foreground`, `--muted`, `--border`, `--accent`, `--accent-foreground`, `--background`) under `:root`. The `data-theme` overrides then follow automatically.
- **Copy:**
  - the header title reads `RAT Photo Archive`;
  - the first item reads `Search the archive` and links to `/`;
  - the footer shows `Settings`, then the email with `Sign out`, or `Sign in (admin)` linking to `/admin/fixes`.
  - Archive workflow and People keep `menuSections`' titles, labels and hints. The trainee note is kept, and the held count shows as a `SidebarMenuBadge` on Approvals for admins only.
- **Checks:** `npm test`, `npm run lint` (the one existing ModelCheckQueuePage warning is allowed) and `npm run build` pass.
- **Rules:** never read `.env*`, and stage files by path, never `.superpowers/`. Commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Keys typed while focus is in the sidebar or the phone sheet** must not trigger the review pages' window shortcuts (u/n/x/s/e/arrows/digits). Pinned in Task 2 (the browser check plus the guard).
2. **Following a link on a phone** closes the sheet. Pinned in Task 2 (`setOpenMobile(false)` on navigation).
3. **The bespoke and dark themes:** sidebar text, borders and the active item stay readable. Pinned in Task 1 (token map) and the Task 2 browser check.
4. **Signed-out and 'error' states** still offer Sign in or Sign out in the footer. Pinned in Task 2 (a pure `footerAccount(status, email)` helper with tests).
5. **The remembered open or closed state** survives a reload and never breaks rendering when storage or cookies are blocked. Pinned in Task 2 (the browser check).

---

### Task 1: Add shadcn and the Sidebar component, themed

**Files:**
- Create via the CLI: `components.json`, `src/lib/utils.ts`, `src/components/ui/*` (sidebar, plus its dependencies such as sheet, button, separator, tooltip, input, skeleton), and `src/hooks/use-mobile.ts` if the CLI generates it.
- Modify: `package.json`, `package-lock.json`, `src/index.css`.

**Interfaces:**
- Produces: the shadcn exports from `@/components/ui/sidebar` (`SidebarProvider`, `Sidebar`, `SidebarHeader`, `SidebarContent`, `SidebarFooter`, `SidebarGroup`, `SidebarGroupLabel`, `SidebarGroupContent`, `SidebarMenu`, `SidebarMenuItem`, `SidebarMenuButton`, `SidebarMenuBadge`, `SidebarInset`, `SidebarTrigger`, `useSidebar`) and `cn` from `@/lib/utils`.

- [ ] **Step 1:** Run the shadcn init and the Sidebar add for the React Aria variant (`npx shadcn@latest init` if needed, then `npx shadcn@latest add sidebar`). Choose React Aria where the CLI offers a choice.
- [ ] **Step 2:** Replace any CLI-written oklch token blocks or `.dark` blocks in `src/index.css` with mappings onto the existing variables. Keep Tailwind v4's `@theme inline` wiring if the components rely on it.
- [ ] **Step 3:** Check nothing else in the app changed appearance. Base-layer resets the CLI adds to `index.css` (for example a global `border-color` or `outline` rule) must not alter existing pages. Keep only what the Sidebar needs.
- [ ] **Step 4:** Run `npm test && npm run lint && npm run build`. Expected: pass. The new ui files may need narrowly scoped lint ignores if oxlint flags generated code; ledger what was ignored.
- [ ] **Step 5:** Commit `chore: add shadcn and its Sidebar component, mapped to the site's themes`.

### Task 2: AppSidebar replaces MenuPanel

**Files:**
- Create: `src/components/layout/AppSidebar.tsx`, `src/lib/sidebarFooter.ts` and its test.
- Modify: `src/App.tsx` (layout), `src/components/layout/Header.tsx` (`SidebarTrigger` replaces the Menu button), `src/pages/ModelCheckQueuePage.tsx` and `src/pages/FixQueuePage.tsx` (the shortcut guard, if needed).
- Delete: `src/components/layout/MenuPanel.tsx`, once nothing imports it.
- Keep: `SettingsDialog.tsx` and `useModalDialog.ts`.

**Interfaces:**
- Consumes: Task 1's exports; `menuSections` and `RoleStatus` (`src/lib/roles.ts`); `isCurrent` (`src/lib/menuPanel.ts`); `useAdminSession`; the `['people']` held-count query; `SettingsDialog`.
- Produces: `footerAccount(status: RoleStatus, email: string | null): { kind: 'signin' } | { kind: 'account'; email: string | null } | { kind: 'none' }`.
  - signed-out gives signin;
  - admin, volunteer, no-access and error give account;
  - loading gives none.

- [ ] **Step 1:** Write the failing test `footerAccount` for each status. Run `npx vitest run src/lib/sidebarFooter.test.ts`. Expected: FAIL.
- [ ] **Step 2:** Implement `footerAccount`, `AppSidebar` and the layout.
  - **Layout:** `<SidebarProvider defaultOpen>` → `<AppSidebar/>` + `<SidebarInset>`, holding the Header (with `SidebarTrigger`) and the routes.
  - **The sidebar:** `<Sidebar collapsible="offcanvas">`. The active item uses `isActive={isCurrent(path, pathname)}`.
  - **Phones:** on a route change call `setOpenMobile(false)`.
  - **Footer:** a Settings button opens `SettingsDialog`, with focus returning to it on close.
  - **Shortcut guard:** keydown events inside the sidebar or the phone sheet must not reach window shortcut listeners. Stop propagation on the Sidebar root, or extend the pages' guard to `[data-sidebar]` / `[data-slot="sidebar"]`, whichever the generated markup supports. Keep the existing `[aria-modal="true"]` guard.
- [ ] **Step 3:** Run `npm test && npm run lint && npm run build`. Expected: pass. `grep -r MenuPanel src` gives no hits.
- [ ] **Step 4:** Update `docs/ops-manual/facts.md` "Who sees what" and the DEVOPS line: navigation is a sidebar (≡ or Ctrl/Cmd+B), with Settings and the account at its foot.
- [ ] **Step 5:** Commit `feat: shadcn sidebar navigation with Settings and account in the footer`.
