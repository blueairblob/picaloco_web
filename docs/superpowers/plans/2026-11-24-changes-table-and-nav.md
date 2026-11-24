# Changes Table and Slide-in Menu Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the Changes page a question picker and a then-and-now table with photo links, make admin dropdowns follow the theme, and replace the Menu dropdown with a slide-in panel plus a Settings window.

**Architecture:**
- One SQL change: `rat.change_list` gains question filters. The rest is picaloco_web.
- The pure decisions live in small tested `src/lib` helpers: Show → kinds, question → params and headings, and cell and status text.
- Both dialogs share one focus and close hook.

**Tech Stack:** PostgreSQL 17 + pytest on Docker (F); Vite, React 19, TS, Tailwind, React Query, vitest, oxlint (W).

**Spec:** `picaloco_web/docs/superpowers/specs/2026-11-24-changes-table-and-nav-design.md`

Repos: F = `/mnt/d/dev/PROJECTS/RAT_Trains_Project/work_picaloco_dev/filemaker_sync`, W = `/mnt/d/dev/PROJECTS/RAT_Trains_Project/work_picaloco_dev/picaloco_web`. Both are on branch `ai-volunteer`.

## Global Constraints

- **F:**
  - SQL goes in `supabase/schema/add_volunteer_tables.sql`, and the bootstrap copy between its markers stays byte-identical.
  - The file stays idempotent. A changed signature means `DROP FUNCTION IF EXISTS <exact old signature>`, then CREATE, then EXECUTE for authenticated only.
  - Tests use the Docker `pg` fixture, never live.
- **W:**
  - `npm test`, `npm run lint` (the one existing ModelCheckQueuePage warning is allowed) and `npm run build` all pass.
  - Never read `.env*`, never run the dev server, never call live endpoints.
