# Data Fixes: Loco number & Loco name — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract Loco number(s) and Loco name(s) from photo descriptions into protected,
searchable Postgres fields, and give the client an Admin → Data Fixes review screen. A reviewed
value must survive every sync and every re-extraction.

**Architecture:**
- A pure-Python extractor (`filemaker_sync`) grades each value none/low/med/high. It upserts into
  new `rat.data_fix_*` tables, which the FileMaker pipeline never touches.
- The SQL itself protects reviewed values: a guard trigger, plus review RPCs that run as
  `SECURITY DEFINER` with an admin check.
- `mobile_catalog_view` exposes the values to public search.
- `picaloco_web` gains a login-gated `/admin/fixes` area that talks to the DB only through RLS
  and RPCs.

**Tech Stack:**
- Python 3.12 + psycopg2 + pytest, run from `filemaker_sync/venv`.
- Local `postgres` in Docker for integration tests.
- Supabase (GoTrue, PostgREST) on `oci`.
- Vite + React 19 + TS + Tailwind v4 + React Query + supabase-js, with vitest added for unit
  tests.

**Spec:** `picaloco_web/docs/superpowers/specs/2026-11-14-data-fixes-loco-number-name-design.md`

**Repos:**
- `F` = `/mnt/d/dev/PROJECTS/RAT_Trains_Project/work_picaloco_dev/filemaker_sync`
- `W` = `/mnt/d/dev/PROJECTS/RAT_Trains_Project/work_picaloco_dev/picaloco_web`

## Global Constraints

- **Never write to `rat.catalog` or `description`** from any new code. New data lives only in
  `rat.data_fix`, `rat.data_fix_value`, `rat.data_fix_history` and `rat.admin_user`.
- **Exact vocabularies:**
  - confidence ∈ `none|low|med|high`
  - status ∈ `extracted|verified|corrected|none_visible|no_loco`
  - fix ids are `loco_number` and `loco_name`
