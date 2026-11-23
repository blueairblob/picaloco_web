# AI volunteer role, trainee approval and change audit: design

Date: 2026-11-22. Status: draft for approval.
Repos: `filemaker_sync` (F, SQL and its tests) and `picaloco_web` (W, pages and one Vercel function).

## Intent

RAT wants human volunteers, besides the admin, to do the two jobs that feed the photo AI: answering
**Model check** and reviewing **Data fixes**. The admin calls this role the **AI volunteer**: a
"model checker / data corrector" for data analysis and data entry. It is a person, not an automated
agent.

New volunteers will make mistakes while they learn. The admin wants three things:

- to catch those mistakes before they count;
- to see who changed what, and when;
- to unwind a mistake, or a whole batch of them, without losing the good work.

The Data fixes reviews and Model check answers are irreplaceable (`filemaker_sync` CLAUDE.md,
Golden Rule 7). Whatever this design adds must keep them safe. It must not weaken the guards that
protect them today.

## Goals

1. **AI volunteer role.** An admin adds a volunteer from a new **Volunteers** page. The volunteer
   can use Data fixes and Model check, and nothing else.
2. **Accounts made on that page.** The admin types an email. The site creates the account with a
   temporary password and shows it once. The volunteer sets their own password at first sign-in.
3. **In training.** Each volunteer has an "in training" switch, on for new volunteers. A trainee's
   saves are held, not applied. The admin approves or rejects them, one at a time or in bulk. When
   the admin switches training off, the volunteer's saves apply at once, as an admin's do.
4. **Audit.** A **Changes** page lists every review, answer, approval, rejection and undo: who,
   when, what it was before and after. It can filter by person, date range and kind.
5. **Undo.** From the Changes page the admin can undo one change, or every change in a filtered
   batch. A Data fix goes back to its previous value. A Model check answer is marked withdrawn and
   stops counting. An undo is itself a recorded change.

## Non-goals

- More roles or fine-grained permissions. There are two roles: admin and AI volunteer.
- Volunteers managing people, seeing Migration status, or seeing the Volunteers, Approvals or
  Changes pages.
- Emailed invites or self sign-up. Public sign-up stays off (`DISABLE_SIGNUP=true`), and huey has
  no email sending.
- Undo for anything the extractor or the FileMaker loader writes. Undo covers human work only:
  review, model check, approval.
- Editing a held item. The admin approves or rejects it. To correct it, the admin rejects it and
  saves the right value through the normal pages.

## Anti-goals (a failure even if it works)

- Any path that updates, deletes or truncates `rat.model_answer`, or rewrites `rat.data_fix_history`
  rows. Both stay append-only.
- A reviewed `rat.data_fix_value` changing outside a review-context function. The guard trigger
  `rat.data_fix_value_guard` stays as it is.
- A trainee's unapproved work showing anywhere it counts: the public site, the Data fixes counts,
  Model check accuracy, the blind sample, or the model's training data (`scripts/model_train.py`).
- An undo that silently overwrites somebody's later change.
- A server key reaching the browser, or the temporary password stored anywhere after it is shown.

## Constraints

- **Schema:**
  - All new RPCs follow the existing pattern: `SECURITY DEFINER`, `SET search_path = ''`, every
    name schema-qualified.
  - Error codes: 42501 when not allowed, 22023 for bad input, P0002 when not found, PT409 when stale.
    Never 40001, because PostgREST retries it forever (`fix_review_stale_errcode.sql`).
  - DDL ships as one idempotent file, `supabase/schema/add_volunteer_tables.sql`, folded into
    `bootstrap_rat_schema.sql`. The user applies it to live oci by hand: agent DDL on live oci is
    blocked.
- **Tests:**
  - F schema tests run on the throwaway Docker `postgres:17` (`tests/conftest.py`,
    `tests/sql/supabase_stubs.sql`), never the live DB.
  - W tests are lib-level vitest. Lint is `oxlint`, and the build is `tsc -b && vite build`.
