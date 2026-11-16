# Model Check Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Volunteers check an offline model's answer to "What's the main subject?" photo by photo; answers
are measured honestly and, for RAT, fill "No loco" into Data Fixes where safe.

**Architecture:** New `rat.model_*` tables and SECURITY DEFINER RPCs (filemaker_sync, Tasks 1–3), a
loader that puts a scored CSV into them (Task 4), and two admin pages in picaloco_web (Tasks 5–7). The
Data Fixes link reuses the existing review-context path; a second setting, `rat.review_source`, tags
its history rows `model_check`.

**Tech Stack:** Postgres 17 SQL + plpgsql; Python 3 + psycopg2 + pytest (Docker `postgres:17`);
React 19 + TS + Tailwind + react-router + React Query + supabase-js; vitest; Node Playwright for the
browser check.

**Spec:** `picaloco_web/docs/superpowers/specs/2026-11-16-model-check-design.md`

Two repos, one branch named `model-check` in each: **F** = `filemaker_sync` (Tasks 1–4),
**W** = `picaloco_web` (Tasks 5–7). Paths below are relative to the named repo.

## Global Constraints

- Never run DDL against live `oci`; tests use the `pg` fixture (Docker `postgres:17`) only. Live apply
  is the hand-off at the end, done by the user.
- Golden Rule 7: no reviewed `rat.data_fix_value` row is ever changed by this feature. The only fill is
  `extracted` + confidence `none` → `no_loco`, through `rat.review_context = 'on'`.
- Every new function: `SECURITY DEFINER`, `SET search_path = ''`, schema-qualified references,
  `rat.is_admin()` check raising `42501` ('not a data fixes admin'). Bad input raises `22023`; a
  missing task/photo raises `P0002`.
- Modes are exactly `sure`, `unsure`, `sample`. `sure` = prediction `p >= model_task.sure_threshold`
  (default `0.9`); `unsure` = below it; `sample` = all `rat.catalog` photos ordered by `md5(image_no)`.
- Sample mode is blind: the server returns no prediction, nothing is pre-selected, the "Model thinks"
  line is absent, and the answer is saved with `shown_run_id` and `shown_answer` null.
- Accuracy = latest blind answer per photo (`mode = 'sample'`) compared with each run's prediction.
  Shown as "Accuracy (blind sample)". Agreement over all answers is labelled "Agreement".
- Answer list changes once `model_answer` rows exist for a task: add only; never remove an id or change
  an id's key. Labels and prompts may change. Answer keys are unique single digits `'1'`…`'9'`, `'0'`.
- Data Fixes link config for `subject_type`: `{"no_answer_flag": "loco", "fix_ids": ["loco_number", "loco_name"]}`.
- Link copy (fix titles from `rat.data_fix.title`, values joined with `'; '`):
  - fill: `Also saves: Loco number — No loco, Loco name — No loco`
  - description names a value (still extracted): `Description names 6853 — Loco number not changed`
  - reviewed with a value: `Loco number was saved as 6853 — not changed`
  - loco answer but saved No loco: `Loco number was saved as No loco — not changed`
- Keys on the check page: `1`–`9`, `0` pick the answer with that key; `Enter` saves the picked answer;
  `→` or `S` skip; `←` back. No key acts while focus is in a text field or the user menu is open.
- Copy on the page: question as heading; `Model thinks: Tram (93%)`; button `Save & next`;
  checked photo: `Checked by <email or "a volunteer"> on <date>`.
- picaloco_web tests: `npm test`, `npm run build`, `npm run lint` all clean before each W commit.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Never stage
  `.env*` or `.superpowers/`.

## Review Focus

- A Data Fixes row reviewed by someone else between queue load and save: the save must not fill it
  (row lock and re-check at save time). Pinned by Task 3 `test_save_does_not_fill_row_reviewed_meanwhile`.
- Blindness leaking in sample mode (prediction sent by the server, or Enter saving a default). Pinned by
  Task 3 `test_queue_sample_is_blind` and Task 7 browser check step.
- Enter pressed twice quickly, or a save while one is running: exactly one answer row. Pinned by Task 7
  browser check (one `save_model_answer` call).
- The 10th answer on key `0` (`other`) and a digit pressed with no matching answer. Pinned by Task 5
  `modelCheckKeys.test.ts`.
- Loading the same run twice, or a scores CSV whose columns don't match the task. Pinned by Task 4
  `test_apply_refuses_duplicate_version` and `test_read_scores_rejects_wrong_header`.

