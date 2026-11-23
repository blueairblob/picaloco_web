# AI Volunteer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a human "AI volunteer" role (Data fixes + Model check only), hold trainees' work until an admin approves it, and give admins a Changes page that lists and undoes human changes.

**Architecture:** One idempotent SQL file in `filemaker_sync` adds the role, holding tables, a withdrawal table, history columns and admin RPCs. The direct save RPCs and the approve RPCs share one write path (`rat._apply_*`), so history always records the author and the approver. `picaloco_web` gains a role-aware session, three admin pages, a trainee save path, and one Vercel function (`api/volunteers.ts`) that creates accounts with the service-role key.

**Tech Stack:** PostgreSQL 17 (Supabase self-hosted, PostgREST), pytest against Docker `postgres:17`; Vite, React 19, TypeScript, Tailwind, React Query, supabase-js, vitest, oxlint; Vercel Node functions.

**Spec:** `picaloco_web/docs/superpowers/specs/2026-11-22-ai-volunteer-design.md`

Repos: F = `/mnt/d/dev/PROJECTS/RAT_Trains_Project/work_picaloco_dev/filemaker_sync`, W = `/mnt/d/dev/PROJECTS/RAT_Trains_Project/work_picaloco_dev/picaloco_web`. Work on branch `ai-volunteer` in both. W already has it, with the spec at d0178b0. Create it in F from `main`.

## Global Constraints

- **SQL style:**
  - Every new RPC is `SECURITY DEFINER`, `SET search_path = ''`, every name schema-qualified.
  - Error codes: 42501 when not allowed, 22023 for bad input, P0002 when not found, PT409 when stale. Never 40001.
- **Append-only stays append-only:**
  - No path updates, deletes or truncates `rat.model_answer`, `rat.model_answer_withdrawal` or `rat.data_fix_history` rows.
  - `rat.data_fix_value_guard` is unchanged.
  - A reviewed `data_fix_value` changes only inside a review-context window.
- **Additive only:** new columns are nullable with no default. The `data_fix_history.source` CHECK becomes `('extractor', 'review', 'model_check', 'undo')`.
- **One migration file:**
  - All DDL lives in `F/supabase/schema/add_volunteer_tables.sql`, wrapped in `BEGIN;` … `COMMIT;`, idempotent (`IF NOT EXISTS`, `CREATE OR REPLACE`, `DROP POLICY|TRIGGER IF EXISTS`).
  - It is applied after `add_model_check_tables.sql`.
  - `bootstrap_rat_schema.sql` carries a verbatim copy between the marker lines `-- >>> add_volunteer_tables.sql` and `-- <<< add_volunteer_tables.sql`.
- **Tests and the live DB:**
  - Tests never touch the live DB. F schema tests use the `pg` fixture.
  - Agents never run DDL on live oci; the user applies the file (Task 8).
- **Secrets:**
  - The service-role key is read only inside `api/volunteers.ts` and `lib/volunteers.ts`, from `process.env.SUPABASE_SERVICE_ROLE_KEY`.
  - No answer body contains a key.
  - The temporary password appears only in the `create` and `reset` success bodies, and is never logged.
- **Temporary password:** 12 characters from `ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789`, using `crypto.getRandomValues`.
- **Copy, verbatim from the spec:**
  - `"Give this to the volunteer in person or by phone. It won't be shown again."`
  - `"In training: your answers are checked before they count"`
  - `"that email already has an account that isn't a volunteer: ask the developer"`
  - `"trainee work is held for approval: use submit_*"`
  - `"Sent for approval"`
- **W checks:** every W task ends with `npm test`, `npm run lint` and `npm run build` all passing. Relative imports under `api/` and `lib/` end in `.js`.
- **Commits:** end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Never stage `.env*` or `.superpowers/`.

## Review Focus

1. **Email typed with capitals or spaces:** `" Bob@Example.org "` must find the same account as `bob@example.org`, never create a second one. Pinned in Task 9 (`create normalises the email`).
2. **Double-clicked approve, reject, undo or withdraw:** ids already decided, withdrawn or undone come back in `skipped` and change nothing. Pinned in Task 4 (`test_approve_twice_skips`) and Task 5 (`test_withdraw_twice_skips`).
3. **Volunteer removed with work still held:** the held items stay approvable by the admin; the removed volunteer gets 42501 on every RPC. Pinned in Task 4 (`test_removed_trainee_items_still_approvable`).
4. **Extractor change after a review:** an extractor history row for the key after the review blocks undo (`changed_since`), so an undo never hides a re-extraction. Pinned in Task 5 (`test_undo_blocked_by_later_extractor_row`).
5. **The fix row is gone when the admin approves** (an orphaned photo): that item is `skipped` with reason `'no data_fix_value'`, the rest of the batch still applies. Pinned in Task 4 (`test_approve_missing_row_skipped`).

---

## File Structure

**F (`filemaker_sync`)**

| File | Responsibility |
|---|---|
| `supabase/schema/add_volunteer_tables.sql` (create) | All new DDL and redefined functions |
| `supabase/schema/bootstrap_rat_schema.sql` (modify) | Verbatim copy between the markers |
| `supabase/schema/add_data_fix_tables.sql`, `add_model_check_tables.sql` (modify header only) | A warning: re-running either after `add_volunteer_tables.sql` reverts its function changes, so re-run `add_volunteer_tables.sql` afterwards |
| `tests/conftest.py` (modify) | Apply the new file after `MODEL_CHECK_SQL`; add the `make_volunteer` helper |
| `tests/test_volunteer_schema.py` (create) | Roles, access, held work, undo, withdrawal, change list |
| `scripts/model_train.py`, `scripts/load_model_run.py` (modify) | Ignore withdrawn answers |
| `tests/test_model_train.py`, `tests/test_load_model_run.py` (modify) | Pin that |
| `CLAUDE.md` (modify) | One "Where things live" row; Golden Rule 7 gains `model_answer_withdrawal` |

**W (`picaloco_web`)**