- **Additive only:**
  - New nullable columns on `rat.data_fix_history` and `rat.model_answer` are allowed: an ADD COLUMN
    with no default is metadata-only and rewrites no rows.
  - The `data_fix_history.source` CHECK gains one value (`'undo'`).
  - `scripts/data_fix_preservation_check.py`'s checksum covers `image_no|fix_id|values|status` only,
    so new columns don't change it.
- **Secrets:**
  - `SUPABASE_SERVICE_ROLE_KEY` is already set on Vercel and used by `api/agent-storage-*.ts`. The new
    function reuses it.
  - No secret is committed.
- **Plain language:** labels and messages use plain words, as on the existing admin pages.

## Approaches considered

| | Approach | Trade-off | Verdict |
|---|---|---|---|
| A | **Separate holding tables.** Trainee saves go into `rat.pending_fix_review` / `rat.pending_model_answer`. Approval replays them through the existing apply logic, recording the trainee as author and the admin as approver. | Two new tables and approve/reject functions. The real tables only ever see approved work, and their guards don't change. | **Chosen** (user, 2026-11-22) |
| B | Flag rows as pending inside the real tables. | Works for `model_answer`, but not Data fixes: `data_fix_value` holds one current value, so a held change would replace the live value. It would also mean loosening the append-only and overwrite guards. | Rejected |
| C | Everything live, filtered out of the counts. | Same Data fixes problem as B. The site and search would show unapproved values. | Rejected |

Account creation was decided separately (user, 2026-11-22, "option 1"): the admin creates the
account on the Volunteers page through a Vercel function holding the service-role key. Emailed
invites (no mail server) and hand-made accounts in Studio (two places per volunteer) were rejected.

## Design

### Roles and who may do what

New table **`rat.volunteer`**:

| Column | Type | Notes |
|---|---|---|
| `user_id` | uuid PK, FK `auth.users(id)` | |
| `in_training` | boolean NOT NULL DEFAULT true | |
| `must_change_password` | boolean NOT NULL DEFAULT true | A nudge, not security: cleared by the volunteer's own call after setting a password |
| `added_by` | uuid NOT NULL | Admin's `auth.uid()` |
| `added_at` | timestamptz NOT NULL DEFAULT now() | |
| `removed_by`, `removed_at` | uuid, timestamptz | NULL while active. Removing never deletes the row, so the audit can still name the person |

The admin is never also a volunteer. Adding an email that belongs to an admin is refused.

New helper functions, each `STABLE SECURITY DEFINER`:

- `rat.is_volunteer()`: an active row exists for `auth.uid()`.
- `rat.is_trainee()`: an active row exists with `in_training`.
- `rat.can_review()`: `is_admin() OR is_volunteer()`.
- `rat.my_role()`: returns `{role: 'admin'|'volunteer'|null, in_training, must_change_password}`.
  It replaces the page's `is_admin` call.

Access per RPC:

| RPC | Today | After |
|---|---|---|
| `data_fix_queue`, `data_fix_progress`, `model_check_queue`, `model_check_progress` | admin | `can_review()` |
| `model_check_photo`, `model_check_confusion`, `model_check_conflicts`, `data_fix_orphans` | admin | admin (unchanged). `model_check_photo` shows anyone's latest answer, including blind ones, and volunteers only reach it through conflict links, which are admin-only |
| `review_fix_value`, `confirm_fix_values`, `save_model_answer` | admin | admin or non-trainee volunteer. A trainee gets 42501 `'trainee work is held for approval: use submit_*'` |
| new `submit_fix_review`, `submit_fix_confirm`, `submit_model_answer` | — | trainee only (others get 42501, so held work can't come from the wrong path) |
| new approval, undo, volunteer and change-list RPCs | — | admin |

RLS: the SELECT policies on `rat.data_fix`, `rat.data_fix_value`, `rat.model_task` and
`rat.model_run`, which W reads directly in `dataFixService.ts` and `modelCheckService.ts`, change
from `is_admin()` to `can_review()`. `rat.data_fix_history`, `rat.admin_user`, the new tables and
`rat.model_answer` stay unreadable to volunteers. The builder confirms that no other direct table
read exists in W.

### Held work (trainees)

**`rat.pending_fix_review`**:

| Column | Notes |
|---|---|
| `id` bigserial PK | |
| `image_no`, `fix_id` | The `data_fix_value` key |
| `values` text[], `status` text | What the trainee chose. `status` is one of `verified`, `corrected`, `none_visible`, `no_loco` |
| `base_updated_at` timestamptz | The row's `updated_at` when the trainee loaded it |
| `base_values` text[], `base_status` text | Snapshot shown to the admin |
| `submitted_by` uuid, `submitted_at` timestamptz | |
| `decision` text | `pending` / `approved` / `rejected` / `withdrawn`, CHECK |
| `decided_by`, `decided_at`, `note` | `note` is the admin's optional reason on a rejection |

**`rat.pending_model_answer`**: the arguments of `save_model_answer` (`task_id`, `image_no`,
`answer`, `shown_run_id`, `shown_answer`, `mode`) with the same blind CHECK, plus `submitted_by`,
`submitted_at` and the same decision columns.

Rules:

- **Submit:**
  - `submit_fix_review` validates exactly as `review_fix_value` does (status list, row exists).
  - `submit_fix_confirm(p_fix_id, p_items)` holds one `verified`-with-suggested-values row per item
    still `extracted`, mirroring `confirm_fix_values`.
  - `submit_model_answer` validates exactly as `save_model_answer` does.
  - A trainee re-submitting the same key (`image_no, fix_id` / `task_id, image_no, mode`) while a
    pending row exists marks the old one `withdrawn` (decided_by = the trainee) and inserts the new
    one. At most one pending row per key per trainee: a partial unique index on
    `decision = 'pending'`.
- **Queues:** a trainee's own pending items drop out of their own queue. Everybody else's queue is
  unchanged. Two trainees may hold different answers for the same photo; the admin decides each.
- **Approve:**
  - `approve_fix_review(p_ids bigint[], p_force boolean DEFAULT false)` applies each pending row
    through the same update `review_fix_value` performs.
  - In `rat.data_fix_value`, `reviewed_by` = the trainee.
  - In `rat.data_fix_history`, `changed_by` = the trainee, the new column `approved_by` = the admin,
    and `source` = `review`.
  - If the row's `updated_at` differs from `base_updated_at`, the item is **stale** and is skipped,
    unless `p_force` is set (the admin saw the current value and approves anyway).
- **Approve answers:**
  - `approve_model_answer(p_ids bigint[])` inserts into `rat.model_answer`. `answered_by` = the
    trainee, `answered_at` = `submitted_at`, and the new columns are `approved_by`, `approved_at`.
  - It then runs the Data fixes link fill exactly as `save_model_answer` does, with the history
    tagged `model_check` and `approved_by` set.
  - Answers are never stale: a later answer simply becomes the latest.
- **Reject:** `reject_held(p_kind text, p_ids bigint[], p_note text)` sets `decision = 'rejected'`.
  Nothing reaches the real tables.
- **Held rows are a record, not undoable.** Undo appears on the change an approval produced (the
  `fix_review` or `answer` row), never on the `held_approved` or `held_rejected` row itself. Undoing
  an approved item's result leaves its held row `approved`; the Changes page shows the undo next to
  it. A rejection can't be undone. To accept the work after all, the admin saves the value through
  the normal pages.
- **Results:** every approve or reject call returns `{approved|rejected: n, stale: [...],
  skipped: [...]}` per item, so the page can say exactly what happened. Each item is done on its
  own: one stale item doesn't stop the rest.
- **Training off:** turning `in_training` off doesn't touch held items. They stay for the admin to
  decide. The Volunteers page shows a count of held items per volunteer.

Shared apply logic: the bodies of `review_fix_value` and `save_model_answer` are refactored into
internal functions, `rat._apply_fix_review(..., p_by uuid, p_approved_by uuid)` and
`rat._apply_model_answer(..., p_by, p_approved_by, p_answered_at)`. Both the direct RPCs and the
approve RPCs call these, so there is one write path. They get no EXECUTE grant for `authenticated`.
`changed_by` in the history trigger currently comes from `auth.uid()`, so it reads two new session
settings when they are present: `rat.acting_for` (the author) and `rat.approved_by`. They are set and
cleared inside the same review-context window as `rat.review_context`.

### Undo

- **New history columns:** `rat.data_fix_history` gains these nullable columns:
  - `approved_by uuid`;
  - `undoes bigint`, the history id this undo reverses;
  - `model_answer_id bigint`, the answer whose save wrote this fill;
  - `old_needs_recheck boolean` and `old_description_hash text`, filled by the history trigger from
    now on, so an undo can restore them.

  `source` gains `'undo'`.
- **New table `rat.model_answer_withdrawal`:** `answer_id` bigint PK FK `model_answer(id)`,
  `withdrawn_by`, `withdrawn_at`, `note`. It is append-only by the same trigger as `model_answer`.
  An answer is withdrawn once; there is no un-withdraw. To restore it, the admin answers again.
- **Data fix undo:** `undo_fix_change(p_history_ids bigint[])`. It accepts history rows whose source
  is `review`, `model_check` or `undo`, and it works **per key** (`image_no, fix_id`):
  - It groups the given rows by key. For each key it takes the earliest given row. It applies only
    if every history row for that key after that earliest row is also in the given set. Otherwise
    the whole key is skipped as **changed since**. So a batch that holds all of a trainee's changes
    to one fix unwinds them in one step. A single undo is the same rule with one row.
  - It also checks that the value's current `values` and `status` equal the newest given row's
    `new_values` and `new_status`. This is a belt-and-braces check.
  - It sets `values` and `status` back to the earliest row's `old_values` and `old_status`. It
    restores `needs_recheck` and `description_hash` from that row's `old_needs_recheck` and
    `old_description_hash`.
  - For history written before this migration, where those are NULL, it sets
    `needs_recheck = true` whenever the restored status isn't `extracted`. That way a person looks
    at the value again, and a changed description is never hidden.
  - If the restored status is `extracted`, it clears `reviewed_by` and `reviewed_at`. Otherwise
    they come from the history row before the earliest one.
  - It writes one undo history row per key, in review context, with `source = 'undo'` and
    `undoes` = the newest given row.
  - Undoing an undo re-applies the change. That needs no special case: it's the same rule.
- **Answer undo:** `withdraw_model_answers(p_answer_ids bigint[], p_note text)`.
  - Inserts withdrawals.
  - If the answer's save filled Data fixes, those fills are undone by the Data fix undo rule. A
    fill that was changed since is left in place and listed.
  - The fills are found by `data_fix_history.model_answer_id`. For answers saved before this
    migration they are found by matching: same `image_no`, `source = 'model_check'`, same
    `changed_by`, and `changed_at` = the answer's `answered_at` (both are `now()` of one
    transaction).
