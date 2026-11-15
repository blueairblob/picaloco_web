# Data Fixes: photo size and number+name on one card — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let elderly volunteers enlarge the review photos, and fix a photo's loco name while
reviewing its number (and the reverse) on the same card.

**Architecture:** Front end only (`picaloco_web`, branch `data-fixes`). No SQL change: the other
fix's row is read with the existing admin `SELECT` on `rat.data_fix_value` and saved with the
existing `review_fix_value` RPC. Photo size is a per-browser preference in `localStorage`.

**Tech Stack:** Vite, React 19, TypeScript, Tailwind, React Query, supabase-js, vitest
(`environment: 'node'`, so tests cover pure modules and service calls, not components).

**Spec:** `docs/superpowers/specs/2026-11-14-data-fixes-loco-number-name-design.md`, §12
(amendment 2026-11-15). §7 still applies where §12 doesn't change it.

## Global Constraints

- Run everything from the `picaloco_web` root. Checks: `npx vitest run`, `npm run build`,
  `npx oxlint` — all clean before each commit.
- Never stage `.env*` or `.superpowers/`. Commit messages end with
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Tests never touch the live DB or network (mock `@/lib/supabase/adminClient` as
  `src/services/dataFixService.test.ts` already does).
- `updated_at` is the optimistic-lock token: pass the server's string through untouched, never via
  `Date`.
- Copy: "Photo size", "Normal", "Large", "Extra large"; "Also on this photo: <fix title>".
- Tailwind classes must appear as complete literal strings in source (no string building).
- `localStorage` access is wrapped in try/catch and the page works without it.

## Review Focus