| File | Responsibility |
|---|---|
| `lib/volunteers.ts` + `.test.ts` (create) | Account actions: create, reset, set_password (fetch injected) |
| `api/volunteers.ts` (create) | Thin handler: method check, env, calls `lib/volunteers.ts` |
| `src/lib/roles.ts` + `.test.ts` (create) | `RoleStatus`, `roleStatusFrom`, `menuSections` |
| `src/lib/chunk.ts` + `.test.ts` (create) | `chunk`, `sumBatchResults` |
| `src/lib/changeRow.ts` + `.test.ts` (create) | Plain-words description of a change-list row |
| `src/hooks/useAdminSession.ts` + test (modify) | Becomes the role session (`my_role`) |
| `src/components/admin/RequireAdmin.tsx` (modify) | `allowVolunteers` prop; "Choose your password" gate |
| `src/components/admin/ChoosePasswordForm.tsx` (create) | The first-sign-in password form |
| `src/components/layout/UserMenu.tsx` (modify) | Menu per role |
| `src/services/dataFixService.ts`, `modelCheckService.ts` + tests (modify) | Trainee path calls `submit_*` and returns `held` |
| `src/services/volunteerService.ts`, `approvalService.ts`, `changeService.ts` + tests (create) | RPC and `/api/volunteers` wrappers |
| `src/pages/VolunteersPage.tsx`, `ApprovalsPage.tsx`, `ChangesPage.tsx` (create) | The three admin pages |
| `src/pages/FixQueuePage.tsx`, `ModelCheckQueuePage.tsx`, `DataFixesPage.tsx`, `ModelCheckPage.tsx` (modify) | "Sent for approval", held count, rejected list |
| `src/App.tsx` (modify) | Routes |
| `DEVOPS.md`, `docs/ops-manual/*` (modify) | §12 roles, approvals, undo; manual Part 1 step 4 |

---

## F tasks (filemaker_sync, branch `ai-volunteer`)

### Task 1: Volunteer role, helpers and people list

**Files:**
- Create: `F/supabase/schema/add_volunteer_tables.sql`
- Modify: `F/tests/conftest.py`, `F/supabase/schema/bootstrap_rat_schema.sql` (append the marked copy)
- Test: `F/tests/test_volunteer_schema.py`

**Interfaces:**
- Produces:
  - **Table `rat.volunteer`:** columns exactly as in the spec's table: `user_id`, `in_training`, `must_change_password`, `added_by`, `added_at`, `removed_by`, `removed_at`.
  - **Role checks:**
    - `rat.is_volunteer() → boolean`;
    - `rat.is_trainee() → boolean`;
    - `rat.can_review() → boolean`;
    - `rat.my_role() → jsonb` `{"role": "admin"|"volunteer"|null, "in_training": bool|null, "must_change_password": bool|null}`.
  - **`rat.add_volunteer(p_user_id uuid) → rat.volunteer`** (admin):
    - refuses an admin with 22023 `'admins cannot be volunteers'`;
    - refuses an active volunteer with 22023 `'already a volunteer'`;
    - re-activates a removed one (`removed_* = NULL`, `in_training = true`, `must_change_password = true`).
  - **`rat.set_volunteer(p_user_id uuid, p_in_training boolean DEFAULT NULL, p_active boolean DEFAULT NULL) → rat.volunteer`** (admin):
    - NULL leaves a field alone;
    - `p_active = false` sets `removed_by`/`removed_at`;
    - `true` clears them.
  - **`rat.require_password_change(p_user_id uuid) → void`** (admin, active volunteers only, else P0002).
  - **`rat.password_changed() → void`:** the caller's own row, a no-op for non-volunteers.
  - **`rat.account_status(p_email text DEFAULT NULL, p_user_id uuid DEFAULT NULL) → jsonb`** (admin) `{"user_id": uuid|null, "kind": "none"|"admin"|"volunteer"|"removed_volunteer"|"other"}`. The email is matched on `lower(trim(email))`.
  - **`rat.people() → TABLE(user_id uuid, email text, role text, in_training boolean, added_at timestamptz, removed_at timestamptz, held_count bigint)`** (admin):
    - covers every admin and volunteer;
    - `held_count` is 0 until Task 4 redefines it.
  - **conftest:** `make_volunteer(conn, uid=None, *, in_training=True, removed=False) -> str`. Apply order: `(STUBS_SQL, BOOTSTRAP_SQL, DATA_FIX_SQL, MODEL_CHECK_SQL, VOLUNTEER_SQL)`.

- [ ] **Step 1: Branch F.**

  ```bash
  cd F && git checkout main && git pull && git checkout -b ai-volunteer
  ```

- [ ] **Step 2: Write the failing tests** in `tests/test_volunteer_schema.py`:

```python
def test_my_role_per_kind(pg):
    a, v, t, gone, s = make_admin(pg), make_volunteer(pg, in_training=False), make_volunteer(pg), make_volunteer(pg, removed=True), make_user(pg)
    expect = {a: "admin", v: "volunteer", t: "volunteer", gone: None, s: None}
    for uid, role in expect.items():
        as_user(pg, uid)
        with pg.cursor() as cur:
            cur.execute("select rat.my_role()"); r = cur.fetchone()[0]
        assert r["role"] == role
        pg.rollback()
    as_user(pg, t)
    with pg.cursor() as cur:
        cur.execute("select rat.is_trainee(), rat.can_review()"); assert cur.fetchone() == (True, True)

def test_add_volunteer_rules(pg):     # admin refused 22023; active refused 22023; removed re-activated in_training+must_change
def test_add_volunteer_admin_only(pg): # volunteer/stranger calling add/set/people/account_status -> 42501
def test_set_volunteer_partial(pg):   # p_in_training only leaves removed_at; p_active false sets removed_by = caller
def test_account_status_kinds(pg):    # ' X@Example.test ' finds x@example.test; kinds none/admin/volunteer/removed_volunteer/other
def test_password_changed_self_only(pg)
def test_bootstrap_carries_volunteer_copy():
    boot = BOOTSTRAP_SQL.read_text(encoding="utf-8")
    block = boot.split("-- >>> add_volunteer_tables.sql\n")[1].split("-- <<< add_volunteer_tables.sql")[0]
    assert block == VOLUNTEER_SQL.read_text(encoding="utf-8")
```

  Fill the commented ones with the assertions their comments name.

- [ ] **Step 3: Run them.**

  ```bash
  venv/bin/pytest tests/test_volunteer_schema.py -q
  ```

  Expected: FAIL (`VOLUNTEER_SQL` / `make_volunteer` not defined).

- [ ] **Step 4: Implement.**
  - Add the file header, which says what it adds and that the user applies it to live after `add_model_check_tables.sql`.
  - Add the table, the functions above and the conftest changes.
  - Grant EXECUTE to `authenticated` on all of the above. RLS on `rat.volunteer` gets no policy, so it is reached only through functions.
  - Append the marked copy to bootstrap.

- [ ] **Step 5: Run the tests.**

  ```bash
  venv/bin/pytest tests/ -q
  ```

  Expected: all pass, with the earlier schema tests unchanged.