- **Copy, verbatim from the spec:**
  - Question options: each Data fix title, then each Model check question, then `All questions`. The default is the first Data fix.
  - Show options: `All`, `Reviews and answers`, `Held for approval`, `Undos`.
  - Column headings: `Photo`, `Then`, `Now`, `By / when`, `Status`. For a Model check question, Then and Now read `AI said` and `Answer`.
  - A blind sample shows `blind`.
  - Status text: `✓ {approver}`, `held`, `rejected: {note}` (or `rejected` when there's no note), `undo`, `withdrawn`, `undone`.
- **Then/Now cells for Data fixes:** the status label and the values joined with `; `, e.g. `Verified 4073`. The status `extracted` reads `Suggested`; other statuses use `STATUS_LABEL` from `src/lib/fixStatusLabel.ts`.
- **Commits** end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Never stage `.env*` or `.superpowers/`.

## Review Focus

1. **Both question filters set** (`p_fix_id` and `p_task_id`): the server refuses with 22023 rather than returning nothing. Pinned in Task 1.
2. **A Model check answer id the task's answer list doesn't know:** the cell shows the raw id, never blank. Pinned in Task 3.
3. **A question with no changes:** "No changes match." shows, not an empty table frame. Pinned in Task 3 (helper `tableMode`).
4. **The panel stays open after navigation:** following any link, and pressing the browser's back button, closes it. Pinned in Task 4 (helper `shouldCloseOnRoute`).
5. **"Undo all" under "Undos":** it includes `fix_undo` rows and never `answer_withdrawn` rows (withdrawals aren't undoable). Pinned in Task 2.

---

### Task 1 (F): change_list filters by question

**Files:** Modify `F/supabase/schema/add_volunteer_tables.sql` and its bootstrap copy. Test `F/tests/test_volunteer_schema.py`.

**Interfaces:**
- Produces: `rat.change_list(p_user uuid DEFAULT NULL, p_from timestamptz DEFAULT NULL, p_to timestamptz DEFAULT NULL, p_kinds text[] DEFAULT NULL, p_after text DEFAULT NULL, p_limit integer DEFAULT 100, p_fix_id text DEFAULT NULL, p_task_id text DEFAULT NULL)`. The result columns are unchanged. Drop the old 6-argument signature first.
- **Matching:**
  - `p_fix_id` matches history rows and `pending_fix_review` rows with that fix_id.
  - `p_task_id` matches `model_answer` rows, withdrawals (joined through their answer) and `pending_model_answer` rows with that task_id.
  - Both set: 22023 `'pick one question'`.
  - Neither set: everything, as today.

- [ ] **Step 1:** Write the failing tests:
  - `test_change_list_fix_filter`: a review on `loco_number` and one on `loco_name`, plus a held fix on `loco_number`. Filtering on `loco_number` returns exactly the `loco_number` events.
  - `test_change_list_task_filter`: an answer, a withdrawal and a held answer on task A, and an answer on task B. Filtering on A returns only A's three.
  - `test_change_list_one_question_only`: both filters set → pgcode `22023`.
  - `test_change_list_no_question_is_all`.
- [ ] **Step 2:** Run `venv/bin/pytest tests/test_volunteer_schema.py -q -k change_list`. Expected: the new tests FAIL.
- [ ] **Step 3:** Implement. Keep the bootstrap copy identical.
- [ ] **Step 4:** Run `venv/bin/pytest tests/ -q`. Expected: all pass.
- [ ] **Step 5:** Commit `feat: change list filters by question`.

### Task 2 (W): themed dropdowns, the Show filter and question params

**Files:**
- Create: `W/src/lib/changeFilters.ts` and its test.
- Modify: `W/src/lib/changeRow.ts` and its test, `W/src/services/changeService.ts` and its test, `W/src/pages/ChangesPage.tsx` (filters only), `W/src/components/admin/modelCheck/ModelTaskCard.tsx` (select class).
- Export `INPUT_CLASS` from `W/src/components/search/filterFields.tsx` if it isn't already, and make sure it includes `bg-[var(--surface)]`.

**Interfaces:**
- Produces in `changeFilters.ts`:
  - `type ShowMode = 'all' | 'reviews' | 'held' | 'undos'`.
  - `SHOW_OPTIONS: [ShowMode, string][]` with the exact labels.
  - `showKinds(mode: ShowMode): string[] | undefined`. `all` gives undefined; `reviews` gives `['fix_review','fix_model_check','answer']`; `held` gives `['held_submitted','held_approved','held_rejected']`; `undos` gives `['fix_undo','answer_withdrawn']`.
  - `type Question = { kind: 'fix'; id: string; label: string } | { kind: 'task'; id: string; label: string } | { kind: 'all' }`.
  - `questionOptions(fixes: {id: string; title: string}[], tasks: {id: string; question: string}[]): Question[]`: fixes in the order given, then tasks, then `{kind:'all'}`.
  - `questionParams(q: Question): { fixId?: string; taskId?: string }`.
  - `questionKey(q: Question): string` and `parseQuestionKey(key: string, options: Question[]): Question`, for the `<select>` value.
- `changeRow.ts`: `bulkUndoRows(rows, mode: ShowMode)` and `excludedUndoCount(rows, mode: ShowMode)`. Undo rows are included only when `mode === 'undos'`.
- `ChangeFilters` gains `fixId?: string; taskId?: string`, sent as `p_fix_id` and `p_task_id`, with `null` when absent.

- [ ] **Step 1:** Write the failing tests:
  - `showKinds` for all four modes.
  - `questionOptions` order and the trailing `all`.
  - `questionParams` for each kind.
  - `questionKey` and `parseQuestionKey` round-trip.
  - `bulkUndoRows` with mode `undos` includes `fix_undo` and never `answer_withdrawn`, and other modes exclude `fix_undo`.
  - `listChanges` sends `p_fix_id` and `p_task_id`.
- [ ] **Step 2:** Run `npx vitest run src/lib src/services/changeService.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement.
  - The page's Kind select becomes Show (default `all`). A Question select comes first, filled from the existing `getFixes()` (dataFixService) and `getTasks()` (modelCheckService), defaulting to the first fix.
  - Every admin `<select>` uses `INPUT_CLASS`.
- [ ] **Step 4:** Run `npm test && npm run lint && npm run build`. Expected: pass.
- [ ] **Step 5:** Commit `feat: question and show filters; dropdowns follow the theme`.

### Task 3 (W): the then-and-now table

**Files:**
- Create: `W/src/lib/changeTable.ts` and its test.
- Modify: `W/src/pages/ChangesPage.tsx` (the list becomes a table on `sm`+ and cards below).

**Interfaces:**
- Consumes `Question` and `ShowMode` (Task 2) and `ChangeRow` (`changeRow.ts`).
- Produces in `changeTable.ts`:
  - `headings(q: Question): { then: string; now: string; showQuestion: boolean }`. fix: `Then`/`Now`, false. task: `AI said`/`Answer`, false. all: `Then`/`Now`, true.
  - `cellText(row: ChangeRow, answerLabel?: (taskAnswerId: string) => string | undefined): { then: string; now: string }`.
    - fix kinds and held fix rows use the status label plus values.
    - Answers: then is the shown answer or `blind`; now is the answer's label, or the raw id when unknown.
    - `answer_withdrawn`: then is empty; now is the note or empty.
  - `statusText(row: ChangeRow, emailOf: (id: string | null) => string): string`, in the global copy:
    - `undone` wins over everything;
    - `held_approved` and rows with `approved_by` give `✓ {emailOf(approver)}`. For `held_approved`, the approver is `by_user`.
  - `tableMode(loading: boolean, error: boolean, rowCount: number): 'loading' | 'error' | 'empty' | 'rows'`.
- **Answer labels** come from the tasks' `answers` list (the `ModelTask` type already read by `getTasks()`), mapped from id to label.

- [ ] **Step 1:** Write the failing tests:
  - `headings` for the three question kinds.
  - `cellText`: a fix review shows `Suggested 4073` → `Verified 4073`; a sample answer shows `blind` → label; an unknown answer id gives the raw id; a withdrawal; a held fix.
  - `statusText` for each status in the global copy, including `undone` winning and `rejected` without a note.
  - `tableMode`: empty when not loading and no rows.
- [ ] **Step 2:** Run `npx vitest run src/lib/changeTable.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement the helpers and the page.
  - Photo cell: a 48px `getThumbnailUrl(image_no)` image plus the image number, inside `<a href="/photo/{image_no}" target="_blank" rel="noopener">`.
  - When `headings(q).showQuestion`, a Question column after Photo shows `row.subject`.
  - Undone rows: muted text.
  - Below `sm`: one card per row with the same parts.
  - Keep paging, the summaries, the confirmation copy and Undo exactly as they are.
- [ ] **Step 4:** Run `npm test && npm run lint && npm run build`. Expected: pass.
- [ ] **Step 5:** Commit `feat: Changes page as a then-and-now table with photo links`.

### Task 4 (W): slide-in menu and the Settings window

**Files:**
- Create: `W/src/components/layout/MenuPanel.tsx`, `W/src/components/layout/SettingsDialog.tsx`, `W/src/hooks/useModalDialog.ts`, `W/src/lib/menuPanel.ts` and its test.
- Modify: `W/src/components/layout/Header.tsx`.
- Delete: `W/src/components/layout/UserMenu.tsx`, once nothing imports it.

**Interfaces:**
- Consumes `menuSections` and `RoleStatus` (`src/lib/roles.ts`), `useAdminSession`, `useTheme`, `useTextSize`, and the `['people']` held count as UserMenu uses it today.
- Produces:
  - `useModalDialog(open: boolean, onClose: () => void): React.RefObject<HTMLDivElement | null>`. It handles Escape, the focus trap (Tab and Shift+Tab cycle inside), initial focus, and returning focus to the opener on close.
  - In `menuPanel.ts`: `shouldCloseOnRoute(prevPath: string, nextPath: string): boolean` (true when the path changed) and `isCurrent(itemPath: string, pathname: string): boolean` (exact match, or a prefix match for nested pages, using the same rule as `currentAdminStep`).
- **The panel:**
  - It slides in from the left, about 18–20rem wide, over a dimmed backdrop.
  - It is `role="dialog"` with `aria-modal="true"` and `aria-label="Menu"`.
  - The motion is removed under `prefers-reduced-motion`.
  - Its order: Search the archive (`/`), Archive workflow, People (admins, with the held count on Approvals), Settings (a button that opens the dialog), Account (email + Sign out, or `Sign in (admin)` → `/admin/fixes`).
  - Links carry `aria-current="page"` from `isCurrent`.
  - It closes on a backdrop click, the close button, Escape, and a route change (`useLocation` with `shouldCloseOnRoute`).
- **The Settings dialog:** a centred `role="dialog"` holding the existing theme and text-size choice buttons, moved unchanged from UserMenu.
- **The Header** keeps one `Menu` button with `aria-expanded` and `aria-controls`.

- [ ] **Step 1:** Write the failing tests: `shouldCloseOnRoute` (same path false, different true) and `isCurrent` (exact, nested, and look-alike prefixes such as `/admin/fixesx` → false).
- [ ] **Step 2:** Run `npx vitest run src/lib/menuPanel.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement the hook, the panel, the dialog and the Header change, then delete UserMenu.
- [ ] **Step 4:** Run `npm test && npm run lint && npm run build`. Expected: pass. Also `grep -r UserMenu src` gives no hits.
- [ ] **Step 5:** Update the docs:
  - `W/docs/ops-manual/facts.md` "Who sees what": the Menu is now a slide-in panel, and text size and theme are under Settings.
  - One line in DEVOPS.md §12 about the Changes question filter needing the re-applied SQL.
- [ ] **Step 6:** Commit `feat: slide-in menu with a Settings window`.