1. A volunteer edits the other box, then presses Skip or Back: nothing is saved, the edit is still
   there on return (drafts in `reviewDrafts`, keyed by that fix's id).
2. The other fix's save fails (stale): the main record is NOT saved, the card does not advance,
   and the notice names the field ("Loco name: …").
3. Esc in the other box discards only that box's edit, never the main box's (and the reverse).
4. Ctrl+Enter in the other box with the main box untouched confirms the main record and saves the
   other edit; it must not try to "save an edit" of an untouched main box.
5. Extra large on a phone-width screen: one column, no sideways scroll; the choice survives a
   reload and an unreadable stored value falls back to Normal.

---

### Task 1: Photo size control

**Files:**
- Create: `src/lib/photoSize.ts`, `src/lib/photoSize.test.ts`
- Create: `src/hooks/usePhotoSize.ts`
- Create: `src/components/admin/fixes/PhotoSizeControl.tsx`
- Modify: `src/components/admin/fixes/BulkConfirmGrid.tsx` (grid `<ul>` classes ~line 142, tile
  number label ~line 162)
- Modify: `src/components/admin/fixes/ReviewCard.tsx` (`ZoomImage` height ~line 78, props)
- Modify: `src/pages/FixQueuePage.tsx` (page container ~line 414, Grid toggle row ~line 426,
  pass the size to `ReviewQueue`/`ReviewCard` and `BulkConfirmGrid`)

**Interfaces:**
- Produces, in `src/lib/photoSize.ts`:
  - `export type PhotoSize = 'normal' | 'large' | 'xlarge'`
  - `export const PHOTO_SIZES: { id: PhotoSize; label: string }[]` — in order Normal, Large,
    Extra large.
  - `export function parsePhotoSize(raw: unknown): PhotoSize` — the stored string if valid, else
    `'normal'`.
  - `export const PHOTO_SIZE_STORAGE_KEY = 'picaloco-photo-size'`
  - `export const GRID_COLUMNS: Record<PhotoSize, string>`:
    normal `'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6'` (today's value),
    large `'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'`,
    xlarge `'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'`.
  - `export const TILE_LABEL: Record<PhotoSize, string>`: `'text-sm'`, `'text-lg'`, `'text-2xl'`.
  - `export const REVIEW_PHOTO_HEIGHT: Record<PhotoSize, string>`:
    `'h-[min(60vh,32rem)]'` (today's value), `'h-[min(75vh,44rem)]'`, `'h-[min(85vh,56rem)]'`.
- Produces `usePhotoSize(): [PhotoSize, (s: PhotoSize) => void]` in `src/hooks/usePhotoSize.ts`
  (reads once on mount via `parsePhotoSize(localStorage.getItem(KEY))`, writes on change).
- Produces `PhotoSizeControl({ value, onChange }: { value: PhotoSize; onChange: (s: PhotoSize) => void })`.
- `BulkConfirmGrid` gains prop `photoSize: PhotoSize`; `ReviewCard` gains prop `photoSize: PhotoSize`.

- [ ] **Step 1: Write the failing tests** in `src/lib/photoSize.test.ts`:
  - `parsePhotoSize('large')` → `'large'`; `parsePhotoSize('xlarge')` → `'xlarge'`;
    `parsePhotoSize('huge')`, `parsePhotoSize(null)`, `parsePhotoSize(3)` → `'normal'`.
  - `PHOTO_SIZES.map(s => s.label)` equals `['Normal', 'Large', 'Extra large']`.
  - `GRID_COLUMNS.normal` equals `'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6'` and
    `REVIEW_PHOTO_HEIGHT.normal` equals `'h-[min(60vh,32rem)]'` (Normal is exactly today's layout).
  - Every `PhotoSize` id has an entry in `GRID_COLUMNS`, `TILE_LABEL` and `REVIEW_PHOTO_HEIGHT`.
- [ ] **Step 2:** `npx vitest run src/lib/photoSize.test.ts` — FAIL (module missing).
- [ ] **Step 3:** Implement `photoSize.ts`, `usePhotoSize.ts`, `PhotoSizeControl.tsx`.
  The control: a labelled group ("Photo size"), one button per size with `aria-pressed`, text at
  least `text-base`, at least 44px tall, the pressed one filled with `var(--accent)` /
  `var(--accent-foreground)` like the existing primary button; buttons use
  `onMouseDown={(e) => e.preventDefault()}` so keyboard focus stays where it was (review keys keep
  working after a click), as the card's buttons do.
- [ ] **Step 4:** Wire it: `FixQueuePage` calls `usePhotoSize()` and shows `PhotoSizeControl`
  whenever the fix is loaded (single review and grid), in the same row as the Grid toggle (the
  toggle still only appears for high-only). Pass the size to `BulkConfirmGrid` (columns and tile
  label class) and through `ReviewQueue` to `ReviewCard` (`ZoomImage` height class). Widen the page
  container from `max-w-6xl` to `max-w-[100rem]`.
- [ ] **Step 5:** `npx vitest run`, `npm run build`, `npx oxlint` — all pass.
- [ ] **Step 6: Commit** — `feat: photo size control for the review queue and grid`.

### Task 2: The other fix on the same review card

**Files:**
- Modify: `src/services/dataFixService.ts`, `src/services/dataFixService.test.ts`
- Create: `src/lib/companionSave.ts`, `src/lib/companionSave.test.ts`
- Modify: `src/lib/reviewKeys.ts`, `src/lib/reviewKeys.test.ts`
- Create: `src/hooks/useCompanions.ts`
- Modify: `src/components/admin/fixes/ReviewCard.tsx`
- Modify: `src/pages/FixQueuePage.tsx`

**Interfaces:**
- Consumes (existing): `reviewValue`, `getValue`, `mapReviewError` outcomes
  (`'stale' | 'forbidden' | 'signed-out' | 'error'`), `decideSave`, `editBaseline`, `sameValues`,
  `normaliseValues`, `reviewDrafts` / `draftKey` / `isDraftOutdated`, `notVisibleLabel(fixId)`
  (in `FixQueuePage.tsx`; move it to `src/lib/reviewDecision.ts` and export it if both files need
  it), `DataFix` (`id, title, sort_order, …`), Task 1's `photoSize` prop.
- Produces, in `dataFixService.ts`:
  - `export interface CompanionValue { fix_id: string; values: string[]; suggested_values: string[]; confidence: FixConfidence; status: FixStatus; needs_recheck: boolean; updated_at: string }`
  - `export async function getCompanionValues(imageNo: string, fixIds: string[]): Promise<CompanionValue[]>`
    — one `select` on `data_fix_value` with `.eq('image_no', imageNo).in('fix_id', fixIds)`;
    returns rows in `fixIds` order, `values`/`suggested_values` defaulted to `[]`; makes no request
    and returns `[]` when `fixIds` is empty; throws the Supabase error.
- Produces, in `src/lib/companionSave.ts`:
  - `export function isCompanionDirty(row: CompanionValue, draftText: string): boolean` —
    `!sameValues(normaliseValues(draftText), editBaseline(row))`.
  - `export function companionDecision(row: CompanionValue, draftText: string): SaveDecision | null`
    — `null` when not dirty; `{ status: 'none_visible', values: [] }` when dirty and the
    normalised draft is empty; otherwise `decideSave(row, 'edit', normaliseValues(draftText))`.
- Produces, in `reviewKeys.ts`:
  `export function ctrlEnterAction(inOtherBox: boolean, mainDirty: boolean): 'saveEdit' | 'confirm'`
  — `'confirm'` only when in the other box and the main box is not dirty.
- Produces `useCompanions(imageNo: string | undefined, fixIds: string[], upcoming: string[])` in
  `src/hooks/useCompanions.ts`, returning
  `{ rows: CompanionValue[] | undefined; isError: boolean; refetch: () => void; setRow: (fixId: string, patch: Partial<CompanionValue>) => void }`.
  React Query key `['data-fix-companions', imageNo, fixIds.join(',')]`, `staleTime: Infinity`,
  no refetch on focus/reconnect; prefetches `upcoming` (the next 3 image_nos) with the same key
  shape; `setRow` updates the cached rows with `queryClient.setQueryData`.

- [ ] **Step 1: Write the failing tests.**
  - `companionSave.test.ts` (rows built inline; suggestion `['60103']`):
    - open row, draft equal to the suggestion text → `isCompanionDirty` false,
      `companionDecision` null;
    - open row, draft `'60103\n4472'` → `{ status: 'corrected', values: ['60103', '4472'] }`;
    - open row whose values are `['4472']`, draft `'60103'` → `{ status: 'verified', values: ['60103'] }`;
    - draft `'  \n '` on an open row with a suggestion → `{ status: 'none_visible', values: [] }`;
    - reviewed row (`status: 'corrected', values: ['Doll']`), draft `'Doll'` → null; draft
      `'Dolly'` → `{ status: 'corrected', values: ['Dolly'] }`.
  - `reviewKeys.test.ts`: `ctrlEnterAction(true, false)` → `'confirm'`;
    `ctrlEnterAction(true, true)`, `ctrlEnterAction(false, false)`, `ctrlEnterAction(false, true)`
    → `'saveEdit'`.
  - `dataFixService.test.ts`: extend the `adminSupabase` mock with a chainable `from()` builder;
    `getCompanionValues('ab1', ['loco_name'])` calls `from('data_fix_value')`, `.eq('image_no', 'ab1')`,
    `.in('fix_id', ['loco_name'])` and maps null arrays to `[]`; rows come back in `fixIds` order
    even if the server returns them reversed; `getCompanionValues('ab1', [])` returns `[]` without
    calling `from`; a returned error is thrown.
- [ ] **Step 2:** `npx vitest run` — the new tests FAIL.
- [ ] **Step 3:** Implement `getCompanionValues`, `companionSave.ts`, `ctrlEnterAction`,
  `useCompanions`.
- [ ] **Step 4: Card.** `ReviewCard` gains
  `companions: { fixId: string; title: string; notVisibleLabel: string; row: CompanionValue; draft: string; dirty: boolean; draftOutdated: boolean }[]`,
  `companionsState: 'loading' | 'error' | 'ready'`, `onCompanionRetry: () => void` and
  `onCompanionDraftChange: (fixId: string, text: string) => void`. Below the main values block,
  for each companion: heading "Also on this photo: <title>", its status pill (same labels), a
  textarea with `data-review-edit={fixId}` and `id={'review-values-' + fixId}` (main box keeps
  `data-review-edit=""`), read-only while saving, its "Suggestion: … (… confidence)" or
  "Current review: …" line as the main box shows it. When dirty: "Edited — saved with this record
  when you confirm or save." When dirty and empty: "Empty — will be saved as ‘<notVisibleLabel>’."
  When `draftOutdated`: the same warning the main box uses. Loading: a quiet "Loading <title>…";
  error: "Couldn't load <title> for this photo." with a Retry button. Ready with no row for a
  companion: show nothing for it.
- [ ] **Step 5: Queue page.** `FixQueuePage` passes `companionFixes` (every fix except the current
  one, by `sort_order`) to `ReviewQueue`. `ReviewQueue`:
  - calls `useCompanions(rec?.image_no, companionFixes.map(f => f.id), next 3 image_nos)`;
  - drafts: `reviewDrafts.get(draftKey(companionFixId, rec.image_no))`, the draft text defaulting
    to `editBaseline(row).join('\n')`; `dirty` via `isCompanionDirty`; `draftOutdated` via
    `isDraftOutdated(draft, row.updated_at)` when dirty; setting a draft stores
    `{ text, baseUpdatedAt }` keeping the first base, exactly like the main box's `setDraft`;
  - `save()`: before the main `reviewValue`, for each companion with a non-null
    `companionDecision`: if its draft is outdated, rebase it, show
    "<title> changed after you typed your edit. Check it against the photo, then save again." and
    stop. Otherwise `reviewValue({ imageNo, fixId: companionFixId, values, status, expectedUpdatedAt: row.updated_at })`.
    On ok: `setRow(fixId, { status, values: status is none_visible/no_loco ? [] : values, needs_recheck: false, updated_at })`
    and delete that draft. On failure: stop (no main save, no advance) with the main card's
    messages prefixed "<title>: " — stale reloads that row (`getValue` → `setRow`) and rebases its
    draft; signed-out shows the sign-in notice. Then the existing main save runs unchanged;
  - keys: in `onKeyDown`, a box is `el.dataset.reviewEdit` (`''` main, a fix id for a companion).
    Ctrl/Cmd+Enter uses `ctrlEnterAction(isCompanionBox, dirty)`. Escape in a companion box
    discards that companion's draft only (the main `cancelEdit` path is unchanged for the main
    box); route it with a small branch, not by changing `shortcutFor`.
  - Skip/Back never save anything (unchanged).
- [ ] **Step 6:** `npx vitest run`, `npm run build`, `npx oxlint` — all pass.
- [ ] **Step 7: Commit** — `feat: edit the other data fix on the same review card`.