- [ ] **Step 6: Commit** `feat: AI volunteer role and people list (schema)`.

### Task 2: One write path, history columns, access for direct saves and reads

**Files:**
- Modify: `F/supabase/schema/add_volunteer_tables.sql`, the bootstrap copy, `F/tests/test_volunteer_schema.py`

**Interfaces:**
- Consumes: Task 1's role functions.
- Produces:
  - **Columns:**
    - `rat.data_fix_history`: `approved_by uuid`, `undoes bigint`, `undoes_from bigint`, `model_answer_id bigint`, `old_needs_recheck boolean`, `old_description_hash text`.
    - `rat.model_answer`: `approved_by uuid`, `approved_at timestamptz`.
    - Source CHECK: drop every source check by name lookup (as `fix_data_fix_model_check.sql` does), then add `data_fix_history_source_check` with the 4 values.
  - **`rat.data_fix_value_history()` redefined:**
    - `changed_by = coalesce(nullif(current_setting('rat.acting_for', true), '')::uuid, auth.uid())`;
    - `approved_by`, `model_answer_id`, `undoes` and `undoes_from` come from the settings `rat.approved_by`, `rat.model_answer_id`, `rat.undoes` and `rat.undoes_from` (empty means NULL);
    - `old_needs_recheck = OLD.needs_recheck` and `old_description_hash = OLD.description_hash` on UPDATE;
    - source is `'undo'` when `rat.review_source = 'undo'`, otherwise as today.
  - **Internal functions** (no EXECUTE for `authenticated`; REVOKE from PUBLIC):
    - `rat._apply_fix_review(p_image_no text, p_fix_id text, p_values text[], p_status text, p_expected_updated_at timestamptz, p_by uuid, p_approved_by uuid) → rat.data_fix_value`. This is today's `review_fix_value` body, with `reviewed_by = p_by` and the settings set and cleared inside the window.
    - `rat._apply_model_answer(p_task_id text, p_image_no text, p_answer text, p_shown_run_id bigint, p_shown_answer text, p_mode text, p_by uuid, p_approved_by uuid, p_answered_at timestamptz) → jsonb`. This is today's `save_model_answer` body:
      - the insert sets `answered_by = p_by`, `answered_at = coalesce(p_answered_at, now())`, and `approved_by`/`approved_at` when approved;
      - the fill sets `rat.model_answer_id`.
  - **Direct saves:** `review_fix_value`, `confirm_fix_values` and `save_model_answer` keep their signatures and results.
    - Allowed: `is_admin() OR (is_volunteer() AND NOT is_trainee())`.
    - A trainee gets 42501 `'trainee work is held for approval: use submit_*'`.
    - Anyone else gets 42501 as today.
    - `confirm_fix_values` keeps its own set-based UPDATE, with `reviewed_by = auth.uid()`.
  - **Reads:** `data_fix_queue`, `data_fix_progress`, `model_check_queue` and `model_check_progress` check `rat.can_review()`. `model_check_photo`, `model_check_confusion`, `model_check_conflicts` and `data_fix_orphans` stay admin-only.
  - **RLS:** the SELECT policies on `rat.data_fix`, `rat.data_fix_value`, `rat.model_task` and `rat.model_run` use `rat.can_review()`.
  - **Source text:** copy each redefined function from its current text in `add_data_fix_tables.sql` / `add_model_check_tables.sql` (they already hold every `fix_*.sql` change).

- [ ] **Step 1: Write the failing tests:**

```python
WRITE_RPCS = ["review_fix_value", "confirm_fix_values", "save_model_answer"]
@pytest.mark.parametrize("who,ok", [("admin", True), ("volunteer", True), ("trainee", False), ("removed", False), ("stranger", False)])
def test_direct_save_access(pg, who, ok):   # each write RPC; trainee error message contains 'held for approval'
@pytest.mark.parametrize("rpc", ["data_fix_queue", "data_fix_progress", "model_check_queue", "model_check_progress"])
def test_reads_open_to_volunteers(pg, rpc):  # volunteer + trainee succeed; removed + stranger 42501
def test_admin_only_reads_stay(pg):           # volunteer gets 42501 on model_check_photo/confusion/conflicts/data_fix_orphans
def test_volunteer_rls_tables(pg):            # volunteer can select rat.data_fix/data_fix_value/model_task/model_run; not data_fix_history/model_answer
def test_history_records_old_flags(pg):       # review a needs_recheck row -> history.old_needs_recheck true, old_description_hash = previous hash
def test_fill_history_links_answer(pg):       # save_model_answer that fills -> history rows carry model_answer_id = answer id
def test_guard_still_blocks_reviewed_overwrite(pg)  # plain UPDATE of a reviewed row outside review context still raises 'reviewed value is protected'
```

- [ ] **Step 2: Run them.**

  ```bash
  venv/bin/pytest tests/test_volunteer_schema.py -q
  ```

  Expected: the new tests FAIL.

- [ ] **Step 3: Implement** the interfaces above in the migration file, then refresh the bootstrap copy.

- [ ] **Step 4: Run the whole suite.**

  ```bash
  venv/bin/pytest tests/ -q
  ```

  Expected: all pass, including the existing `test_data_fix_schema.py` and `test_model_check_schema.py`. They prove the refactor kept behaviour.

- [ ] **Step 5: Commit** `feat: one write path for reviews and answers; volunteers can review`.

### Task 3: Withdrawn answers and the live-answer view

**Files:** same three as Task 2.

**Interfaces:**
- Produces:
  - **Table `rat.model_answer_withdrawal`:** `answer_id bigint PRIMARY KEY REFERENCES rat.model_answer(id)`, `withdrawn_by uuid NOT NULL`, `withdrawn_at timestamptz NOT NULL DEFAULT now()`, `note text`. It is append-only through triggers that use `rat.model_answer_append_only()`.
  - **View `rat.model_answer_live`:** `model_answer` rows with no withdrawal row. No grants.
  - **Uses of the view:** `model_check_queue`, `model_check_progress`, `model_check_confusion`, `model_check_conflicts` and `model_check_photo` read `rat.model_answer_live` wherever they read `rat.model_answer`.

- [ ] **Step 1: Write the failing tests:**

