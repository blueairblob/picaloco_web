# Changes table, themed dropdowns and slide-in menu: design

Date: 2026-11-24. Status: draft for approval.
Follows the AI volunteer work (`2026-11-22-ai-volunteer-design.md`), branch `ai-volunteer`.
The requests came from the user's first look at the preview.

## Intent

The user asked for three things:

- **Themed dropdowns.** The dropdowns on the Changes page don't follow the light and dark theme.
- **A clearer Changes page.** It is wordy. The admin should pick the question first (Loco number, Loco name, or a Model check question) and then see a clear then-and-now table, with a link to each photo.
- **A navigation panel.** Navigation lives only in the Menu dropdown, which is getting busy. It should become a typical slide-in, slide-out panel. A Settings item in it opens a small window holding text size and display theme.

## Decisions (user)

- The menu is a slide-in, slide-out panel on every screen size, opened by the Menu button.
- Text size and theme move out of the panel into a Settings window.

## Design

### 1. Dropdowns follow the theme

- **Style:** every `<select>` on the admin pages uses the same input style as the Search filters (`INPUT_CLASS` in `src/components/search/filterFields.tsx`), with a solid `var(--surface)` background instead of `bg-transparent`. The native option list then follows `color-scheme`.
- **Where:** the Changes page and `ModelTaskCard` (the run picker).

### 2. Changes page: pick a question, then read a table

```
Question: [ Loco number ▾ ]  Show: [ All ▾ ]  Person: [ Everyone ▾ ]  From [ ] To [ ]

 Photo          Then             Now               By / when                  Status
 ─────────────────────────────────────────────────────────────────────────────────────
 [▣] arc00001   Suggested 4073   Verified 4073     sam · 22 Nov 14:05                  [Undo]
 [▣] bpuk2237   Suggested 60103  Corrected 60100   sam · 22 Nov 14:07         ✓ admin  [Undo]
 [▣] gd790551   Verified 1450    Suggested 1450    admin · 23 Nov 09:12       undo     [Undo]
```

- **Question dropdown:**
  - Lists every Data fix (`rat.data_fix`: id, title, in sort order) and every Model check task (`rat.model_task`: id, question, in sort order), then "All questions".
  - The default is the first Data fix (Loco number).
- **Server filter:** the question filters on the server, so paging stays right. `rat.change_list` gains `p_fix_id text DEFAULT NULL` and `p_task_id text DEFAULT NULL`. Only one is set at a time; neither means all.
  - A fix filter matches history rows and held fix rows with that fix_id.
  - A task filter matches answers, withdrawals (through their answer) and held answers with that task_id.
  - This changes the signature, so it needs DROP + CREATE, re-issued grants, and one re-apply of `add_volunteer_tables.sql` by the user.
- **Show dropdown:** replaces the "kind" list. It maps to `p_kinds`:
  - All: every kind.
  - Reviews and answers: `fix_review`, `fix_model_check`, `answer`.
  - Held for approval: `held_submitted`, `held_approved`, `held_rejected`.
  - Undos: `fix_undo`, `answer_withdrawn`.
- **"Undo all":** it still leaves undo rows out unless Show is "Undos". `bulkUndoRows` and `excludedUndoCount` take that mode instead of the raw kinds list.
- **Table columns:**
  - **Photo:** a thumbnail (`getThumbnailUrl`) and the image number, linking to `/photo/:imageNo` in a new tab.
  - **Then and Now:** for Data fixes, the status label and values ("Suggested 4073", "Verified 4073"). For a Model check question the headings read "AI said" and "Answer", and a blind sample shows "blind".
  - **By / when:** the person's email (from `people()`) and a short local date and time.
  - **Status:** "✓ {approver}" for an approved change, "held", "rejected: {note}", "undo" or "withdrawn" for those rows. An undone row is greyed out with "undone".
  - **Last column:** Undo, when `canUndo`.
  - With "All questions" selected, a Question column appears after Photo.
- **Phones:** below the `sm` breakpoint each row is a card (photo, then-and-now, by and when, status, Undo) with no sideways page scroll.
- **Unchanged:** paging, date filters, the summaries and the confirmation copy.

### 3. Slide-in menu and a Settings window

- **The Menu button** in the header opens a panel that slides in from the left, on every screen size.
  - It sits over a dimmed backdrop and is a `role="dialog"` with `aria-modal`.
  - Focus moves into it and is trapped. Escape, a backdrop click, the close button and following any link all close it. Focus returns to the Menu button.
- **Panel contents, top to bottom:**
  1. Search the archive (`/`).
  2. **Archive workflow:** the role-filtered `menuSections` steps, keeping their hints and the trainee note.
  3. **People** (admins): Volunteers, Approvals (with the held count), Changes.
  4. **Settings:** opens the Settings window.
  5. **Account:** the signed-in email and Sign out, or "Sign in (admin)" when signed out, as today.
  - The current page is marked with `aria-current="page"`.
- **Settings window:** a centred modal dialog holding the existing text-size and theme controls, moved as they are, with the same accessibility as the panel.
- **Code:**
  - `UserMenu.tsx` becomes `MenuPanel.tsx` plus `SettingsDialog.tsx`, and the Header keeps a single Menu button.
  - Open, close and focus handling go in a small shared hook or component used by both dialogs.
  - Pure helpers stay tested: `menuSections`, the column choice, the Show-to-kinds mapping and the cell text.
- **Unchanged:** the in-page `AdminSteps` nav at the top of admin pages stays. The panel is the global navigation, and the steps are the in-page breadcrumb.

## Non-goals

- No new pages or roles, and no change to approvals or undo behaviour.
- No change to the public search page apart from the new menu.

## Testing

- **F:** a `change_list` test that `p_fix_id` and `p_task_id` filter every kind (history, held, answers, withdrawals), and that neither set means all. The bootstrap copy stays byte-identical.
- **W:**
  - vitest for the Show-to-kinds mapping, the column and heading choice per question type, the cell text, and the bulk-undo mode;
  - the build and lint pass;
  - checked by hand on the preview: the dropdowns in both themes, the table on desktop and phone width, keyboard use of the panel and the Settings window.

## Left to the builder

- Panel width (around 18–20rem) and the animation, which should respect `prefers-reduced-motion`.
- Thumbnail size (around 48px).
- Date format details.