- **Withdrawn answers never count.** "Latest answer" everywhere means the latest answer that has no
  withdrawal row. That covers:
  - the "not yet answered" test in `model_check_queue`;
  - `model_check_progress`, `model_check_confusion`, `model_check_conflicts`, `model_check_photo`;
  - `scripts/model_train.py`'s answer query;
  - `scripts/load_model_run.py`'s "has answers" check.

  If the withdrawn answer was the latest, the one before it counts again. If none is left, the photo
  returns to the queue.
- **Batch undo:** the Changes page sends the ids of the filtered rows to these RPCs in chunks of up
  to 500 and adds up the results.

### Changes (audit) list

`rat.change_list(p_user uuid, p_from timestamptz, p_to timestamptz, p_kinds text[], p_after text,
p_limit int)`, admin only, newest first, keyset paging. One row per event, with these columns:

`kind`, `at`, `by`, `approved_by`, `image_no`, `subject` (fix title or task question), `before`,
`after`, `ref` (`{table, id}` for undo), `undone` (bool), `undo_ref`.

| Kind | Source |
|---|---|
| `fix_review` | `data_fix_history`, source `review` |
| `fix_model_check` | `data_fix_history`, source `model_check` |
| `fix_undo` | `data_fix_history`, source `undo` |
| `answer` | `model_answer` (marked `undone` when withdrawn) |
| `answer_withdrawn` | `model_answer_withdrawal` |
| `held_submitted` | `pending_*` |
| `held_approved` | `pending_*` |
| `held_rejected` | `pending_*` |