```python
def test_withdrawal_append_only(pg)          # update/delete/truncate raise 'append-only'
def test_withdrawn_answer_stops_counting(pg)  # 2 answers on a photo (wrong then right); withdraw the newer -> progress/confusion use the older; withdraw both -> photo back in model_check_queue
def test_withdrawn_blind_leaves_sample(pg)    # withdrawn 'sample' answer -> photo back in sample queue, n_blind drops
```

  Insert withdrawals directly as the owner here. The RPC comes in Task 5.

- [ ] **Step 2: Run.** Expected: FAIL.

- [ ] **Step 3: Implement**, then refresh the bootstrap copy.

- [ ] **Step 4: Run.**

  ```bash
  venv/bin/pytest tests/ -q
  ```

  Expected: all pass.

- [ ] **Step 5: Commit** `feat: withdrawn model answers stop counting`.

### Task 4: Held work: submit, approve, reject, lists

**Files:** same three.

**Interfaces:**
- Consumes: `_apply_fix_review` and `_apply_model_answer` (Task 2), `model_answer_live` (Task 3).
- Produces:
  - **`rat.pending_fix_review`:** columns as in the spec.
    - `decision` CHECK `('pending','approved','rejected','withdrawn')`, default `'pending'`.
    - Partial unique index on `(submitted_by, image_no, fix_id) WHERE decision = 'pending'`.
  - **`rat.pending_model_answer`:** columns as in the spec.
    - The same blind CHECK as `model_answer`.
    - Partial unique index on `(submitted_by, task_id, image_no, mode) WHERE decision = 'pending'`.
  - **Submit RPCs** (trainee only, others 42501). Each validates as its direct twin does. A re-submit marks the caller's pending row for the key `withdrawn` (`decided_by` = the caller) before inserting.
    - `rat.submit_fix_review(p_image_no text, p_fix_id text, p_values text[], p_status text, p_expected_updated_at timestamptz) → bigint`. The base snapshot comes from the current row.
    - `rat.submit_fix_confirm(p_fix_id text, p_items jsonb) → integer`. It holds one `verified` row with `values = suggested_values` per item still `extracted` whose `updated_at` matches, and returns the count.
    - `rat.submit_model_answer(p_task_id text, p_image_no text, p_answer text, p_shown_run_id bigint, p_shown_answer text, p_mode text) → bigint`.
  - **Admin decision RPCs.** Each item is handled on its own, in id order, and an error in one item becomes `skipped`, never a failed call.
    - **`rat.approve_fix_review(p_ids bigint[], p_force boolean DEFAULT false) → jsonb`** returns `{"approved": int, "stale": [{"id", "current_values", "current_status"}], "skipped": [{"id", "reason"}]}`.
      - Reasons: `'not pending'`, `'no data_fix_value'`.
      - It applies through `_apply_fix_review(…, p_expected_updated_at => CASE WHEN p_force THEN <current> ELSE base_updated_at END, p_by => submitted_by, p_approved_by => auth.uid())`.
      - A PT409 becomes `stale`.
    - **`rat.approve_model_answer(p_ids bigint[]) → jsonb`** returns `{"approved": int, "skipped": [...]}`, applying through `_apply_model_answer(…, p_by => submitted_by, p_approved_by => auth.uid(), p_answered_at => submitted_at)`.
    - **`rat.reject_held(p_kind text, p_ids bigint[], p_note text) → jsonb`** returns `{"rejected": int, "skipped": [...]}`. `p_kind` is `'fix'` or `'answer'`, else 22023.
    - **`rat.held_list(p_user uuid DEFAULT NULL) → TABLE(kind text, id bigint, submitted_by uuid, submitted_at timestamptz, image_no text, description text, subject text, before jsonb, proposed jsonb, current jsonb, stale boolean)`**: pending rows only, oldest first.
      - Fix: `subject` is the `data_fix.title`; `before` is `{values, status}` (base); `proposed` is `{values, status}`; `current` is the live row's `{values, status}`; `stale = live.updated_at <> base_updated_at`.
      - Answer: `subject` is the `model_task.question`; `before` is `{shown_answer}`; `proposed` is `{answer, mode}`; `current` is NULL; `stale` is false.
  - **`rat.my_held() → TABLE(kind text, id bigint, image_no text, subject text, proposed jsonb, decision text, decided_at timestamptz, note text)`**: the caller's `pending` and `rejected` rows, newest first.
  - **Redefinitions:**
    - `rat.people()`: `held_count` = the user's pending rows across both tables.
    - `data_fix_queue` / `model_check_queue` leave out keys the caller has pending (per mode for answers).

- [ ] **Step 1: Write the failing tests:**

```python
def test_submit_trainee_only(pg)                   # admin/volunteer/stranger -> 42501
def test_submit_holds_nothing_live(pg)             # after submit_fix_review/submit_model_answer: data_fix_value unchanged, no model_answer row, progress unchanged
def test_resubmit_withdraws_previous(pg)           # second submit same key -> first decision 'withdrawn', one pending row
def test_own_pending_hidden_from_own_queue_only(pg) # trainee A's queue lacks the key; trainee B and admin still see it
def test_approve_fix_records_author_and_approver(pg):
    # value updated; data_fix_value.reviewed_by == trainee; newest history row changed_by == trainee, approved_by == admin, source == 'review'
def test_approve_stale_then_force(pg)              # live row changed after submit -> 'stale' with current values; p_force -> approved
def test_approve_twice_skips(pg)                   # second approve of same id -> skipped reason 'not pending', no second history row
def test_approve_missing_row_skipped(pg)           # delete the data_fix_value row (as owner) before approve -> skipped 'no data_fix_value'; other id in batch approved
def test_approve_answer_dates_and_fills(pg)        # model_answer.answered_by == trainee, answered_at == submitted_at, approved_by == admin; no_loco fill history has approved_by + model_answer_id
def test_reject_keeps_note_and_my_held(pg)         # reject with note -> my_held() for trainee shows decision 'rejected' + note
def test_removed_trainee_items_still_approvable(pg) # remove trainee -> trainee submit 42501; admin approve still applies with changed_by == trainee
def test_people_held_count(pg)
```

- [ ] **Step 2: Run.** Expected: FAIL.

- [ ] **Step 3: Implement**, then refresh the bootstrap copy.

- [ ] **Step 4: Run.**

  ```bash
  venv/bin/pytest tests/ -q
  ```

  Expected: all pass.

- [ ] **Step 5: Commit** `feat: trainee work held until an admin approves it`.

### Task 5: Undo and withdraw

**Files:** same three.