## Decisions this plan makes (the spec left them open)

- **Conflict list:** a photo is listed while it needs a person: latest answer not-a-loco and a listed
  field still `extracted` with confidence other than `none`; or latest answer a loco and a listed
  field saved `no_loco`. A not-a-loco photo whose field a volunteer already reviewed with a value is
  consistent (a loco is present, just not the main subject): the panel says "not changed" but it is not
  listed. Cost if wrong: one extra condition in `rat.model_check_conflicts`.
- **Conflict link:** `rat.data_fix_queue`'s `p_text` also matches `image_no` exactly, so a conflict
  links to `/admin/fixes/loco_number?q=<image_no>&status=extracted,verified,corrected,none_visible,no_loco`.
- **History tag:** the existing history trigger reads a new setting `rat.review_source`; `model_check`
  when set inside review context, else `review`. Source CHECK becomes `('extractor','review','model_check')`.
- **Sample mode takes no filters** (no answer, no collection): filters would bias the sample.
- **Shared photo:** extract `ZoomImage` from `ReviewCard.tsx` into its own file and reuse it; build the
  model-check card beside `ReviewCard`, not inside it.

---

### Task 1 (F): Data Fixes accepts `model_check` history and image_no search

**Files:**
- Modify: `supabase/schema/add_data_fix_tables.sql` (history CHECK, `rat.data_fix_value_history()`,
  `rat.data_fix_queue` text match), and re-copy its body into `supabase/schema/bootstrap_rat_schema.sql`
- Create: `supabase/schema/fix_data_fix_model_check.sql` (for an existing database; header in the style
  of `fix_review_stale_errcode.sql`)
- Test: `tests/test_data_fix_schema.py`

**Interfaces:**
- Produces: setting `rat.review_source` (`'model_check'` or unset); history `source = 'model_check'`
  when `rat.review_context = 'on'` and `rat.review_source = 'model_check'`; `data_fix_queue(p_text => image_no)` returns that photo.

- [ ] **Step 1: Write the failing tests** in `tests/test_data_fix_schema.py`:
  - `test_history_source_model_check`: seed extracted row `s_mc_src_1`; in one transaction
    `set_config('rat.review_context','on',true)`, `set_config('rat.review_source','model_check',true)`,
    update status to `no_loco`; assert latest history row `source == 'model_check'`.
  - `test_history_source_review_unchanged`: `rat.review_fix_value` as admin → history `source == 'review'`.
  - `test_queue_text_matches_image_no`: seed `s_mc_q_1` with a description not containing its id;
    `data_fix_queue('loco_number', p_status => '{extracted,verified,corrected,none_visible,no_loco}', p_text => 's_mc_q_1')`
    returns exactly that row.
  - `test_model_check_patch_applies`: on the fixture DB, drop and re-add the old CHECK
    `('extractor','review')`, apply `fix_data_fix_model_check.sql` twice, then the model_check update
    from the first test succeeds.
- [ ] **Step 2:** `venv/bin/python -m pytest tests/test_data_fix_schema.py -q` → the four new tests FAIL
  (check violation / no row / file missing).
- [ ] **Step 3: Implement.** CHECK `source IN ('extractor', 'review', 'model_check')`; patch file does
  `ALTER TABLE rat.data_fix_history DROP CONSTRAINT IF EXISTS data_fix_history_source_check, ADD CONSTRAINT data_fix_history_source_check CHECK (...)`
  plus `CREATE OR REPLACE` of the history function and `data_fix_queue`. Queue condition:
  `(p_text IS NULL OR c.description ILIKE '%' || p_text || '%' OR v.image_no = p_text)`.
- [ ] **Step 4:** `venv/bin/python -m pytest tests -q` → all PASS (including `test_ddl_idempotent`).
- [ ] **Step 5: Commit** `feat: Data Fixes history accepts model_check; queue text matches image_no`

### Task 2 (F): Model-check tables, append-only answers, grants

**Files:**
- Create: `supabase/schema/add_model_check_tables.sql` (header like `add_data_fix_tables.sql`: purpose,
  spec path, idempotent, `BEGIN; … COMMIT;`)
- Modify: `tests/conftest.py` (add `MODEL_CHECK_SQL`, applied after `DATA_FIX_SQL`; helpers below),
  `supabase/schema/bootstrap_rat_schema.sql` (append the file's body after the Data Fixes section,
  with a "copied verbatim" banner like the Data Fixes one)
- Test: `tests/test_model_check_schema.py`