Extractor history rows are not listed.

`rat.people()`, admin only, returns `user_id`, `email`, `role`, `in_training`, `removed_at` and
`held_count` for every admin and volunteer, read from `auth.users`. It feeds the Volunteers page and
the names on the Changes page.

### Accounts: `api/volunteers.ts` (Vercel function)

`POST /api/volunteers`, with the caller's Supabase access token as `Authorization: Bearer`, and a
JSON body with `action`:

- **`create {email}`:**
  1. Confirm the caller is an admin by calling `rat.is_admin` through PostgREST with the caller's
     own token.
  2. Generate a temporary password server-side: 12 characters, random, no look-alike characters.
  3. `POST {VITE_SUPABASE_URL}/auth/v1/admin/users` with the service-role key and
     `{email, password, email_confirm: true}`.
  4. Call `rat.add_volunteer(p_user_id)` with the caller's token, so `added_by` is the admin. If
     step 4 fails, delete the just-created auth user, so no account exists without a role.
  5. Return `{user_id, email, temp_password}`.
- **If the email already exists:**
  - a removed volunteer is re-activated by `rat.add_volunteer` (in training, must change password),
    with a new temporary password;
  - an active volunteer or an admin gets 409;
  - any other existing account also gets 409, with `"that email already has an account that isn't
    a volunteer: ask the developer"`. It never takes over or resets a stranger's account.
- **`reset {user_id}`:** a new temporary password for a volunteer, never for an admin. It sets
  `must_change_password`.
- **Errors:** every failure returns `{error}` with no key or password in it. The temporary password
  is never logged or stored.
- **SQL-only actions:** remove access, restore access and the training switch are plain RPCs
  (`rat.set_volunteer(p_user_id, p_in_training, p_active)`). They need no service key.

The logic lives in `lib/volunteers.ts` with vitest tests, `fetch` injected, as `lib/health.ts` does.
The handler stays thin.

### Pages (W)

- **Session:** `useAdminSession` becomes a role session using `rat.my_role()`, with status
  `signed-out | loading | admin | volunteer | no-access`. `RequireAdmin` gains a variant that
  admits volunteers, used on the Data fixes and Model check routes.
  - Admin-only routes: Migration status, Volunteers, Approvals, Changes.
  - A volunteer with `must_change_password` sees a "Choose your password" form first:
    `supabase.auth.updateUser({password})`, then `rat.password_changed()`.
  - **Check before building the form:** whether oci's auth server requires reauthentication to
    change a password (`GOTRUE_SECURITY_UPDATE_PASSWORD_REQUIRE_REAUTHENTICATION`; off by default).
    If it's on, `updateUser` wants an emailed code, which can't arrive. The password is then set
    through a `set_password` action on `api/volunteers.ts` instead: the caller's own token, the
    service key, and only for the caller's own account.
- **Menu:**
  - Admins get the "Archive workflow" steps as now, plus a "People" group: Volunteers, Approvals
    (with a held count), Changes.
  - Volunteers get only Data fixes and Model check, with an "In training: your answers are checked
    before they count" note.
- **`/admin/volunteers`:**
  - A table with email, role, in training (switch), held items, added, and Remove/Restore and Reset
    password buttons.
  - An "Add volunteer" form (email).
  - The temporary password appears once, in a copyable box, with "Give this to the volunteer in
    person or by phone. It won't be shown again."