**Interfaces:**
- Consumes: the history columns (Task 2), `model_answer_withdrawal` (Task 3).
- Produces:
  - **`rat.undo_fix_change(p_history_ids bigint[]) → jsonb`** (admin) returns `{"undone": int, "changed_since": [history ids], "skipped": [{"id", "reason"}]}`.
    - It follows the spec's per-key rule exactly.
    - Ids whose source is `extractor` are `skipped` with `'not a human change'`. Unknown ids are skipped with `'no such change'`.
    - Any history row for the key later than the earliest given row, and not in the set, blocks that key. That includes extractor rows.
    - It writes in a review-context window with `rat.review_source = 'undo'` and `rat.undoes` = the newest given id and `rat.undoes_from` = the earliest. `undoes_from` is a plan-level addition to the spec's `undoes`: it records which run of history an undo covers.
  - **`rat.withdraw_model_answers(p_answer_ids bigint[], p_note text) → jsonb`** (admin) returns `{"withdrawn": int, "skipped": [{"id", "reason"}], "fills_left": [{"image_no", "fix_id"}]}`.
    - An already-withdrawn id is skipped with `'already withdrawn'`.
    - Its fills are found by `model_answer_id`, or for older rows by timestamp matching (spec). They are undone through the same per-key logic. A blocked key goes to `fills_left`.

- [ ] **Step 1: Write the failing tests:**

```python
def test_undo_single_review(pg)                 # value back to old; status back; history row source 'undo', undoes = id
def test_undo_back_to_extracted_clears_reviewer(pg)
def test_undo_restores_recheck_flags(pg)        # needs_recheck/description_hash back from old_* columns
def test_undo_old_history_sets_recheck(pg)      # history row with NULL old_* (insert one as owner) restoring a reviewed status -> needs_recheck true
def test_batch_undo_unwinds_run_per_key(pg)     # two reviews on one key, both ids given -> back to state before the first, one undo row
def test_undo_partial_set_is_changed_since(pg)  # only the older id given -> changed_since, value unchanged
def test_undo_blocked_by_later_extractor_row(pg)
def test_undo_of_undo_reapplies(pg)
def test_withdraw_answer_undoes_fill(pg)        # answer filled no_loco -> withdraw -> rows back to extracted, answer gone from progress
def test_withdraw_fill_changed_since_left(pg)   # fill then a human review -> withdraw -> fills_left lists the key
def test_withdraw_twice_skips(pg)
def test_undo_withdraw_admin_only(pg)           # volunteer -> 42501
def test_preservation_checksum_untouched_by_migration(pg)  # checksum before/after re-applying VOLUNTEER_SQL equal
```

- [ ] **Step 2: Run.** Expected: FAIL.

- [ ] **Step 3: Implement**, then refresh the bootstrap copy.

- [ ] **Step 4: Run.**

  ```bash
  venv/bin/pytest tests/ -q
  ```

  Expected: all pass.

- [ ] **Step 5: Commit** `feat: undo data fix changes and withdraw model answers`.

### Task 6: Change list

**Files:** same three.

**Interfaces:**
- Produces: **`rat.change_list(p_user uuid DEFAULT NULL, p_from timestamptz DEFAULT NULL, p_to timestamptz DEFAULT NULL, p_kinds text[] DEFAULT NULL, p_after text DEFAULT NULL, p_limit integer DEFAULT 100) → TABLE(cursor text, kind text, at timestamptz, by uuid, approved_by uuid, image_no text, subject text, before jsonb, after jsonb, ref_table text, ref_id bigint, undone boolean)`** (admin).
  - **Kinds and sources** as in the spec's table. Pending rows give `held_submitted` (at `submitted_at`), `held_approved` and `held_rejected` (at `decided_at`, by `decided_by`). `withdrawn` decisions aren't listed.
  - **`ref_table`:** `data_fix_history` | `model_answer` | `model_answer_withdrawal` | `pending_fix_review` | `pending_model_answer`.
  - **`undone`:**
    - a history row `h` is undone when an `undo` row `u` for the same key has `u.undoes_from <= h.id <= u.undoes`, and `u` is not itself undone (apply the same rule recursively, so undoing an undo makes its run count again);
    - an answer is undone when it is withdrawn.
  - **Order** is `at DESC, ref_table, ref_id DESC`. `cursor` = `to_char(at,'YYYY-MM-DD"T"HH24:MI:SS.US') || '|' || ref_table || '|' || ref_id`, and `p_after` continues strictly after that cursor.
  - `p_limit` is clamped to 1..500.

- [ ] **Step 1: Write the failing tests:**

```python
def test_change_list_kinds_and_people(pg)  # one of each kind appears; p_user filters by `by`; extractor rows absent
def test_change_list_paging(pg)            # 5 events, limit 2, follow cursors -> 5 distinct rows in order, no repeats
def test_change_list_dates(pg)             # p_from/p_to bound `at`
def test_change_list_undone_flags(pg)      # undone review and withdrawn answer flagged
def test_change_list_admin_only(pg)
```

- [ ] **Step 2: Run.** Expected: FAIL.

- [ ] **Step 3: Implement**, then refresh the bootstrap copy.

- [ ] **Step 4: Run.**

  ```bash
  venv/bin/pytest tests/ -q
  ```

  Expected: all pass.

- [ ] **Step 5: Commit** `feat: change list for the admin audit page`.

### Task 7: Scripts ignore withdrawn answers; F docs

**Files:**
- Modify: `F/scripts/model_train.py` (the query at ~line 226), `F/scripts/load_model_run.py:84`, their tests, the headers of `add_data_fix_tables.sql` and `add_model_check_tables.sql`, and `F/CLAUDE.md`.

**Interfaces:**
- Produces: `model_train.ANSWERS_SQL` (module constant) reading `rat.model_answer_live`. `load_model_run.py`'s "has answers" check reads `rat.model_answer_live`.

- [ ] **Step 1: Write the failing tests:**
  - `test_answers_sql_skips_withdrawn` in `tests/test_model_train.py`, using `pg`: seed 2 answers, withdraw one, run `ANSWERS_SQL`, and only the other comes back.
  - `test_has_answers_ignores_withdrawn` in `tests/test_load_model_run.py`.

- [ ] **Step 2: Run.** Expected: FAIL.

- [ ] **Step 3: Implement.**
  - Move the query into `ANSWERS_SQL`.
  - Add the header warning to the two add files.
  - In `CLAUDE.md`:
    - add a "Where things live" row: `AI volunteer role, held work, undo, change list | supabase/schema/add_volunteer_tables.sql`;
    - extend Golden Rule 7 so `rat.model_answer_withdrawal`, `rat.pending_fix_review` and `rat.pending_model_answer` are irreplaceable too.