**Interfaces:**
- Produces tables:
  - `rat.model_task(id text PK, question text NOT NULL, answers jsonb NOT NULL, sure_threshold real NOT NULL DEFAULT 0.9 CHECK (sure_threshold > 0 AND sure_threshold <= 1), links jsonb, sort_order integer NOT NULL DEFAULT 0, client text, note text)`
  - `rat.model_run(id bigserial PK, task_id text NOT NULL REFERENCES rat.model_task, model text NOT NULL, version text NOT NULL, notes text, answers jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), n_predictions integer NOT NULL DEFAULT 0, UNIQUE (task_id, version))`
  - `rat.model_prediction(run_id bigint NOT NULL REFERENCES rat.model_run ON DELETE CASCADE, image_no text NOT NULL, answer text NOT NULL, p real NOT NULL CHECK (p >= 0 AND p <= 1), probs real[] NOT NULL, PRIMARY KEY (run_id, image_no))`, index `(run_id, answer, p)`
  - `rat.model_answer(id bigserial PK, task_id text NOT NULL REFERENCES rat.model_task, image_no text NOT NULL, answer text NOT NULL, shown_run_id bigint REFERENCES rat.model_run, shown_answer text, mode text NOT NULL CHECK (mode IN ('sure','unsure','sample')), answered_by uuid, answered_at timestamptz NOT NULL DEFAULT now(), CHECK (mode <> 'sample' OR (shown_run_id IS NULL AND shown_answer IS NULL)))`, index `(task_id, image_no, answered_at DESC)`. No FK on `image_no` (as Data Fixes).
  - `answers` jsonb shape: `[{"key":"1","id":"steam_loco","label":"Steam loco","loco":true}, …]` (task file answers minus `prompts`).
- Produces conftest helpers: `seed_task(conn, task_id="t_x", answers=None, links=None, threshold=0.9) -> str`
  (default answers: `[{"key":"1","id":"loco","label":"Loco","loco":True},{"key":"2","id":"station","label":"Station","loco":False},{"key":"0","id":"other","label":"Other","loco":False}]`),
  `seed_run(conn, task_id, version="v1", predictions={image_no: (answer, p)}) -> int` (copies the task's
  answers into the run; `probs` has one entry per answer, `p` on the chosen one, 0 elsewhere).

- [ ] **Step 1: Write the failing tests** in `tests/test_model_check_schema.py`:
  - `test_answers_append_only`: insert an answer as owner; `UPDATE` and `DELETE` each raise
    (message contains `append-only`); `TRUNCATE rat.model_answer` raises.
  - `test_sample_answer_must_be_blind`: insert `mode='sample'` with `shown_answer='loco'` → CheckViolation.
  - `test_anon_and_non_admin_closed`: anon gets InsufficientPrivilege on all four tables; a non-admin
    user sees 0 rows of `model_task`/`model_run` and gets InsufficientPrivilege on `model_prediction`/`model_answer`.
  - `test_admin_reads_tasks_and_runs`: admin selects the seeded task and run.
  - `test_model_check_ddl_idempotent`: apply `MODEL_CHECK_SQL` twice; then `DATA_FIX_SQL` again; no error.
  - `test_bootstrap_contains_model_check`: bootstrap text contains the body of `add_model_check_tables.sql`
    from its first `BEGIN;` to the end, verbatim.
- [ ] **Step 2:** `venv/bin/python -m pytest tests/test_model_check_schema.py -q` → FAIL (file missing).
- [ ] **Step 3: Implement** the tables; trigger `rat.model_answer_append_only()` `BEFORE UPDATE OR DELETE`
  (row) and `BEFORE TRUNCATE` (statement), raising `'model answers are append-only'`. RLS on all four;
  policies `FOR SELECT TO authenticated USING (rat.is_admin())` on `model_task` and `model_run`;
  `GRANT SELECT` on those two to `authenticated`; `REVOKE ALL` on all four tables and both sequences
  from `anon, authenticated, PUBLIC` first and from `picaloco_agent` when it exists (copy the guarded
  `DO` block pattern).
- [ ] **Step 4:** `venv/bin/python -m pytest tests -q` → all PASS.
- [ ] **Step 5: Commit** `feat: model-check tables with append-only answers`

### Task 3 (F): Model-check RPCs and the Data Fixes link

**Files:**
- Modify: `supabase/schema/add_model_check_tables.sql` (functions + grants), re-copy into bootstrap
- Test: `tests/test_model_check_schema.py`