- **`/admin/approvals`:**
  - Held items grouped by volunteer, oldest first.
  - Each row shows the photo thumbnail, image_no, description, the subject, the value before (or the
    model's answer) and the trainee's choice.
  - Approve and Reject per row, a select-all, and "Approve all from {name}".
  - Stale items are marked with the current value, and "Approve anyway" sends `p_force`.
- **`/admin/changes`:**
  - Filters: person, from/to date, kind.
  - Rows show time, person (and approver), photo, what changed (before → after), and an Undo button,
    disabled when already undone.
  - "Undo all N shown" asks for confirmation in a full sentence that names the count and the person,
    then reports done / changed since.
- **Trainee view:** on the Data fixes and Model check pages, a trainee sees "N waiting for approval"
  and a list of their rejected items with the admin's note.
- **Saves:** for a trainee the queue pages call `submit_*` instead of the direct save. The page
  shows "Sent for approval" instead of "Saved", and moves on as now.

## What's decided, and by whom

| Decision | By |
|---|---|
| The role is a human volunteer, called "AI volunteer", doing Model check and Data fixes | User |
| Trainee work is held until approved (B in brainstorming); an in-training switch per volunteer | User |
| Accounts created on the Volunteers page with a temporary password (option 1) | User |
| Holding tables (approach A) | User |
| Undo = recorded change; withdrawn answers stop counting; append-only kept | Proposed by me, played back, not objected to |
| Volunteers see only Data fixes and Model check | My call |
| Trainees can answer the blind sample, held like everything else | My call |
| Rejected work is kept and shown to the trainee with a note | My call |
| Held items are not editable; reject then redo | My call |
| A trainee's pending items hidden from their own queue only | My call |
| Stale held fix → skipped unless "Approve anyway" | My call |
| `answered_at` of an approved answer = when the trainee submitted it | My call |
| Withdrawing an answer also undoes its Data fixes fill, when unchanged since | My call |
| No ban on removal: RPCs check the role row on every call, so removal works at once | My call |
| `must_change_password` is a nudge, not enforcement | My call |
| Batch undo works per key and unwinds a run of changes to one fix in one step | My call (builder check) |
| Undo restores `needs_recheck`/`description_hash` from new history columns; older history sets `needs_recheck` | My call (builder check) |
| Held approve/reject rows are display-only; Undo lives on the change they produced; a rejection isn't undoable | My call (builder check) |
| An existing non-volunteer account is refused with 409, never taken over | My call (builder check) |
| `model_check_photo` stays admin-only | My call (builder check) |
| Answer fills are linked by `data_fix_history.model_answer_id`; older ones by timestamp matching | My call (builder check) |

## Left to the builder

- **The no-look-alike alphabet** for temporary passwords.
- **Page layout** on the three new pages, following the existing admin pages' styles and the
  `AdminSteps` nav.
- **Batch chunk size** (≤ 500) and paging size on Changes.
- **Session settings:** whether `rat.acting_for` / `rat.approved_by` are session settings or
  arguments threaded through the internal functions. Either way, the history trigger must record
  the trainee as `changed_by`.
- **The order of the migration file**, as long as it's idempotent and bootstrap gets the same end
  state.

## Testing

- **F (Docker postgres, `tests/test_volunteer_schema.py`):**
  - Role checks for every RPC in the access table, as admin, non-trainee volunteer, trainee, removed
    volunteer and stranger.
  - Submit, approve and reject for fixes and answers, including stale, force, re-submit and two
    trainees on one photo.
  - The history records the trainee as `changed_by` and the admin as `approved_by`.
  - Undo: a single undo, changed since, undo of an undo, and back to `extracted`.
  - Withdrawal: drops out of progress, confusion, queue and `model_train`'s query, the previous
    answer counts again, and the fill is undone.
  - `model_answer` and `model_answer_withdrawal` still refuse UPDATE, DELETE and TRUNCATE.
  - The guard trigger still blocks a reviewed overwrite outside review context.
  - The preservation checksum is unchanged by the migration itself.
- **W (vitest):**
  - `lib/volunteers.ts`: not-admin refused, create success, existing email (re-activate or 409),
    rollback when `add_volunteer` fails, reset refused for admins, and no secret in any answer.
  - Pure helpers for role status, menu items, change-row formatting, and batch chunking and summing.
- **By hand on the dev server before merge:** create a test volunteer, train, approve, reject,
  undo, and remove access, then delete the test account.

## Rollout

1. F: write the migration and tests, and fold the migration into bootstrap.
2. The user applies `add_volunteer_tables.sql` to live oci, with the preservation check before and
   after.
3. W: deploy the pages and function. No new Vercel variable is needed.
4. Update DEVOPS.md (§12 Data Fixes: roles, approvals, undo; the envelope checklist line about admin
   accounts now also covers volunteers) and the ops manual's Part 1 step 4.