- [ ] **Step 4: Run.**

  ```bash
  venv/bin/pytest tests/ -q
  ```

  Expected: all pass.

- [ ] **Step 5: Commit** `feat: training and loader ignore withdrawn answers; docs`.

### Task 8: CHECKPOINT: user applies the migration to live oci

This step is the user's. The executor stops here and asks.

- [ ] **Step 1:** Push F `ai-volunteer`. Give the user these commands to run, in order:

  ```bash
  venv/bin/python scripts/data_fix_preservation_check.py --target-profile oci   # note the output
  psql "<oci connection>" -v ON_ERROR_STOP=1 -f supabase/schema/add_volunteer_tables.sql
  venv/bin/python scripts/data_fix_preservation_check.py --target-profile oci   # must match the first output exactly
  ```

- [ ] **Step 2:** Wait for the user's confirmation that both checksums match. Then continue with W.

---

## W tasks (picaloco_web, branch `ai-volunteer`)

### Task 9: Account function

**Files:**
- Create: `W/lib/volunteers.ts`, `W/lib/volunteers.test.ts`, `W/api/volunteers.ts`

**Interfaces:**
- Consumes: the RPCs `rat.is_admin`, `rat.account_status`, `rat.add_volunteer` and `rat.require_password_change` through PostgREST. They are called with the caller's token (`Authorization: Bearer <token>`, `apikey: <anon>`, `Content-Profile: rat`).
- Produces: `handleVolunteers(opts: { url?: string; anonKey?: string; serviceKey?: string; authHeader?: string; body: unknown; fetchFn?: FetchFn; random?: (n: number) => Uint8Array }): Promise<{ status: number; body: Record<string, unknown> }>` and `TEMP_PASSWORD_ALPHABET`.
  - **Actions:**
    - `create {email}`: success is 200 `{user_id, email, temp_password}`.
    - `reset {user_id}`: success is 200 `{temp_password}`.
    - `set_password {password}`: success is 200 `{ok:true}`. It applies to the caller's own id only. It's used only if Task 10's check finds that reauthentication is on, but it's built and tested now.
  - **Failures:**
    - 401 with no token;
    - 403 when not an admin (except `set_password`);
    - 400 for a bad body;
    - 409 for these cases: an admin or an active volunteer, `"already a volunteer"`; any other account, the exact copy `"that email already has an account that isn't a volunteer: ask the developer"`;
    - 502 when the server fails;
    - 500 when not configured.
  - **GoTrue calls:**
    - `POST {url}/auth/v1/admin/users` with `{email, password, email_confirm: true}`;
    - `PUT {url}/auth/v1/admin/users/{id}` with `{password}`;
    - `DELETE {url}/auth/v1/admin/users/{id}` for the rollback;
    - each with `apikey` and `Authorization: Bearer <serviceKey>`.
- `api/volunteers.ts` is POST only (405 with `Allow: POST` otherwise) and sets `Cache-Control: no-store`. It passes `process.env.VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` and `req.headers.authorization`.

- [ ] **Step 1: Write the failing tests** in `lib/volunteers.test.ts`, with a fake `fetchFn` that records calls and answers by URL:

```ts
it('refuses without a token', ...)                       // 401, no fetch
it('refuses a non-admin', ...)                           // is_admin false -> 403, no GoTrue call
it('create makes the account, grants the role, returns the password once', ...)
  // GoTrue POST body {email:'bob@example.org', email_confirm:true}; add_volunteer called with p_user_id; body.temp_password length 12, every char in TEMP_PASSWORD_ALPHABET
it('create normalises the email', ...)                   // ' Bob@Example.org ' -> account_status p_email 'bob@example.org', GoTrue email 'bob@example.org'
it('create re-activates a removed volunteer with a new password', ...) // kind removed_volunteer -> PUT password, add_volunteer, no POST
it('create refuses existing accounts', ...)              // admin/volunteer -> 409 'already a volunteer'; other -> 409 exact copy
it('create rolls back the account when the role grant fails', ...) // add_volunteer 500 -> DELETE /admin/users/<id>, 502
it('reset only for active volunteers', ...)              // kind admin -> 409, no PUT; volunteer -> PUT + require_password_change
it('set_password changes only the caller', ...)          // id taken from GET /auth/v1/user with the caller token, never from the body
it('never puts a key in any answer', ...)                // service and anon keys absent from JSON.stringify(result) across all cases
```

- [ ] **Step 2: Run them.**

  ```bash
  npx vitest run lib/volunteers.test.ts
  ```

  Expected: FAIL (module missing).

- [ ] **Step 3: Implement** `lib/volunteers.ts`, then the thin `api/volunteers.ts` (the `api/health.ts` pattern).

- [ ] **Step 4: Run the checks.**

  ```bash
  npm test && npm run lint && npm run build
  ```

  Expected: all pass.

- [ ] **Step 5: Commit** `feat: /api/volunteers creates and resets volunteer accounts`.

### Task 10: Role session, menu, route guard, first password

**Files:**
- Create: `W/src/lib/roles.ts` + test, `W/src/components/admin/ChoosePasswordForm.tsx`
- Modify: `W/src/hooks/useAdminSession.ts` + test, `W/src/components/admin/RequireAdmin.tsx`, `W/src/components/layout/UserMenu.tsx`, `W/src/App.tsx`, and every user of the old `'not-admin'` status

**Interfaces:**
- Consumes: `rat.my_role()`, `rat.password_changed()`.
- Produces:
  - **`src/lib/roles.ts`:**
    - `type RoleStatus = 'loading' | 'signed-out' | 'no-access' | 'admin' | 'volunteer'`;
    - `type MyRole = { role: 'admin' | 'volunteer' | null; in_training: boolean | null; must_change_password: boolean | null }`;
    - `roleStatusFrom(hasSession: boolean, myRole: MyRole | null | undefined): RoleStatus`, where undefined means loading;
    - `menuSections(status: RoleStatus, inTraining: boolean): { title: string; items: { label: string; hint?: string; path: string }[] }[]`.
  - **`useAdminSession()`** returns `{ status: RoleStatus, email, inTraining: boolean, mustChangePassword: boolean, signIn, signOut, refreshRole }`.
  - **`<RequireAdmin allowVolunteers?>`:**
    - when the status is `volunteer` and `mustChangePassword` is set, it renders `ChoosePasswordForm`;
    - the form calls `adminSupabase.auth.updateUser({ password })`, then `rpc('password_changed')`, then `refreshRole()`.
  - **Routes:**
    - `/admin/fixes*` and `/admin/model-check*` use `allowVolunteers`;
    - `/admin` (Migration status), `/admin/volunteers`, `/admin/approvals` and `/admin/changes` are admin only. Their pages arrive in Tasks 12–14; until then they are stub pages saying "Coming soon".