- **Values are `text[]`, in order.** Display them joined with `'; '`.
- **Key everything on `image_no` text.** No FK to `rat.catalog`.
- **Format checks only warn, never block.** No value is ever rejected for its format.
- **The public UI never shows confidence or status.**
- **Tests never touch the live DB** (Golden Rule #4). Integration tests use a throwaway local
  Docker Postgres. If Docker is missing, they **skip**; they never fall back to `oci`.
- **DDL and grants on `oci` are run by the user.** The agent prints the exact command and waits.
- **Branch first.** Work on branch `data-fixes` in both repos. Vercel auto-deploys `main`, so
  merge only in Task 13, with the user's OK.
- **No secrets in commits.** Every commit message ends with
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Run Postgres-only Python from WSL** as `venv/bin/python …`, from `F`'s root.
- **Use the theme CSS variables** (`var(--surface)`, `var(--accent)`, …) for all UI. It must work
  in all four themes, including Bespoke.

**Spec deviation:** the spec calls for "the full-size image", but only the 320px `webp_mobile`
variant is in Storage. The local "full-size" export is only about 384×252, as `picture_metadata`
showed live on 2026-11-14, so uploading it gains nothing. The review card uses
`getReviewImageUrl()` (Task 11), which returns the thumbnail for now, plus zoom and `cd_no`, so a
higher-resolution source can be swapped in later. This is flagged to the user.

## Review Focus

1. **A typed value with regex or PostgREST metacharacters** (`E.113`, `a,b(c)`, `50%`) must
   match literally and never return HTTP 400. Tests are in Task 8.
2. **Shortcut keys typed inside the edit box** (`n`, `x`, `e`, `s`) must type text, not trigger
   actions. Tests are in Task 11, via `shortcutFor`.
3. **Session expiry mid-review** must show "Signed out, sign in again" and keep the typed edit.
   It must never silently drop it. Tests are in Task 11, via `mapReviewError`.
4. **Descriptions with CRLF, a lone `\r`, accents or NULL** must not crash the extractor, and
   must hash identically in Python and SQL. Tests are in Tasks 1 and 5.
5. **A filter with no records left** must show "Nothing left for this filter", not an endless
   spinner. This is a browser check in Task 11.

---

### Task 1: Loco number extractor (pure)

**Files:**
- Create: `F/scripts/loco_extract.py`
- Test: `F/tests/test_loco_number_extract.py`
- Create: `F/tests/__init__.py` (empty) and `F/pytest.ini`, with `testpaths = tests` and
  `pythonpath = scripts`.

**Interfaces:**
- Produces:
  ```python
  @dataclass(frozen=True)
  class Extraction:
      values: tuple[str, ...]
      confidence: str          # 'none' | 'low' | 'med' | 'high'
  EXTRACTOR_VERSION: str = "loco-1"
  def extract_loco_numbers(description: str | None) -> Extraction
  def description_hash(description: str | None) -> str   # sha256 hex of UTF-8; None -> hash of ''
  ```

**Rules.** Start from the dry-run prototype at
`/tmp/claude-1000/-mnt-d-dev-PROJECTS-RAT-Trains-Project-work-picaloco-dev-filemaker-sync/676b7d45-d7a9-462b-afff-7556216d3a5c/scratchpad/dryrun.py`,
with these changes:
- **Markers** are `numbers?`, `No`, `no`, `Nos`, `nos` and `Nr`, each optionally followed by `.`
  or `,`. A list continues across `,`, `&` or `and`.
- **Before matching**, strip `Works No. …`, `(NNNN/YYYY)` and the phrase "number of"
  (case-insensitive).
- **Letter prefix:** if the marker is followed by 1–4 uppercase letters, a space and then a
  digit-led token, join them (`DT 601`).
- **Space-split:** if the token is 2–3 digits, followed by one space, 3–4 digits, an optional
  `-d`, and then a non-alphanumeric character or the end of the text, join them (`99 7238`,
  `051 832-4`).
- **Grading:**
  - one value → `high`
  - two or more values, or one odd value (contains `/`, is longer than 10 characters, or matches
    `\d{7,}`) → `med`
  - no marker, but a bare token matches `(?:[A-Z]{1,3})?\d{3,6}` and is not year-shaped
    (`18[3-9]\d|19\d\d|20[0-2]\d`) → `low`, holding the first value only
  - otherwise → `none`
- **Trim trailing** `.,;:)-/` from each value.

- [ ] **Step 1: Write the failing tests.** Use a parametrised `test_extract_loco_numbers` with
  these exact cases:

```python
CASES = [
 ("YP class 4-6-2 number 2295 heads a passenger train", ("2295",), "high"),
 ("19D Class 4-8-2 No. 3323 built in 1948 by NBL, Works No. 26043 near 6th Reverse", ("3323",), "high"),
 ("Class 19B 4-8-2 numbers 1413 and 1412 head the Mossel Bay train", ("1413", "1412"), "med"),
 ("Former FC Central Buenos Aires 4-6-0 number 130, Urquiza no. 290 is being turned", ("130", "290"), "med"),
 ("DR  2-10-2 T No. 99 7238 heads a passenger working", ("99 7238",), "high"),
 ("DR class 50 2-10-0 number 051 832-4 heads a freight", ("051 832-4",), "high"),
 ("Class 19D 4-8-2 number. 2683 heads the Cape Province Explorer", ("2683",), "high"),
 ("C.P. 2-6-0T No, E113 built by Kessler at Frechas", ("E113",), "high"),
 ("2-8-0 number DT 601 shunts in the yard at Chiayi", ("DT 601",), "high"),
 ("Class 117 unit numbers 51339/51382 heads south", ("51339/51382",), "med"),
 ("CFR 0-6-0 No. 2/3621 built in 1892 by WrN, Works No. 3621 at Sibiu", ("2/3621",), "med"),
 ("Class GEA 4-8-2+2-8-4 Garratt 4041 heads the Port Elizabeth train", ("4041",), "low"),
 ("A Garratt seen in 1975 at Mossel Bay", (), "none"),
 ("An LNER designed K1 class 2-6-0 heads a northbound", (), "none"),
 ("A number of wagons stand in the yard", (), "none"),
 ("OSIJ 2-4-2T built by Motala, Works No. 568 at Mariefred", (), "none"),
 ("K1 class 2-6-0 number 2005 climbs near Eller Beck", ("2005",), "high"),
 ("Car number 19 departs Laxey bound for Douglas", ("19",), "high"),
 ("LMS 4-6-0 number 45212\r\nat Lostock Hall", ("45212",), "high"),
 (None, (), "none"), ("", (), "none"), ("   ", (), "none"),
]
```

  Also add `test_description_hash`, which asserts that
  `description_hash(None) == description_hash("") == hashlib.sha256(b"").hexdigest()` and that
  `description_hash("café") == hashlib.sha256("café".encode()).hexdigest()`.

- [ ] **Step 2: Check the tests fail.** Run `cd F && venv/bin/python -m pytest
  tests/test_loco_number_extract.py -q`. Expected: FAIL with `ModuleNotFoundError: loco_extract`.
- [ ] **Step 3: Implement** `Extraction`, `EXTRACTOR_VERSION`, `extract_loco_numbers` and
  `description_hash` in `F/scripts/loco_extract.py`, following the Rules above.
- [ ] **Step 4: Check the tests pass.** Re-run the Step 2 command. Expected: all pass.
- [ ] **Step 5: Commit.** On a new branch `data-fixes` in `F`, commit with the message
  `feat: loco number extractor with confidence grading`.

### Task 2: Loco name extractor (pure)

**Files:**
- Modify: `F/scripts/loco_extract.py`
- Test: `F/tests/test_loco_name_extract.py`

**Interfaces:**
- Consumes: `Extraction` from Task 1.
- Produces: `def extract_loco_names(description: str | None, place_names: frozenset[str]) -> Extraction`.
  `place_names` holds lower-cased location, route and organisation names.

**Rules.** These are a starting point; Task 3's dry run tunes them.
- **What a name is:** a run of Title-case words, allowing the connectors `of`, `the`, `de`, `du`
  and `la` between them (as in `City of Truro`).
- **Where a name starts:**
  - straight after a marked number found by Task 1's rules → `high`
  - straight after a wheel arrangement (`\d-\d+-\d+(?:-\d+)*[A-Z]{0,3}`) → `med`
  - a quoted string (`"…"`, `‘…’` or `'…'`) of 1–4 Title-case words anywhere → `low`
  - two or more names → `med`
- **Where a name stops:** at punctuation, or at any lower-case word from
  `STOP_WORDS = {stands, standing, heads, heading, built, is, was, at, on, with, in, near, pilots,
  piloting, departs, leaves, arrives, climbs, passes, shunts, runs, takes, waits, approaches,
  crosses, hauls, seen, pulls, enters, and, being, after, from, to, for, by}`.
- **What is never a name:**
  - all-caps tokens of 2 or more letters (`LMS`, `BR`)
  - the words in `NOT_NAME = {Class, Railway, Railways, Diesel, Electric, Tank, Works, Shed,
    Station, Junction, Yard}`
  - any name whose lower-cased form is in `place_names`

- [ ] **Step 1: Write the failing tests.** Use a parametrised `test_extract_loco_names`, with
  `PLACES = frozenset({"fort william", "laxey", "corsencon"})`:

```python
CASES = [
 ("LNER Class A3 4-6-2 No. 60103 Flying Scotsman built in 1923 at Doncaster", ("Flying Scotsman",), "high"),
 ("Ex LNER J36 class 0-6-0 number 673 Maude is seen near Corsencon", ("Maude",), "high"),
 ("GWR 4-4-0 number 3440 City of Truro heads a special", ("City of Truro",), "high"),
 ("Former Hunslet 0-6-0T Doll stands in the yard", ("Doll",), "med"),
 ("Class 37 Co-Co diesel electric number 37264 stands in Fort William shed yard", (), "none"),
 ("YP class 4-6-2 number 2295 heads a passenger train taking water at Lalkua Junction", (), "none"),
 ("0-4-4-0 mallet tank number IVK148, built by Hartmann", (), "none"),
 ("Tram number 7 Laxey waits at the terminus", (), "none"),
 ("The engine 'Prince' waits at Boston Lodge", ("Prince",), "low"),
 (None, (), "none"),
]
```

- [ ] **Step 2: Check the tests fail.** Run `venv/bin/python -m pytest
  tests/test_loco_name_extract.py -q`. Expected: FAIL with `ImportError: extract_loco_names`.
- [ ] **Step 3: Implement** `extract_loco_names` by reusing Task 1's marker matching. Expose a
  private helper `_marked_spans(text) -> list[tuple[int, int]]` that both extractors use.
- [ ] **Step 4: Check the tests pass.** Run both test files. Expected: all pass.
- [ ] **Step 5: Commit** with the message `feat: loco name extractor`.

### Task 3: Dry-run CLI and checkpoint with the user

**Files:**
- Create: `F/scripts/extract_loco_fields.py` (dry-run path only in this task)
- Test: `F/tests/test_extract_cli.py`

**Interfaces:**
- Consumes: the Task 1 and 2 functions, `reject_log.load_config(path)` and
  `reject_log.open_connection(cfg, target_profile)`.
- Produces:
  ```python
  @dataclass(frozen=True)
  class FixRow:
      image_no: str; fix_id: str; values: tuple[str, ...]; confidence: str; description_hash: str
  def build_rows(records: Iterable[tuple[str, str | None]], place_names: frozenset[str]) -> list[FixRow]
      # two rows per record: fix_id 'loco_number' then 'loco_name'
  def load_place_names(conn) -> frozenset[str]   # lower(name) from rat.location, rat.route, rat.organisation
  def summarise(rows: list[FixRow]) -> dict[str, dict[str, int]]   # {fix_id: {confidence: count}}
  ```
  **CLI:**
  - Flags: `--config`, `--target-profile`, `--image-nos-file`, `--out PATH.csv` and
    `--sample-high N`, plus exactly one of `--dry-run` or `--apply` (`--apply` arrives in Task 5).
  - `--dry-run` opens the connection with `set_session(readonly=True)` and reads
    `SELECT image_no, description FROM rat.catalog`.
  - It writes a CSV with the columns
    `image_no,fix_id,confidence,values,description`.
  - It prints `summarise()` and N random high rows per fix, using `random.Random(2026)`.

- [ ] **Step 1: Write the failing tests.**
  - `test_build_rows_two_per_record`: for `[("a1", "Class 4 number 42616 Flying Fox heads")]`, the
    rows are `loco_number ("42616",) high` and `loco_name ("Flying Fox",) high`, and both have
    `description_hash == description_hash("Class 4 number 42616 Flying Fox heads")`.
  - `test_summarise_counts`: for three records, the counts per confidence are exact.
- [ ] **Step 2: Check the tests fail.** Run `venv/bin/python -m pytest tests/test_extract_cli.py
  -q`. Expected: FAIL.
- [ ] **Step 3: Implement** `FixRow`, `build_rows`, `load_place_names`, `summarise` and the
  `--dry-run` CLI.
- [ ] **Step 4: Check the tests pass.** Re-run. Expected: pass.
- [ ] **Step 5: Run the dry run** against live data. This is read-only. Run
  `venv/bin/python scripts/extract_loco_fields.py --dry-run --target-profile oci --out
  <scratchpad>/loco_dryrun2.csv --sample-high 50`.
  - Expected: `loco_number` totals 141,244 rows.
  - Compare with the first dry run (high 90,958, med 14,649, low 3,287, none 32,350). High should
    rise by roughly the ~979 recovered markers, and the ~2,693 space-split numbers should now be
    whole.
- [ ] **Step 6: Hand-check the 50 high samples per fix.** The bar is that at least 49 of 50 are
  right (98%). If a fix misses the bar, tighten its rules and add a test case for each miss, then
  repeat Steps 4–6.
- [ ] **Step 7: Checkpoint. STOP and report to the user:** both fixes' bucket counts, the
  hand-check score and 10 example name extractions. Wait for their go-ahead before Task 5's live
  apply. Tasks 4 and 5's local work may continue in the meantime.
- [ ] **Step 8: Commit** with the message `feat: extract_loco_fields dry-run report`.

### Task 4: Schema DDL, with local integration tests

**Files:**
- Create: `F/supabase/schema/add_data_fix_tables.sql`
- Create: `F/tests/conftest.py`. It defines a session fixture `pg` that:
  - starts `docker run --rm -d -p 55432:5432 -e POSTGRES_PASSWORD=test postgres:<oci major>`;
  - waits for it, then applies `tests/sql/supabase_stubs.sql`, then
    `supabase/schema/bootstrap_rat_schema.sql`, then `add_data_fix_tables.sql`;
  - yields a psycopg2 connection;
  - removes the container afterwards;
  - skips the tests if Docker is unavailable.
- Create: `F/tests/sql/supabase_stubs.sql`. It creates the roles `anon` and `authenticated`
  (NOLOGIN), schema `auth`, table `auth.users(id uuid primary key, email text)` and
  `auth.uid()`, defined as `select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid`.
- Test: `F/tests/test_data_fix_schema.py`

First get `<oci major>` read-only: `select current_setting('server_version_num')` on `oci`.

**Interfaces.** These are the objects the DDL must create. The SQL bodies are the implementer's;
the behaviour is pinned by the tests.
- **Tables** (see spec §4 for columns):
  - `rat.data_fix(id text pk, title text not null, summary text, instructions text not null default '', sort_order int not null)`
  - `rat.data_fix_value(image_no text, fix_id text references rat.data_fix, values text[] not null default '{}', suggested_values text[] not null default '{}', confidence text not null check (in 4), status text not null default 'extracted' check (in 5), needs_recheck boolean not null default false, description_hash text not null, extractor_version text not null, reviewed_by uuid, reviewed_at timestamptz, updated_at timestamptz not null default now(), primary key (image_no, fix_id))`
  - Indexes: `(fix_id, confidence, status)` and a partial index on `(fix_id) where needs_recheck`.
  - `rat.data_fix_history(id bigserial pk, image_no, fix_id, old_values text[], new_values text[], old_status, new_status, changed_by uuid, changed_at timestamptz default now(), source text check in ('extractor','review'))`
  - `rat.admin_user(user_id uuid pk references auth.users(id))`
- **Triggers on `data_fix_value`:**
  - `BEFORE UPDATE` guard. If `OLD.status <> 'extracted'` and `values` or `status` changes, and
    `current_setting('rat.review_context', true)` is not `'on'`, it raises
    `'reviewed value is protected'`. It always sets `updated_at = now()`.
  - `AFTER INSERT OR UPDATE` history. It writes a row whenever `values` or `status` changed, with
    `source = 'review'` if the review context is on, else `'extractor'`, and
    `changed_by = auth.uid()`.
- **Functions.** All are `SECURITY DEFINER` with `SET search_path = ''`. Each raises errcode
  `42501` unless `rat.is_admin()` is true; `is_admin` itself is exempt.
  - `rat.is_admin() returns boolean`
  - `rat.review_fix_value(p_image_no text, p_fix_id text, p_values text[], p_status text, p_expected_updated_at timestamptz) returns rat.data_fix_value`
    - `p_status` must be one of `verified|corrected|none_visible|no_loco`, else errcode `22023`.
    - If the row's `updated_at` doesn't equal `p_expected_updated_at`, errcode `40001`.
    - For `none_visible` and `no_loco` it stores `'{}'`.
    - It sets `reviewed_by = auth.uid()`, `reviewed_at = now()` and `needs_recheck = false`.
    - It sets `description_hash` from the current `rat.catalog.description`, using
      `encode(sha256(convert_to(coalesce(description, ''), 'UTF8')), 'hex')`.
    - It sets `rat.review_context = 'on'` locally for the transaction.
  - `rat.confirm_fix_values(p_fix_id text, p_items jsonb) returns integer`
    - `p_items` looks like `[{"image_no": …, "updated_at": …}]`.
    - Each matching row gets `values = suggested_values`, `status = 'verified'`, `reviewed_by`,
      `reviewed_at` and `needs_recheck = false`, with `rat.review_context = 'on'` set locally.
      Stale rows are skipped silently.
    - Returns the number confirmed.
  - `rat.data_fix_progress() returns table(fix_id text, status text, confidence text, needs_recheck boolean, n bigint)`
  - `rat.data_fix_queue(p_fix_id text, p_confidence text[] default null, p_status text[] default array['extracted'], p_include_recheck boolean default true, p_collection text default null, p_text text default null, p_after text default null, p_limit int default 25) returns table(image_no text, description text, collection text, date_taken <type of rat.catalog.date_taken>, cd_no <type of rat.catalog.cd_no>, values text[], suggested_values text[], confidence text, status text, needs_recheck boolean, updated_at timestamptz)`
    - Row filter: `(status = any(p_status) or (p_include_recheck and needs_recheck))`.
    - A null `p_confidence` means all confidences.
    - `p_text` does `description ilike '%' || p_text || '%'`.
    - Keyset paging: `image_no > coalesce(p_after, '')`, ordered by `image_no`.
    - It joins `rat.catalog` and `catalog_metadata → collection`.
  - `rat.data_fix_orphans() returns table(image_no text, fix_id text, status text)`: reviewed rows
    whose `image_no` is not in `rat.catalog`.
- **Grants and RLS:**
  - RLS is enabled on all four tables.
  - Policy: `SELECT` to `authenticated` using `rat.is_admin()`. On `admin_user`, the policy is
    `user_id = auth.uid()`.
  - `REVOKE ALL` on the tables from `anon`, `authenticated` and `public`.
  - `GRANT SELECT` on `data_fix`, `data_fix_value` and `data_fix_history` to `authenticated`.
  - `REVOKE EXECUTE` on the functions from `public` and `anon`, and `GRANT EXECUTE` to
    `authenticated`.
- **Seed:** insert `('loco_number', 'Loco number', 'Running number(s) carried by the loco', 1)`
  and `('loco_name', 'Loco name', 'Name(s) carried by the loco', 2)`, with
  `ON CONFLICT DO NOTHING`.
- **View:** `CREATE OR REPLACE VIEW rat.mobile_catalog_view`. Copy it verbatim from
  `bootstrap_rat_schema.sql:344`, and **append** the new columns at the end:
  `loco_numbers text[]`, `loco_numbers_text text`, `loco_names text[]` and
  `loco_names_text text`. They come from LEFT JOINs to `data_fix_value` for each fix id, with
  the join columns added to `GROUP BY`.
  - `*_text` is NULL when there's no row, or when `status = 'extracted'` and the values are
    empty. That NULL drives the search fallback.
  - `*_text` is `''` when the status is `none_visible` or `no_loco`.
  - Otherwise `*_text` is `array_to_string(values, '; ')`.
  - The arrays are `'{}'` for `none_visible` and `no_loco`, else `values`.
- **The whole file is idempotent.** Use `IF NOT EXISTS`, `CREATE OR REPLACE` and
  `DROP POLICY IF EXISTS`.

- [ ] **Step 1: Write the failing tests** in `test_data_fix_schema.py`. Use the helpers
  `as_anon(conn)`, `as_user(conn, uid)` (`set local role authenticated` plus a
  `request.jwt.claim.sub` claim) and `seed_catalog(conn, image_no, description)` (the minimum
  NOT NULL columns of `rat.catalog`).
  - `test_anon_cannot_read_values`: `select` on `rat.data_fix_value` as anon raises
    `InsufficientPrivilege`.
  - `test_non_admin_sees_nothing`: an authenticated user who isn't an admin gets 0 rows, and
    `rat.data_fix_progress()` raises with pgcode `42501`.
  - `test_admin_reads_and_reviews`: an admin calls `review_fix_value('t1', 'loco_number',
    '{9999}', 'corrected', <updated_at>)`. The row then has `values == ['9999']`,
    `status == 'corrected'`, `reviewed_by == uid` and `needs_recheck is False`, and one history
    row has `source == 'review'`.
  - `test_review_stale_raises_40001`: passing an old `updated_at` raises pgcode `40001`.
  - `test_review_bad_status_raises_22023`: `p_status = 'extracted'` raises pgcode `22023`.
  - `test_guard_blocks_direct_update`: after a review, a plain
    `update rat.data_fix_value set values='{1}'` as the owner raises with the message
    `reviewed value is protected`.
  - `test_confirm_skips_stale`: with two items, one of them stale, `confirm_fix_values` returns 1.
  - `test_view_text_semantics`: there are four photos: no row; extracted and empty; `no_loco`;
    and corrected `{A1,B2}`. `loco_numbers_text` is `None`, `None`, `''` and `'A1; B2'`, and anon
    can select these columns.
  - `test_queue_filters_and_paging`: `p_confidence => '{high}'`, `p_after` and `p_limit => 1` page
    correctly, and a needs-recheck verified row appears under the default `p_status`.
  - `test_orphans_listed`: a reviewed row whose `image_no` isn't in the catalog appears in
    `data_fix_orphans()`.
  - `test_ddl_idempotent`: applying `add_data_fix_tables.sql` a second time raises nothing.
- [ ] **Step 2: Check the tests fail.** Run `venv/bin/python -m pytest
  tests/test_data_fix_schema.py -q`. Expected: FAIL, because the objects are missing.
- [ ] **Step 3: Write** `add_data_fix_tables.sql` to the Interfaces above.
- [ ] **Step 4: Check the tests pass.** Re-run. Expected: all pass, with 0 skipped while Docker is
  up.
- [ ] **Step 5: Commit** with the message `feat: data_fix schema with protected review values`.

### Task 5: Extractor `--apply`, preservation test and live check

**Files:**
- Modify: `F/scripts/extract_loco_fields.py`
- Create: `F/scripts/data_fix_preservation_check.py`
- Test: `F/tests/test_data_fix_preservation.py`

**Interfaces:**
- Consumes: `FixRow` and `build_rows` from Task 3, the schema from Task 4, and
  `EXTRACTOR_VERSION`.
- Produces:
  ```python
  @dataclass(frozen=True)
  class ApplyResult: inserted: int; refreshed: int; rechecks: int
  def apply_rows(conn, rows: list[FixRow], batch: int = 1000) -> ApplyResult
  def run(conn, image_nos: list[str] | None, dry_run: bool, out_csv: Path | None = None) -> dict
      # returns {"rows": n, "summary": summarise(...), "apply": asdict(ApplyResult) | None}
  def reviewed_checksum(conn) -> dict   # in data_fix_preservation_check.py
      # {"reviewed": int, "checksum": md5 hex of string_agg(image_no||'|'||fix_id||'|'||values::text||'|'||status order by image_no, fix_id) where status <> 'extracted'}
  ```

**The `apply_rows` upsert.** This is the core promise, so here is the conflict clause exactly:
```sql
INSERT INTO rat.data_fix_value AS d (image_no, fix_id, values, suggested_values, confidence,
       description_hash, extractor_version)
VALUES %s   -- values = suggested_values = extracted
ON CONFLICT (image_no, fix_id) DO UPDATE SET
  suggested_values  = EXCLUDED.suggested_values,
  confidence        = EXCLUDED.confidence,
  extractor_version = EXCLUDED.extractor_version,
  values            = CASE WHEN d.status = 'extracted' THEN EXCLUDED.values ELSE d.values END,
  description_hash  = CASE WHEN d.status = 'extracted' THEN EXCLUDED.description_hash ELSE d.description_hash END,
  needs_recheck     = CASE WHEN d.status <> 'extracted' AND d.description_hash <> EXCLUDED.description_hash
                           THEN true ELSE d.needs_recheck END
WHERE (d.suggested_values, d.confidence, d.extractor_version, d.description_hash, d.needs_recheck)
      IS DISTINCT FROM (EXCLUDED.suggested_values, EXCLUDED.confidence, EXCLUDED.extractor_version,
                        CASE WHEN d.status='extracted' THEN EXCLUDED.description_hash ELSE d.description_hash END,
                        CASE WHEN d.status <> 'extracted' AND d.description_hash <> EXCLUDED.description_hash THEN true ELSE d.needs_recheck END)
RETURNING (xmax = 0) AS inserted, needs_recheck
```
Use `psycopg2.extras.execute_values`, and commit once per batch. `--apply` without
`--image-nos-file` processes the whole catalog.

- [ ] **Step 1: Write the failing tests** in `test_data_fix_preservation.py`, using the `pg`
  fixture.
  - `test_reviewed_values_survive_sync_and_reextract`:
    1. Seed A, B, C and D with high-confidence descriptions, then run `apply_rows`.
    2. As admin, review A as verified, B as corrected `{9999}` and C as `none_visible`.
    3. Record `reviewed_checksum`.
    4. Simulate Stage 2 with `INSERT INTO rat.catalog … ON CONFLICT (image_no) DO UPDATE SET
       description = EXCLUDED.description`: B and D get new descriptions, and A and C are
       re-sent unchanged.
    5. Run `apply_rows(build_rows(all))` again.
    6. Assert:
       - A, B and C keep their values and status, and `reviewed_checksum` is unchanged.
       - B has `needs_recheck` true; A and C have it false.
       - D's `values` equal the new extraction.
       - B's `suggested_values` reflect its new description.
  - `test_reapply_is_noop`: a second identical `apply_rows` returns
    `ApplyResult(inserted=0, refreshed=0, rechecks=0)`, and `updated_at` is unchanged.
  - `test_hash_parity`: for `"café"`, `"a\r\nb"`, `"msmsa026\r5"` and `None`, the Python
    `description_hash` equals the SQL `encode(sha256(convert_to(coalesce(%s, ''), 'UTF8')), 'hex')`.
  - `test_loader_never_touches_data_fix`: the strings `data_fix` and `extract_loco_fields` appear
    in none of `scripts/db_dml_loader.py`, `scripts/filemaker_extract.py` or
    `scripts/run_incremental_sync.py`. Task 6 relaxes this check for `run_incremental_sync.py`
    only.
  - `test_run_scopes_to_image_nos`: `run(conn, ["A"], dry_run=False)` touches only A's two rows.
- [ ] **Step 2: Check the tests fail.** Run `venv/bin/python -m pytest
  tests/test_data_fix_preservation.py -q`. Expected: FAIL.
- [ ] **Step 3: Implement** `ApplyResult`, `apply_rows`, `run`, `--apply` and
  `data_fix_preservation_check.py`. The check script's CLI prints `reviewed_checksum` as JSON,
  using `--target-profile` and a read-only session.
- [ ] **Step 4: Check the tests pass.** Run the full suite with `venv/bin/python -m pytest -q`.
  Expected: all pass.
- [ ] **Step 5: Commit** with the message `feat: extractor apply with reviewed-value preservation`.

### Task 6: Run the extraction after each incremental sync

**Files:**
- Modify: `F/scripts/run_incremental_sync.py`, just after `pg.mark_loaded(mark)` (around line
  463).
- Modify: `F/tests/test_data_fix_preservation.py`, to relax the loader guard as described in
  Task 5.

**Interfaces:**
- Consumes: `extract_loco_fields.run(conn, image_nos, dry_run=False)` from Task 5.
- Produces:
  - A summary JSON key `"data_fix": {"rows": int, "inserted": int, "refreshed": int, "rechecks": int}`,
    or `{"error": str}` on failure.
  - A report line `report.kv("loco fields refreshed:", n)`.
  - A failure here **never** fails the sync. It is logged with
    `reject_log.log_crash(...)` and recorded under `"data_fix": {"error": ...}`.

- [ ] **Step 1: Update the guard test.** For `run_incremental_sync.py`, assert that `data_fix`
  is absent and that `extract_loco_fields` appears exactly twice: one import and one `.run(`
  call. Run it. Expected: FAIL, because the hook isn't there yet.
- [ ] **Step 2: Add the hook.** Call `run(pg.cnxn, sorted(verified), dry_run=False)` inside
  `try/except Exception`, and write its result into the summary dict.
- [ ] **Step 3: Check the full suite passes.** Run `venv/bin/python -m pytest -q`. Also run
  `venv/bin/python scripts/run_incremental_sync.py --help`. Expected: tests pass and the help
  text prints, so the import works.
- [ ] **Step 4: Commit** with the message
  `feat: refresh loco fields for each incremental sync's verified rows`.

### Task 7: Live rollout on `oci` (the user runs the DDL)

**Files:**
- Modify: `F/supabase/schema/bootstrap_rat_schema.sql`. Append the `add_data_fix_tables.sql`
  section, and update the view block so a fresh rebuild gets the new columns.
- Modify: `W/DEVOPS.md`, sections §3.1 (view) and §3.2 (grants). The verify query's expected
  `anon` list is unchanged.
- Modify: `F/CLAUDE.md` ("Where things live" rows for `extract_loco_fields.py`,
  `add_data_fix_tables.sql` and `data_fix_preservation_check.py`) and `F/TODO.md` (status).

- [ ] **Step 1: Make sure the Task 3 checkpoint is approved** by the user. Do not continue without
  it.
- [ ] **Step 2: Hand the user the DDL command and wait.** Ask them to paste
  `supabase/schema/add_data_fix_tables.sql` into the Studio SQL editor, or to run
  `docker exec -i supabase-db psql -U postgres -d postgres < add_data_fix_tables.sql` on huey.
  Expected output: no `ERROR`.
- [ ] **Step 3: Verify read-only.** Check that `select count(*) from rat.data_fix` returns 2, and
  that an anon REST call to `mobile_catalog_view?select=image_no,loco_numbers_text&limit=1`
  returns HTTP 200 with the key present.
- [ ] **Step 4: Apply live.** Run `venv/bin/python scripts/extract_loco_fields.py --apply
  --target-profile oci`. Expected: `inserted` = 2 × the catalog count (282,488 on 141,244 rows),
  and a summary that matches Task 3's final dry run exactly.
- [ ] **Step 5: Spot-check.** An anon REST call for `image_no=eq.gd820040` returns
  `loco_numbers == ["2295"]`. Run `venv/bin/python scripts/data_fix_preservation_check.py
  --target-profile oci`; expected `{"reviewed": 0, …}`. Record the output in the devlog.
- [ ] **Step 6: Re-run `--apply`.** Expected: `inserted=0 refreshed=0 rechecks=0`, i.e. idempotent
  live.
- [ ] **Step 7: Confirm backups.** Check that the newest automated `oci` backup taken after this
  point contains `rat.data_fix_value`. Use `pg_restore --list <file> | grep data_fix`, or hand
  that command to the user if the backup host is unreachable.
- [ ] **Step 8: Commit** the bootstrap, DEVOPS and CLAUDE/TODO updates in each repo, with the
  message `docs: data_fix schema in bootstrap and DEVOPS`.

### Task 8: Public search uses the new fields

**Files:**
- Modify: `W/package.json`. Add a `vitest` devDependency with an exact version (e.g. `3.2.4`) and
  the script `"test": "vitest run"`.
- Modify: `W/src/services/catalogService.ts`, `W/src/types/catalog.ts`,
  `W/src/lib/filterDefinitions.ts`, `W/src/hooks/useVisibleFilters.ts`,
  `W/src/components/search/FilterPanel.tsx`, `W/src/pages/SearchPage.tsx` (FILTER_LABELS and URL
  key handling; grep `loco`) and `W/src/components/detail/PhotoDetailView.tsx`.
- Test: `W/src/services/catalogService.test.ts` and `W/src/hooks/useVisibleFilters.test.ts`.

**Interfaces:**
- Consumes: the view columns from Task 4.
- Produces:
  - `export function locoNumberOrFilter(value: string): string`. It returns the PostgREST
    `or=` body
    `loco_numbers_text.imatch.<Q>,and(loco_numbers_text.is.null,description.imatch.<Q>)`, where
    `<Q> = pgQuoteFilterValue(locoNumberPattern(value))`. It is applied with
    `builder.or(...)`.
  - `export function locoNameTerms(value: string): string[]`: whitespace-split, with empties
    dropped. Each term is applied as
    `builder.ilike('loco_names_text', `%${escapeLikePattern(term)}%`)`.
  - `CatalogFilters.locoName?: string`.
  - `CatalogPhoto.loco_numbers: string[] | null` and `CatalogPhoto.loco_names: string[] | null`.
  - `FilterId` gains `'locoName'`, with label `'Loco name'` and keys `['locoName']`.
    `DEFAULT_FILTERS = ['country', 'location', 'date', 'loco', 'locoName']`.
  - `useVisibleFilters` changes:
    - `STORAGE_KEY = 'picaloco.visibleFilters.v2'`
    - `export function migrateLegacy(rawV1: string | null): FilterId[] | null`. It parses v1 and
      appends `'locoName'` if absent. It returns null if there's no v1 or the v1 is invalid.
    - `load()` tries v2, then `migrateLegacy(v1)` (saving the result as v2), then the defaults.

- [ ] **Step 1: Write the failing tests.**
  - `locoNumberOrFilter('42616')` contains `loco_numbers_text.imatch."(^|[^[:alnum:]])42616([^[:alnum:]]|$)"`
    and `and(loco_numbers_text.is.null,description.imatch.`. Adjust the quoting to whatever
    `pgQuoteFilterValue` actually emits.
  - `locoNumberOrFilter('E.113')` contains `E\\.113`.
  - `locoNumberOrFilter('a,b(c)')`: the `a,b(c)` part sits only inside a double-quoted segment.
  - `locoNameTerms('  Flying   scotsman ')` deep-equals `['Flying', 'scotsman']`, and
    `locoNameTerms('')` deep-equals `[]`.
  - `migrateLegacy('["country","loco"]')` deep-equals `['country', 'loco', 'locoName']`;
    `migrateLegacy('["locoName"]')` deep-equals `['locoName']`; `migrateLegacy('junk')` and
    `migrateLegacy(null)` are null.
- [ ] **Step 2: Check the tests fail.** Run `cd W && npm i && npm test`. Expected: FAIL.
- [ ] **Step 3: Implement.** In `searchCatalog`, replace the stopgap `description` imatch with
  `builder.or(locoNumberOrFilter(filters.loco))`, and add the `locoName` terms.
  - FilterPanel: `case 'locoName'` renders a `TextFilter` with id `f-loco-name`, label
    `Loco name` and placeholder `e.g. Flying Scotsman`. Drop the loco filter's
    "Searches photo descriptions" hint.
  - PhotoDetailView: show `Loco number(s)` and `Loco name(s)` rows, joined with `'; '`, hidden
    when empty.
  - Update the stopgap comment on `locoNumberPattern`.
- [ ] **Step 4: Check everything passes.** Run `npm test && npm run lint && npm run build`.
  Expected: all green.
- [ ] **Step 5: Browser check** against live data (needs Task 7 done). Start the dev server with
  `CHOKIDAR_USEPOLLING=1 npm run dev`.
  - Loco number `2295` returns `gd820040`.
  - Loco name `Flying Scotsman` returns the `mstod129` record.
  - Loco number `E.113` returns no HTTP 400.
  - The panel shows Loco name by default in a fresh profile, and also in a profile that has an old
    v1 key.
  - The detail page shows both rows.
  - There are no console errors.
- [ ] **Step 6: Commit** on branch `data-fixes` in `W`, with the message
  `feat: search on extracted loco number and name`.

### Task 9: Admin sign-in

**Files:**
- Create: `W/src/lib/supabase/adminClient.ts`, `W/src/hooks/useAdminSession.ts`,
  `W/src/components/admin/SignInForm.tsx` and `W/src/components/admin/RequireAdmin.tsx`
- Modify: `W/src/App.tsx` (routes) and `W/src/pages/AdminPage.tsx` (a "Data Fixes →" link)
- Test: `W/src/hooks/useAdminSession.test.ts`

**Interfaces:**
- Produces:
  - `adminSupabase = createClient(url, anonKey, { db: { schema: 'rat' }, auth: { persistSession: true, autoRefreshToken: true, storageKey: 'picaloco-admin-auth' } })`.
    The public `supabase` client stays unchanged.
  - `type AdminStatus = 'loading' | 'signed-out' | 'not-admin' | 'admin'`
  - `useAdminSession(): { status: AdminStatus; email: string | null; signIn(email: string, password: string): Promise<string | null>; signOut(): Promise<void> }`.
    `signIn` resolves to an error message, or null on success. The admin check is
    `adminSupabase.rpc('is_admin')`.
  - `export function adminStatusFrom(hasSession: boolean, isAdmin: boolean | null): AdminStatus`,
    pure.
  - `<RequireAdmin>{children}</RequireAdmin>`: shows `SignInForm` when signed out, and the message
    "This account isn't an admin." plus a Sign out button when not an admin.
  - Routes: `/admin/fixes` and `/admin/fixes/:fixId` go through `RequireAdmin`. `/admin` itself
    stays public.

- [ ] **Step 1: Write the failing test.** `adminStatusFrom` maps
  `(false, null)` → `'signed-out'`, `(true, null)` → `'loading'`, `(true, false)` → `'not-admin'`
  and `(true, true)` → `'admin'`.
- [ ] **Step 2: Check it fails.** Run `npm test`. Expected: FAIL.
- [ ] **Step 3: Implement** the files above.
- [ ] **Step 4: Check everything passes.** Run `npm test && npm run lint && npm run build`.
- [ ] **Step 5: User ops: hand over these steps one at a time and wait.**
  1. On huey, set `DISABLE_SIGNUP=true` in the Supabase docker `.env`, then run
     `docker compose up -d auth`.
  2. Create the admin account(s) in Studio → Authentication → Add user.
  3. Run `insert into rat.admin_user(user_id) select id from auth.users where email = '<email>';`.
  4. The agent verifies that `/auth/v1/settings` returns `"disable_signup":true`.
- [ ] **Step 6: Browser check.**
  - Signed out, `/admin/fixes` shows the form.
  - A wrong password shows the error.
  - A good login shows the page.
  - A reload keeps the session.
  - Sign out returns to the form.
  - An authenticated non-admin shows the not-admin message.
  - `/admin` (Migration status) still works signed out.
- [ ] **Step 7: Commit** with the message `feat: admin sign-in for data fixes`.

### Task 10: Data Fixes list page

**Files:**
- Create: `W/src/services/dataFixService.ts`, `W/src/pages/DataFixesPage.tsx` and
  `W/src/components/admin/fixes/FixProgressCard.tsx`
- Test: `W/src/services/dataFixService.test.ts`

**Interfaces:**
- Consumes: `adminSupabase` (Task 9), and the RPCs `data_fix_progress` and `data_fix_orphans`
  plus the table `data_fix` (Task 4).
- Produces, in `dataFixService.ts`:
  ```ts
  export type FixConfidence = 'none' | 'low' | 'med' | 'high'
  export type FixStatus = 'extracted' | 'verified' | 'corrected' | 'none_visible' | 'no_loco'
  export const CONFIDENCE_ORDER: FixConfidence[] = ['none', 'low', 'med', 'high']
  export interface DataFix { id: string; title: string; summary: string | null; instructions: string; sort_order: number }
  export interface ProgressRow { fix_id: string; status: FixStatus; confidence: FixConfidence; needs_recheck: boolean; n: number }
  export interface FixProgress { total: number; reviewed: number; needsRecheck: number; byConfidence: Record<FixConfidence, { total: number; open: number }> }
  export function getFixes(): Promise<DataFix[]>
  export function getProgress(): Promise<ProgressRow[]>
  export function getOrphans(): Promise<{ image_no: string; fix_id: string; status: FixStatus }[]>
  export function summariseProgress(rows: ProgressRow[], fixId: string): FixProgress  // reviewed = status !== 'extracted'; open = status === 'extracted'
  ```

- [ ] **Step 1: Write the failing test** for `summariseProgress`. Fixture rows for two fixes:
  loco_number high/extracted 10, high/verified 5, none/no_loco 2, and a verified row with
  needs_recheck true 1.
  - Expect for `loco_number`: `total` 18, `reviewed` 8, `needsRecheck` 1,
    `byConfidence.high` = `{total: 16, open: 10}`, `byConfidence.none` = `{total: 2, open: 0}`.
  - The other fix's rows are ignored.
- [ ] **Step 2: Check it fails.** Run `npm test`. Expected: FAIL.
- [ ] **Step 3: Implement** the service and the page.
  - One card per fix: title, summary, "N of M reviewed" with a progress bar, and one link per
    confidence in `CONFIDENCE_ORDER` showing its open count. Each link goes to
    `/admin/fixes/:id?confidence=<c>`.
  - A "Needs recheck (N)" link goes to `?status=&recheck=1`.
  - If `getOrphans()` returns anything, show a small "Photos no longer in the catalog" list.
- [ ] **Step 4: Check everything passes.** Run `npm test && npm run lint && npm run build`.
- [ ] **Step 5: Browser check** as admin. The counts match
  `select fix_id, confidence, count(*) from rat.data_fix_value group by 1, 2` (run read-only), and
  the page works in light, dark and Bespoke.
- [ ] **Step 6: Commit** with the message `feat: data fixes list with progress`.

### Task 11: Review queue and review card

**Files:**
- Create: `W/src/lib/queueParams.ts`, `W/src/lib/reviewKeys.ts`,
  `W/src/pages/FixQueuePage.tsx`, `W/src/components/admin/fixes/QueueFilters.tsx` and
  `W/src/components/admin/fixes/ReviewCard.tsx`
- Modify: `W/src/services/dataFixService.ts` and `W/src/services/images.ts`
- Test: `W/src/lib/queueParams.test.ts`, `W/src/lib/reviewKeys.test.ts` and additions to
  `W/src/services/dataFixService.test.ts`

**Interfaces:**
- Consumes: the Task 10 types, and the RPCs `data_fix_queue` and `review_fix_value` plus the
  table `data_fix_value` (Task 4).
- Produces:
  ```ts
  // queueParams.ts
  export interface QueueParams { confidence: FixConfidence[]; status: FixStatus[]; includeRecheck: boolean; collection: string | null; text: string | null }
  export const DEFAULT_QUEUE_PARAMS: QueueParams  // { confidence: [], status: ['extracted'], includeRecheck: true, collection: null, text: null }
  export function parseQueueParams(sp: URLSearchParams): QueueParams      // keys: confidence, status (comma lists), recheck ('0'|'1'), collection, q; unknown values dropped
  export function serializeQueueParams(p: QueueParams): URLSearchParams   // omits defaults
  // reviewKeys.ts
  export type ReviewAction = 'confirm' | 'edit' | 'notVisible' | 'noLoco' | 'skip' | 'back' | 'cancelEdit'
  export function shortcutFor(key: string, target: { tagName: string; isContentEditable: boolean }): ReviewAction | null
  // dataFixService.ts additions
  export interface QueueRecord { image_no: string; description: string | null; collection: string | null; date_taken: string | null; cd_no: string | null; values: string[]; suggested_values: string[]; confidence: FixConfidence; status: FixStatus; needs_recheck: boolean; updated_at: string }
  export type ReviewOutcome = { ok: true; updated_at: string } | { ok: false; reason: 'stale' | 'forbidden' | 'signed-out' | 'error'; message: string }
  export function getQueuePage(fixId: string, p: QueueParams, after: string | null, limit?: number): Promise<QueueRecord[]>  // limit default 25; empty confidence -> p_confidence null
  export function getValue(fixId: string, imageNo: string): Promise<Pick<QueueRecord, 'values' | 'suggested_values' | 'status' | 'needs_recheck' | 'updated_at'> | null>
  export function reviewValue(i: { imageNo: string; fixId: string; values: string[]; status: Exclude<FixStatus, 'extracted'>; expectedUpdatedAt: string }): Promise<ReviewOutcome>
  export function mapReviewError(err: { code?: string; message?: string; status?: number }): 'stale' | 'forbidden' | 'signed-out' | 'error'  // 40001 stale; 42501 forbidden; status 401 or code PGRST301 or /JWT expired/ signed-out
  export function normaliseValues(input: string): string[]   // split on newline or ';', trim, drop empty, dedupe keeping first
  export function formatWarnings(values: string[]): string[] // soft: >20 chars; chars outside [A-Za-z0-9 ./\-'&]
  // images.ts
  export function getReviewImageUrl(imageNo: string): string  // = getThumbnailUrl for now (see spec deviation)
  ```

**Keys** (from spec §7): `Enter` confirm, `e` edit, `n` notVisible, `x` noLoco, `s` or
`ArrowRight` skip, `ArrowLeft` back. While focus is in an INPUT or TEXTAREA, or a contentEditable
element, only `Escape` (→ `cancelEdit`) and `Ctrl/Cmd+Enter` are handled. Keys are
case-insensitive.

**Queue behaviour:**
- Records load 25 at a time. The next page is fetched when 5 remain, and the next 3 images are
  preloaded with `new Image()`.
- A reviewed record stays in the local list, marked "done", so Back can revisit it and
  re-review it.
- **Stale:** show "Someone else changed this record — reloaded", call `getValue`, and stay on the
  record.
- **Signed out:** show "Signed out — sign in again". The typed edit stays in component state.
- **Empty filter:** show "Nothing left for this filter", with a link back to `/admin/fixes`.
- **Labels per fix:**
  - For `loco_name`, the Not visible button reads "No name visible".
  - For `loco_number`, it reads "No number visible".
  - Both fixes use "No loco in photo" for the No loco button.
- **The card shows:**
  - The image at max fit. Clicking it toggles 2× zoom with panning.
  - `image_no`, collection, date and `cd_no`.
  - The description, with the suggested values highlighted.
  - The values in a textarea (one per line) and the suggestion with its confidence.
  - The `formatWarnings` output.
  - A side panel with `data_fix.instructions`, or "No format instructions yet" when empty.
  - Every button carrying its shortcut letter.

- [ ] **Step 1: Write the failing tests.**
  - queueParams: the round trip `serializeQueueParams(parseQueueParams(x))` holds. Defaults
    serialise to an empty string. `confidence=high,bogus` parses to `['high']`. `recheck=0` gives
    `includeRecheck` false.
  - reviewKeys:
    - `shortcutFor('n', {tagName: 'DIV', isContentEditable: false})` is `'notVisible'`.
    - `shortcutFor('n', {tagName: 'TEXTAREA', isContentEditable: false})` is null.
    - `shortcutFor('Escape', {tagName: 'TEXTAREA', isContentEditable: false})` is `'cancelEdit'`.
    - `shortcutFor('E', {tagName: 'DIV', isContentEditable: false})` is `'edit'`.
    - `shortcutFor('ArrowRight', {tagName: 'DIV', isContentEditable: false})` is `'skip'`.
    - `shortcutFor('q', {tagName: 'DIV', isContentEditable: false})` is null.
  - `mapReviewError`: `{code: '40001'}` → `stale`; `{code: '42501'}` → `forbidden`;
    `{status: 401}` → `signed-out`; `{code: 'PGRST301'}` → `signed-out`;
    `{message: 'JWT expired'}` → `signed-out`; `{}` → `error`.
  - `normaliseValues(' 99 7238 ;\nE113\n\n E113')` deep-equals `['99 7238', 'E113']`.
  - `formatWarnings(['42616'])` deep-equals `[]`. `formatWarnings(['x'.repeat(21)])` has length 1.
    `formatWarnings(['42616 ✓'])` has length 1.
- [ ] **Step 2: Check they fail.** Run `npm test`. Expected: FAIL.
- [ ] **Step 3: Implement** the files above, with React Query for the queue pages.
- [ ] **Step 4: Check everything passes.** Run `npm test && npm run lint && npm run build`.
- [ ] **Step 5: Browser check** as admin, against a test record. Set the record back afterwards
  only via `review_fix_value`, and tell the user which `image_no`s were touched.
  - `Enter` confirms and advances; after a reload the record is `verified`.
  - `e`, type `Flying Fox`, `Ctrl+Enter` saves as `corrected`, and typing `n` inside the box types
    an `n`.
  - `n` gives `none_visible`, and `x` gives `no_loco`.
  - `ArrowLeft` returns to the previous record.
  - **Stale:** in two tabs, saving in tab 1 and then in tab 2 shows the stale message.
  - **Empty filter:** `?q=zzzzzz` shows the empty state.
  - **Signed out:** clearing the `picaloco-admin-auth` storage and then saving shows the
    signed-out message and keeps the edit text.
  - It works at tablet width (768px) and in Bespoke.
- [ ] **Step 6: Commit** with the message `feat: data fix review queue with keyboard review`.

### Task 12: Bulk confirm grid for high confidence

**Files:**
- Create: `W/src/components/admin/fixes/BulkConfirmGrid.tsx`
- Modify: `W/src/pages/FixQueuePage.tsx` and `W/src/services/dataFixService.ts`
- Test: additions to `W/src/services/dataFixService.test.ts`

**Interfaces:**
- Consumes: `getQueuePage` and `QueueRecord` from Task 11, and the `confirm_fix_values` RPC from
  Task 4.
- Produces:
  - `export function confirmMany(fixId: string, items: { image_no: string; updated_at: string }[]): Promise<number>`.
    It passes `items` straight through as `p_items`.
  - `export function toConfirmItems(records: QueueRecord[], unticked: ReadonlySet<string>): { image_no: string; updated_at: string }[]`.
    It sends only `extracted` records.
  - A "Grid" toggle on the queue page, shown only when `confidence` is exactly `['high']`. The
    grid shows 24 records, all ticked, with each value overlaid on its thumbnail. Clicking a
    record unticks it. The button reads "Confirm N". The result reads "Confirmed X of N", where a
    shortfall means stale rows that stay in the queue.

- [ ] **Step 1: Write the failing test.** For 3 records, one unticked and one already `verified`,
  `toConfirmItems` returns exactly 1 item, with the right `image_no` and `updated_at` keys.
- [ ] **Step 2: Check it fails.** Run `npm test`. Expected: FAIL.
- [ ] **Step 3: Implement** `toConfirmItems`, `confirmMany` and the grid.
- [ ] **Step 4: Check everything passes.** Run `npm test && npm run lint && npm run build`.
- [ ] **Step 5: Browser check** as admin. Untick 2 of 24 and confirm. Expect "Confirmed 22 of 22";
  the 2 unticked records remain in the single-review queue, and the progress counts move by 22.
  Tell the user which records were confirmed.
- [ ] **Step 6: Commit** with the message `feat: bulk confirm for high-confidence fixes`.

### Task 13: Docs, merge and production check

**Files:**
- Modify: `W/DEVOPS.md` (new §12 "Data Fixes": admin accounts, `admin_user`, signups disabled,
  the RPC list, and how to run `extract_loco_fields.py` and the preservation check) and
  `W/README.md` (features list).
- Modify: `F/devlog/worksheet.md` (session entry) and `F/TODO.md` (mark the loco-number item
  built, and leave the client open questions).

- [ ] **Step 1: Write the docs** above.
- [ ] **Step 2: Run the full suites.** In `F`, run `venv/bin/python -m pytest -q`; in `W`, run
  `npm test && npm run lint && npm run build`. Expected: all green.
- [ ] **Step 3: Ask the user to approve the merge.** On approval, merge `data-fixes` into `main` in
  both repos and push. Vercel then deploys `W`.
- [ ] **Step 4: Production check.**
  - At `https://picaloco-web.vercel.app`, loco number `2295` finds `gd820040` and loco name
    `Flying Scotsman` finds `mstod129`.
  - `/admin/fixes` asks for sign-in.
  - Admin login reaches the list.
  - There are no console errors.
- [ ] **Step 5: Run the preservation check live**:
  `venv/bin/python scripts/data_fix_preservation_check.py --target-profile oci`. Record the
  output as the baseline to compare after the next sync.