**Interfaces:**
- Produces (all `SECURITY DEFINER`, admin-only, EXECUTE granted to `authenticated` only):
  - `rat.model_check_queue(p_task_id text, p_mode text, p_run_id bigint DEFAULT NULL, p_answer text DEFAULT NULL, p_collection text DEFAULT NULL, p_after text DEFAULT NULL, p_limit integer DEFAULT 25)`
    `RETURNS TABLE (image_no text, sort_key text, description text, collection text, date_taken date, cd_no character varying, model_answer text, model_p real, checked_answer text, checked_at timestamptz, fix_state jsonb)`.
    Excludes photos already answered for the task (sample: already answered blind). `sort_key` is
    `image_no` (sure/unsure) or `md5(image_no)` (sample); keyset `sort_key > coalesce(p_after,'')`;
    limit clamped 1–500. `p_run_id` required for sure/unsure and must belong to the task; sample with
    `p_answer` or `p_collection` → `22023`; sample returns `model_answer`/`model_p` NULL. `fix_state`:
    `{fix_id: {"status", "confidence", "values", "suggested_values"}}` for the task's linked fix_ids
    (NULL when the task has no link).
  - `rat.save_model_answer(p_task_id text, p_image_no text, p_answer text, p_shown_run_id bigint, p_shown_answer text, p_mode text) RETURNS jsonb`
    → `{"answer_id": <bigint>, "filled": [fix_id…], "conflicts": [{"fix_id","status","confidence","values","suggested_values"}…]}`.
  - `rat.model_check_progress() RETURNS TABLE (task_id text, run_id bigint, model text, version text, created_at timestamptz, n_predictions integer, n_checked bigint, n_agree bigint, n_blind bigint, n_blind_correct bigint)`
  - `rat.model_check_confusion(p_run_id bigint, p_blind_only boolean DEFAULT true) RETURNS TABLE (model_answer text, checked_answer text, n bigint)`
  - `rat.model_check_conflicts(p_task_id text) RETURNS TABLE (image_no text, answer text, fix_id text, status text, confidence text, "values" text[], suggested_values text[])`