- [ ] **Step 1: Write the failing tests** in `src/lib/roles.test.ts`:

```ts
it('maps session and role to a status', ...)  // (false, *) signed-out; (true, undefined) loading; role null -> no-access; admin; volunteer
it('admin menu: workflow steps then People', ...)
  // titles ['Archive workflow','People']; People paths ['/admin/volunteers','/admin/approvals','/admin/changes']
it('volunteer menu: only Data fixes and Model check', ...)
  // one section, paths ['/admin/fixes','/admin/model-check']; inTraining true adds hint 'In training: your answers are checked before they count'
```

  Also update `useAdminSession.test.ts` to the new names.

- [ ] **Step 2: Run them.**

  ```bash
  npx vitest run src/lib/roles.test.ts src/hooks/useAdminSession.test.ts
  ```

  Expected: FAIL.

- [ ] **Step 3: Implement.** The menu renders `menuSections`, and `UserMenu` keeps its existing styling.

- [ ] **Step 4: Run the checks.**

  ```bash
  npm test && npm run lint && npm run build
  ```

  Expected: all pass.

- [ ] **Step 5: Check reauthentication** (live, needs Task 8 done).
  1. Ask the user to run the dev server (`npm run dev`). Using Task 9's API through curl, or a scratch script reading `ADMIN_TEST_EMAIL`/`ADMIN_TEST_PASSWORD` from `.env.local` without printing them, create a test volunteer `ai-volunteer-test@example.org`.
  2. Sign in as that volunteer and submit the password form.
  3. **If `updateUser` succeeds**, record "reauth off" in the ledger.
  4. **If it fails** with a reauthentication or nonce error, switch the form to `POST /api/volunteers {action:'set_password', password}` and ledger a Ruling.

  Keep the test account for Task 15.

- [ ] **Step 6: Commit** `feat: role-aware session, menu and first-password form`.

### Task 11: Trainee save path

**Files:**
- Modify: `W/src/services/dataFixService.ts` + test, `W/src/services/modelCheckService.ts` + test, `W/src/pages/FixQueuePage.tsx`, `W/src/pages/ModelCheckQueuePage.tsx`, `W/src/pages/DataFixesPage.tsx`, `W/src/pages/ModelCheckPage.tsx`
- Create: `W/src/services/approvalService.ts` (`myHeld` only here) + test

**Interfaces:**
- Consumes: `submit_fix_review`, `submit_fix_confirm`, `submit_model_answer`, `my_held`; `inTraining` from `useAdminSession`.
- Produces:
  - **`reviewValue(i, opts?: { trainee?: boolean })`:** for trainees it calls `submit_fix_review` with the same arguments and returns `{ ok: true, held: true }`.
  - **The `ReviewOutcome` ok branch** becomes `{ ok: true; updated_at: string; held?: false } | { ok: true; held: true }`.
  - **`confirmMany(fixId, items, opts?)`:** trainee → `submit_fix_confirm`, still returning the count.
  - **`saveModelAnswer(i, opts?)`:** trainee → `submit_model_answer` returns `{ ok: true, held: true, filled: [], conflicts: [] }`.
  - **`myHeld(): Promise<HeldMine[]>`**, where `HeldMine = { kind: 'fix' | 'answer'; id: number; image_no: string; subject: string; proposed: Record<string, unknown>; decision: 'pending' | 'rejected'; decided_at: string | null; note: string | null }`.
  - **Pages:**
    - a held save shows `"Sent for approval"` where "Saved" shows now, and moves on as now;
    - a held fix keeps the record's previous `updated_at` locally;
    - the Data fixes and Model check overview pages show "N waiting for approval" plus a "Sent back" list (image_no, subject, note) from `myHeld()` when the user is a trainee.

- [ ] **Step 1: Write the failing tests:**
  - In `dataFixService.test.ts`, `it('trainee reviews go to submit_fix_review and come back held')`: the rpc name is asserted, and so is the outcome `{ok:true, held:true}`.
  - The same for `confirmMany` and `saveModelAnswer`.
  - `approvalService.test.ts` gets `myHeld maps rows`.

- [ ] **Step 2: Run them.**

  ```bash
  npx vitest run src/services
  ```

  Expected: FAIL.

- [ ] **Step 3: Implement.**

- [ ] **Step 4: Run the checks.**

  ```bash
  npm test && npm run lint && npm run build
  ```

  Expected: all pass.

- [ ] **Step 5: Commit** `feat: trainee saves are sent for approval`.

### Task 12: Volunteers page

**Files:**
- Create: `W/src/services/volunteerService.ts` + test, `W/src/pages/VolunteersPage.tsx`
- Modify: `W/src/App.tsx` (replace the stub)

**Interfaces:**
- Consumes: `/api/volunteers` (Task 9); `rat.people`, `rat.set_volunteer`.
- Produces:
  - **`volunteerService.ts`:**
    - `listPeople(): Promise<Person[]>`;
    - `addVolunteer(email: string): Promise<{ ok: true; email: string; tempPassword: string } | { ok: false; message: string }>`;
    - `resetPassword(userId: string)` (same result shape);
    - `setVolunteer(userId: string, p: { inTraining?: boolean; active?: boolean }): Promise<void>`.
  - **The API calls** send `Authorization: Bearer <access_token>` from `adminSupabase.auth.getSession()`.
  - **The page:**
    - a table with email, role, in training (switch), held, added, and Remove/Restore and Reset password buttons (the admin rows show no buttons);
    - an "Add volunteer" form;
    - the one-time password box with the exact copy `"Give this to the volunteer in person or by phone. It won't be shown again."` and a Copy button. It clears when the admin leaves the page.

- [ ] **Step 1: Write the failing tests** in `volunteerService.test.ts`:
  - `addVolunteer posts action create with the bearer token`;
  - `addVolunteer returns the server message on 409`;
  - `setVolunteer sends only the given fields` (`p_in_training` null when omitted).

- [ ] **Step 2: Run them.**

  ```bash
  npx vitest run src/services/volunteerService.test.ts
  ```

  Expected: FAIL.

- [ ] **Step 3: Implement** the service and the page.

- [ ] **Step 4: Run the checks.**

  ```bash
  npm test && npm run lint && npm run build
  ```

  Expected: all pass.