`save_model_answer` link rule (the one algorithm the signature doesn't settle):

```
flag := answer object ->> links.no_answer_flag   (boolean)
lock data_fix_value rows (p_image_no, links.fix_ids) FOR UPDATE
if flag = false:
    if every fix_id has a row with status 'extracted' and confidence 'none':
        review_context='on', review_source='model_check' (both local);
        UPDATE those rows SET values '{}', status 'no_loco', reviewed_by auth.uid(), reviewed_at now(),
          needs_recheck false, description_hash as in review_fix_value;
        reset both settings to ''; filled := fix_ids
    else: conflicts := rows whose status <> 'extracted' and values non-empty,
                       or status = 'extracted' and confidence <> 'none'
if flag = true: conflicts := rows with status 'no_loco'
```

Validation order: admin → task exists (`P0002`) → mode valid → answer id in task (`22023`) → sample has
no shown fields / sure+unsure have `p_shown_run_id` of this task (`22023`) → `p_image_no` in
`rat.catalog` (`P0002`). The answer row is inserted before the link runs, in the same transaction.

- [ ] **Step 1: Write the failing tests** (task with the default answers and the loco link; catalog rows
  seeded with `seed_catalog`; Data Fixes rows with `seed_fix_value`):
  - `test_save_fills_when_description_named_nothing`: both fields extracted/`none`; save `station`
    (mode `sure`, shown run) → `filled == ['loco_number','loco_name']`; both rows `no_loco`; two history
    rows `source='model_check'`; one `model_answer` row with `answered_by` = admin.
  - `test_save_conflict_when_description_named_a_number`: loco_number extracted/`high` `['6853']` →
    `filled == []`, one conflict for `loco_number`; both rows unchanged.
  - `test_save_never_changes_reviewed_value`: loco_number `verified` `['6853']`, loco_name extracted/`none`
    → nothing filled (all-or-nothing); loco_number unchanged.
  - `test_save_does_not_fill_row_reviewed_meanwhile`: queue returns the photo with `fix_state` extracted;
    then `review_fix_value` marks loco_number `corrected` `['1']`; save `station` → loco_number still
    `corrected` `['1']`, `filled == []`.
  - `test_loco_answer_flags_saved_no_loco`: loco_number `no_loco`; save `loco` → one conflict, nothing changed.
  - `test_save_validation`: non-admin `42501`; unknown answer `22023`; sample with shown answer `22023`;
    sure without run `22023`; unknown photo `P0002`.
  - `test_queue_modes`: run predicts A `loco` 0.95, B `station` 0.5, C `loco` 0.92 with threshold 0.9 →
    sure returns A, C; unsure returns B; `p_answer='loco'` on sure returns A, C; after answering A, sure returns C.
  - `test_queue_sample_is_blind`: sample returns rows ordered by `md5(image_no)` with `model_answer` and
    `model_p` NULL; `p_answer` given → `22023`; a photo answered blind drops out; one answered in sure mode stays.
  - `test_progress_counts_blind_only_for_accuracy`: run predicts A `loco`, B `station`; blind answers
    A `loco`, B `loco`; sure answer C (agrees) → `n_blind == 2`, `n_blind_correct == 1`, `n_checked == 3`,
    `n_agree == 2`; a second run predicting B `loco` gets `n_blind_correct == 2` from the same answers.
  - `test_confusion_and_conflicts`: confusion for the run (blind only) has rows (`loco`,`loco`,1) and
    (`station`,`loco`,1); conflicts lists the photo from the number-named test until its loco_number is
    reviewed, then not.
  - `test_rpc_grants`: every new function denies `anon` (InsufficientPrivilege) and is executable by `authenticated`.
- [ ] **Step 2:** `venv/bin/python -m pytest tests/test_model_check_schema.py -q` → new tests FAIL (functions missing).
- [ ] **Step 3: Implement** the five functions and grants (revoke EXECUTE from `PUBLIC, anon` on all,
  including the append-only trigger function; revoke that one from `authenticated` too).
- [ ] **Step 4:** `venv/bin/python -m pytest tests -q` → all PASS.
- [ ] **Step 5: Commit** `feat: model-check queue, save with Data Fixes link, progress RPCs`

### Task 4 (F): Loader for a scored run

**Files:**
- Create: `scripts/load_model_run.py`, `tests/test_load_model_run.py`
- Modify: `scripts/model_tasks/rat_subject_type.json` (add `"sure_threshold": 0.9`, `"sort_order": 1`,
  and the link config from Global Constraints under `"links"`)
- Commit also: `scripts/model_score.py` (already written, unchanged). Leave `scripts/clip_loco_screen.py` uncommitted.

**Interfaces:**
- Consumes: Task 2 tables.
- Produces:
  - `task_row(task: dict) -> dict` — keys `id, question, answers, sure_threshold, links, sort_order, client, note`; `answers` drop `prompts`.
  - `task_file_errors(task: dict) -> list[str]` — keys unique and each one of `'1'`…`'9'`,`'0'`; ids unique; 1–10 answers.
  - `answer_list_errors(stored: list[dict], new: list[dict]) -> list[str]` — one message per stored id missing from `new` or with a changed key.
  - `read_scores(path: Path, answer_ids: list[str]) -> Iterator[tuple[str, str, float, list[float]]]` — header must equal `['image_no','answer','p'] + ['p_'+id …]`, else `ValueError` naming expected vs found.
  - CLI: `load_model_run.py --task FILE --scores CSV --model NAME --version LABEL [--notes TEXT] [--config config.toml] [--target-profile oci] [--apply]`; dry run by default.

- [ ] **Step 1: Write the failing tests:**
  - Pure: `test_task_row_drops_prompts`, `test_task_file_errors` (duplicate key, key `'10'`, 11 answers),
    `test_answer_list_errors` (removed id → 1 error; re-keyed id → 1 error; added answer and changed label → `[]`),
    `test_read_scores_rejects_wrong_header`, and `test_real_task_file_is_valid`
    (`task_file_errors(json.load(rat_subject_type.json)) == []`).
  - On `pg`: `test_apply_loads_run` (CSV with 3 rows, one `image_no` not in `rat.catalog` → 2
    predictions, `n_predictions == 2`, run `answers` equals the task answers, report says 1 skipped);
    `test_dry_run_writes_nothing` (no task, run or prediction rows afterwards);
    `test_apply_refuses_duplicate_version` (second apply with the same version exits non-zero, nothing added);
    `test_apply_refuses_incompatible_answers` (after one `model_answer` row, a task file without `station` exits non-zero);
    `test_apply_never_touches_data_fix` (count of `rat.data_fix_history` and `rat.data_fix_value` unchanged).
  The `pg` tests call `run(conn, args) -> int` directly with the fixture connection.
- [ ] **Step 2:** `venv/bin/python -m pytest tests/test_load_model_run.py -q` → FAIL (module missing).
- [ ] **Step 3: Implement.** `--apply` in one transaction: upsert `model_task` (refuse on
  `answer_list_errors` when the task has answers), insert `model_run` (refuse an existing version with a
  message naming it), `COPY` into a temp table, `INSERT INTO rat.model_prediction … JOIN rat.catalog`,
  set `n_predictions`. Dry run: same checks in a `READ ONLY` transaction; prints read / would load /
  skipped (no catalog row) counts. Connection via `reject_log.open_connection` like
  `data_fix_preservation_check.py`. Probabilities in task-answer order from the CSV's `p_<id>` columns.
- [ ] **Step 4:** `venv/bin/python -m pytest tests -q` → all PASS.
- [ ] **Step 5: Commit** `feat: load a scored model run into the model-check tables` (stage the two
  scripts, the task file and the test).

### Task 5 (W): Model-check service, params, keys and link preview

**Files:**
- Commit first: `docs/superpowers/specs/2026-11-16-model-check-design.md` and this plan (`docs: model check design and plan`).
- Create: `src/services/modelCheckService.ts` (+ `.test.ts`), `src/lib/modelCheckParams.ts` (+ test),
  `src/lib/modelCheckKeys.ts` (+ test), `src/lib/modelCheckLink.ts` (+ test)

**Interfaces:**
- Consumes: Task 3 RPC names, arguments and columns exactly; `isTypingTarget` from `@/lib/reviewKeys`;
  `mapReviewError`, `isSignedOutError` from `@/services/dataFixService`.
- Produces:
  - Types: `ModelAnswerDef { key: string; id: string; label: string; [flag: string]: unknown }`,
    `ModelTask { id; question; answers: ModelAnswerDef[]; sure_threshold: number; links: { no_answer_flag: string; fix_ids: string[] } | null; sort_order }`,
    `ModelRun { id: number; task_id; model; version; created_at; n_predictions }`,
    `RunProgress` (the progress columns), `ConfusionRow`, `ConflictRow`,
    `FixStateEntry { status: FixStatus; confidence: FixConfidence; values: string[]; suggested_values: string[] }`,
    `CheckRecord` (the queue columns; `fix_state: Record<string, FixStateEntry> | null`).
  - `getTasks(): Promise<ModelTask[]>` (from `model_task`, by `sort_order`), `getRuns(taskId): Promise<ModelRun[]>` (newest first),
    `getRunProgress(): Promise<RunProgress[]>`, `getConfusion(runId, blindOnly = true)`, `getConflicts(taskId)`,
    `getCheckQueuePage(taskId, params: CheckParams, after: string | null, limit: number): Promise<CheckRecord[]>`,
    `saveModelAnswer(i: { taskId; imageNo; answer; mode: CheckMode; shownRunId: number | null; shownAnswer: string | null }): Promise<{ ok: true; filled: string[]; conflicts: ConflictRow[] } | { ok: false; reason: 'forbidden' | 'signed-out' | 'error'; message: string }>`.
  - `type CheckMode = 'sure' | 'unsure' | 'sample'`; `interface CheckParams { run: number | null; mode: CheckMode; answer: string | null; collection: string | null }`;
    `parseCheckParams(sp: URLSearchParams): CheckParams`, `serializeCheckParams(p): URLSearchParams` (URL keys `run`, `mode`, `answer`, `collection`; default mode `sure`).
  - `type CheckAction = { type: 'pick'; answerId: string } | { type: 'save' } | { type: 'skip' } | { type: 'back' }`;
    `checkShortcut(key: string, target: { tagName: string; isContentEditable: boolean }, answers: ModelAnswerDef[]): CheckAction | null`.
  - `linkPreview(task: ModelTask, answerId: string, fixState: Record<string, FixStateEntry> | null, fixTitles: Record<string, string>): { fills: string[]; notes: string[] }`
    — `fills` = fix_ids that would become No loco; `notes` = the Global Constraints copy lines.
  - `formatAccuracy(correct: number, n: number): string` in `modelCheckParams.ts`:
    `"87% (174 of 200)"`; `n === 0` → `"No blind answers yet"`.

- [ ] **Step 1: Write the failing tests:**
  - `modelCheckParams.test.ts`: default `{ run: null, mode: 'sure', answer: null, collection: null }`;
    round-trip; unknown mode → `sure`; `mode=sample&answer=tram&collection=X` parses to answer and collection `null`;
    `formatAccuracy(174, 200) === '87% (174 of 200)'`, `formatAccuracy(0, 0) === 'No blind answers yet'`.
  - `modelCheckKeys.test.ts` (answers with keys `'1'`,`'5'`,`'0'`): `'5'` → pick that id; `'0'` → pick
    the `'0'` answer; `'7'` (no answer) → `null`; `Enter` → save; `s`, `ArrowRight` → skip; `ArrowLeft` → back;
    any key with an INPUT target → `null`.
  - `modelCheckLink.test.ts`: not-a-loco + both extracted/none → fills both, note `Also saves: Loco number — No loco, Loco name — No loco`;
    loco_number extracted/high `['6853']` → no fills, note `Description names 6853 — Loco number not changed`;
    loco_number verified `['6853']` → no fills, note `Loco number was saved as 6853 — not changed`;
    loco answer + loco_number `no_loco` → note `Loco number was saved as No loco — not changed`;
    task with `links: null` → `{ fills: [], notes: [] }`.
  - `modelCheckService.test.ts` (mock `adminSupabase` as in `dataFixService.test.ts`): queue page sends
    `p_mode: 'sample'` with `p_run_id: null`, `p_answer: null`, `p_collection: null`; save sends
    `p_shown_run_id: null, p_shown_answer: null` in sample mode; a `42501` error with no session → `reason: 'signed-out'`;
    success returns `filled` and `conflicts` from the jsonb.
- [ ] **Step 2:** `npx vitest run src/lib/modelCheck* src/services/modelCheckService.test.ts` → FAIL (modules missing).
- [ ] **Step 3: Implement** the four modules.
- [ ] **Step 4:** `npm test && npm run build && npm run lint` → pass.
- [ ] **Step 5: Commit** `feat: model-check service, params, keys and Data Fixes link preview`

### Task 6 (W): Model check overview page and menu entry

**Files:**
- Create: `src/pages/ModelCheckPage.tsx`, `src/components/admin/modelCheck/ModelTaskCard.tsx`
- Modify: `src/App.tsx` (routes `/admin/model-check` and `/admin/model-check/:taskId`, both inside
  `RequireAdmin`; the second renders a placeholder until Task 7), `src/components/layout/UserMenu.tsx`
  (admin item "Model check" → `/admin/model-check`, after "Data fixes")

**Interfaces:**
- Consumes: Task 5 `getTasks`, `getRuns`, `getRunProgress`, `getConfusion`, `getConflicts`, `formatAccuracy`, `serializeCheckParams`.

Page content (layout like `DataFixesPage`): heading "Model check"; one card per task with the question,
a run picker (newest run selected), for that run: predicted, checked, "Accuracy (blind sample)"
via `formatAccuracy(n_blind_correct, n_blind)`, "Agreement" `n_agree` of `n_checked`; a confusion table
(rows model answer, columns checked answer, blind only, answer labels from the run's task); three
buttons "Sure", "Unsure", "Random sample" linking to the queue with `run` and `mode`; a "Conflicts (N)"
list: image_no, answer label, fix title, status/value, linking to
`/admin/fixes/<fix_id>?q=<image_no>&status=extracted,verified,corrected,none_visible,no_loco`.

- [ ] **Step 1:** Implement page, card, routes and menu item.
- [ ] **Step 2:** `npm test && npm run build && npm run lint` → pass.
- [ ] **Step 3: Browser check** (Node Playwright, dev server on 5199, signed in with `ADMIN_TEST_*`
  from `.env.local`, never printed; route-stub `**/rest/v1/model_task*`, `**/rest/v1/model_run*` and the
  three RPCs with fixed JSON): menu shows "Model check" for the admin and lands on the page; card shows
  `87% (174 of 200)` for stubbed `n_blind_correct=174, n_blind=200`; "Random sample" link has
  `mode=sample` and no `answer`; a conflict link goes to the Data Fixes queue with `q=<image_no>`.
  Signed out, the menu has no "Model check".
- [ ] **Step 4: Commit** `feat: model check overview page and menu entry`

### Task 7 (W): Model check queue page

**Files:**
- Create: `src/components/admin/fixes/ZoomImage.tsx` (moved out of `ReviewCard.tsx`, same behaviour,
  exported `ZoomImage`), `src/components/admin/modelCheck/ModelCheckCard.tsx`,
  `src/pages/ModelCheckQueuePage.tsx`, `src/hooks/useModelCheckQueue.ts`
- Modify: `src/components/admin/fixes/ReviewCard.tsx` (import `ZoomImage`), `src/App.tsx` (real page for `/admin/model-check/:taskId`)

**Interfaces:**
- Consumes: Task 5 everything; `usePhotoSize`, `PhotoSizeControl`, `getFixes` (fix titles).
- Produces: `useModelCheckQueue(taskId: string, params: CheckParams)` — same shape and paging rules as
  `useFixQueue` (25 per page, keyset on `sort_key`, `staleTime: Infinity`, local `patch(imageNo, p)`).

Behaviour: layout and scaling as `FixQueuePage` (photo with zoom and size control, Back / Next under it,
"Back and Next don't save", meta line, description; answer panel on the right). Panel: question heading;
in sure/unsure `Model thinks: <label> (<round(p*100)>%)` and that answer pre-selected; in sample neither.
Answer list rows `[key] label`, selected row ticked, clickable. Under the list the `linkPreview` notes
for the selected answer. `Save & next` disabled until an answer is selected and while saving; one save
at a time; on success advance and patch the record as done; on failure stay with the error, and a
signed-out error shows the sign-in prompt as on Data Fixes. A record that is already checked
(revisited with Back) shows its saved answer selected and `Checked by … on …`; saving adds a
correcting answer. Window `keydown` uses `checkShortcut`, ignores events while saving, and is guarded
by the user menu as on Data Fixes. A "Keys" help button lists the keys (pattern of `ReviewHelp.tsx`).
Empty queue: "Nothing left for this filter".

- [ ] **Step 1:** Move `ZoomImage`; `npm test && npm run build` → pass (pure move).
- [ ] **Step 2:** Implement hook, card and page.
- [ ] **Step 3:** `npm test && npm run build && npm run lint` → pass.
- [ ] **Step 4: Browser check** (as Task 6; stub `model_check_queue` with 3 records, `save_model_answer` counting calls):
  - sure mode: "Model thinks: Tram (93%)" visible, Tram selected; `Enter` → 1 save call with
    `p_answer: 'tram'`, `p_mode: 'sure'`, `p_shown_answer: 'tram'`; next photo shown.
  - press `2` then `Enter` → saved answer is the key-2 answer.
  - `Enter` twice within 50 ms → exactly 1 save call for that photo.
  - sample mode: no "Model thinks" text, nothing selected, `Enter` → 0 save calls; `9` then `Enter` → 1 call with `p_shown_answer: null`.
  - not-a-loco answer on a record whose stub `fix_state` is extracted/none shows `Also saves: Loco number — No loco, Loco name — No loco`.
  - menu open + press `5` → no selection change, 0 save calls.
  - save stub returning `{code:'42501'}` with no session → sign-in prompt; photo stays.
  - page at 1920×970, Normal text: no page scroll.
- [ ] **Step 5: Commit** `feat: model check queue page`

---

## Hand-off after merge (the user runs these; not tasks)

1. Before: `venv/bin/python scripts/data_fix_preservation_check.py --target-profile oci` (note the checksum).
2. Check the live CHECK constraint name:
   `select conname, pg_get_constraintdef(oid) from pg_constraint where conrelid = 'rat.data_fix_history'::regclass and contype = 'c';`
   — the patch now drops every CHECK on the table that mentions `source`, whatever its name, inside a transaction.
3. Apply `supabase/schema/fix_data_fix_model_check.sql`, then `supabase/schema/add_model_check_tables.sql`, on `oci`.
4. Load: `venv/bin/python scripts/load_model_run.py --task scripts/model_tasks/rat_subject_type.json --scores exports/ai_pilot/subject_scores.csv --model ViT-SO400M-14-SigLIP-384/webli --version 2026-11-16-zeroshot --target-profile oci` (dry run), then again with `--apply`.
5. After the load: preservation check again — checksum unchanged. This before/after pair covers the load step only.
6. Deploy picaloco_web (Vercel, on push to main).
7. After live use the checksum WILL change (each model-check fill adds a reviewed `no_loco` row), so do not
   re-run it expecting equality. Verify instead; this must return 0:
   `select count(*) from rat.data_fix_history where source = 'model_check' and (old_status is distinct from 'extracted' or new_status <> 'no_loco');`
8. Live-apply notes: run `EXPLAIN ANALYZE` on one sample-mode queue page (`rat.model_check_queue` with `p_mode => 'sample'`) and check it is fast.
   If the web reports a function not found after applying, run `NOTIFY pgrst, 'reload schema';`.