- [ ] **Step 5: Commit** `feat: Volunteers page`.

### Task 13: Approvals page

**Files:**
- Modify: `W/src/services/approvalService.ts` + test, `W/src/App.tsx`
- Create: `W/src/pages/ApprovalsPage.tsx`

**Interfaces:**
- Consumes: `held_list`, `approve_fix_review`, `approve_model_answer`, `reject_held`, `people`.
- Produces:
  - **`approvalService`:**
    - `listHeld(userId?: string): Promise<HeldItem[]>`;
    - `approve(kind: 'fix' | 'answer', ids: number[], force?: boolean): Promise<DecisionResult>`;
    - `reject(kind, ids, note?: string): Promise<DecisionResult>`;
    - `type DecisionResult = { done: number; stale: { id: number; current_values: string[]; current_status: string }[]; skipped: { id: number; reason: string }[] }`.
  - **The page:**
    - items are grouped by volunteer (email from `people`), oldest first;
    - each row shows the photo thumbnail (the existing image helper), image_no, description, subject, before → proposed, and Approve/Reject (an optional note box);
    - select-all, and "Approve all from {email}";
    - stale rows show the current value and an "Approve anyway" button (`force`);
    - after each action a summary line reads: "N approved, N changed since, N skipped".
  - **Menu:** the "Approvals" item shows the total held count. The sum of `people().held_count` is acceptable.

- [ ] **Step 1: Write the failing tests:**
  - `approve('fix') calls approve_fix_review with p_force false by default`;
  - `approve('answer') calls approve_model_answer`;
  - `reject passes kind and note`;
  - `results map to DecisionResult`.

- [ ] **Step 2: Run them.**

  ```bash
  npx vitest run src/services/approvalService.test.ts
  ```

  Expected: FAIL.

- [ ] **Step 3: Implement.**

- [ ] **Step 4: Run the checks.**

  ```bash
  npm test && npm run lint && npm run build
  ```

  Expected: all pass.

- [ ] **Step 5: Commit** `feat: Approvals page`.

### Task 14: Changes page

**Files:**
- Create: `W/src/lib/chunk.ts` + test, `W/src/lib/changeRow.ts` + test, `W/src/services/changeService.ts` + test, `W/src/pages/ChangesPage.tsx`
- Modify: `W/src/App.tsx`

**Interfaces:**
- Consumes: `change_list`, `undo_fix_change`, `withdraw_model_answers`, `people`.
- Produces:
  - **`chunk<T>(items: T[], size: number): T[][]`** throws when `size < 1`.
  - **`sumBatchResults(rs: { undone?: number; withdrawn?: number; changed_since?: unknown[]; fills_left?: unknown[]; skipped?: unknown[] }[]): { done: number; changedSince: number; skipped: number }`**. `fills_left` counts as `changedSince`.
  - **`describeChange(row: ChangeRow): { what: string; before: string; after: string; canUndo: boolean }`**, where `canUndo` = `!row.undone && (row.ref_table === 'data_fix_history' || row.ref_table === 'model_answer')`.
  - **`changeService`:**
    - `listChanges(f: { userId?: string; from?: string; to?: string; kinds?: string[] }, after?: string): Promise<ChangeRow[]>`, with `p_limit` 100;
    - `undoRows(rows: ChangeRow[]): Promise<{ done: number; changedSince: number; skipped: number }>`. It splits rows by `ref_table` into `undo_fix_change` and `withdraw_model_answers`, in chunks of 500, and sums the results.
  - **The page:**
    - filters for person, from/to date and kind;
    - "Load more" paging by cursor;
    - an Undo per row;
    - "Undo all N shown" opens a confirmation sentence: `"Undo N changes by {email}? Each one goes back to what it was before. This is recorded, and can itself be undone."` ("by everyone" when no person is chosen);
    - afterwards a summary: "N undone, N changed since, N skipped".

- [ ] **Step 1: Write the failing tests:**
  - **chunk:** sizes 0 throws, 1, exact, remainder.
  - **sumBatchResults:** mixed undo and withdraw results.
  - **describeChange:** one case per kind, and `canUndo` false for held rows and for undone rows.
  - **undoRows:** 1,201 fix rows produce 3 `undo_fix_change` calls (500, 500, 201); answer rows go to `withdraw_model_answers`; held rows are never sent.

- [ ] **Step 2: Run them.**

  ```bash
  npx vitest run src/lib/chunk.test.ts src/lib/changeRow.test.ts src/services/changeService.test.ts
  ```

  Expected: FAIL.

- [ ] **Step 3: Implement.**

- [ ] **Step 4: Run the checks.**

  ```bash
  npm test && npm run lint && npm run build
  ```

  Expected: all pass.

- [ ] **Step 5: Commit** `feat: Changes page with undo`.

### Task 15: Docs and the by-hand run

**Files:**
- Modify: `W/DEVOPS.md` (§12, plus §11/envelope wording on accounts), `W/docs/ops-manual/` sources for Part 1 step 4

- [ ] **Step 1:** Write the docs.
  - **DEVOPS.md §12:** add a subsection "Volunteers, approvals and undo" covering the role, in training, `/api/volunteers` (uses `SUPABASE_SERVICE_ROLE_KEY`), the three pages, undo rules, and the migration file name.
  - **Ops-manual source:** in step 4, admins also see People (Volunteers, Approvals, Changes); volunteers see only Data fixes and Model check.
  - Make no Claude Doc edit here. After merge, the user asks for the doc update and re-exports the PDF.

- [ ] **Step 2: By-hand run** on the dev server against live, using the Task 10 test volunteer:
  1. Training on: submit one fix and one answer. Check they don't appear in the counts.
  2. Approve one and reject one with a note. Check the trainee sees the note.
  3. Undo the approved fix on the Changes page, then undo that undo.
  4. Turn training off, save once, and check it applies at once.
  5. Remove access and check the volunteer is refused.

  Record each result in the ledger.

- [ ] **Step 3: Clean up the test account.**
  1. Give the user the exact steps to delete the test auth user in Supabase Studio.
  2. Its `rat.volunteer` row stays, removed, so the history can still name it.
  3. The test answer and fix stay too, but undone or withdrawn (append-only).
  4. Tell the user these are the only traces left.

- [ ] **Step 4: Run the checks.**

  ```bash
  npm test && npm run lint && npm run build
  ```

  Expected: all pass.

- [ ] **Step 5: Commit** `docs: volunteers, approvals and undo`.
