# Data Fixes: Loco number and Loco name

Date: 2026-11-14. Status: design, awaiting approval. Repos touched: `picaloco_web` (admin UI,
search), `filemaker_sync` (extraction script, schema DDL, bootstrap). The live DB is `oci`.

## 1. Intent

RAT's photo descriptions carry the locomotive's running number, and often its name, as free
text: `Class WP 4-6-2 number 7331 heads…`, `LNER Class A3 4-6-2 No. 60103 Flying Scotsman…`.
Because the text grew up over many years and many volunteers, it isn't consistent. A search on
it is unreliable, and roughly a quarter of the photos have no number in the text at all.

The client wants two clean, searchable fields per photo: **Loco number(s)** and **Loco name(s)**.
They want to clean the data themselves, looking at each photo, before the search is launched
publicly from ratrust.org.

We pre-fill both fields automatically from the descriptions and grade each value's confidence.
The client then works through the values in an Admin → **Data Fixes** screen, choosing which
confidence band to tackle first. Loco number and Loco name are the first two Data Fixes. The
screen is built so that more fixes can be added later.

Two requirements drive the whole design. They come from the client.

- **Don't waste the client's time.** They review with the photo in front of them, quickly, and
  never review the same thing twice.
- **A correction is never lost.** Nothing in the FileMaker → Postgres pipeline, and no re-run of
  the extraction, may overwrite a value a person has reviewed.

## 2. Goals, non-goals, anti-goals

**Goals**
1. Two new per-photo fields, Loco number(s) and Loco name(s), each able to hold several values.
   A photo can show several locos, and a loco can carry more than one identity.
2. Automatic extraction from `description`. Every value is graded **none / low / med / high**.
3. Every extracted value is searchable **immediately**, whatever its confidence. Nobody has to
   review a value before it becomes searchable.
4. An Admin → Data Fixes area, behind a login, with a review queue per fix. The queue can be
   filtered by confidence (the client wants to work none → low → med → high), by review status
   and by collection. Each record shows the photo large enough to read the number.
5. Every human decision is stored with who made it and when, and a full history is kept.
6. Proof that a reviewed value survives a full sync and a re-extraction.

**Non-goals**
- No change to FileMaker or its entry form. The corrected values live only in Postgres. The
  client will issue format instructions to volunteers separately.
- No edits to `description`, ever. That includes the duplicated works-number text in the `ms*`
  collections, which stays as it is; the extractor simply ignores it.
- No push of corrections back to FileMaker.
- No fix for the Builder code / Works number filters. That's a separate item in `filemaker_sync`'s
  `TODO.md`.
- No public editing. Only logged-in admins can change values.

**Anti-goals** (any of these means the feature has failed, even if it technically works)
- A reviewed value is overwritten by a sync or a re-extraction.
- The client reviews the same record twice, or waits on slow loads, or squints at a thumbnail.
- `anon` (the public key in the browser) can write to these tables, or can read `rat.catalog`.
- Validation rejects an unusual but valid number format. Railways used very different schemes
  (`42616`, `E113`, `52.7034`, `141TB.424`, `99 7238`, `055.988-0`).

## 3. Constraints and facts the design relies on

- **FileMaker sync overwrites `rat.catalog`.** Since Session 23, `batch_upsert()` does
  `ON CONFLICT DO UPDATE`. So the new values **must not** live in `rat.catalog` or any table that
  Stage 2 writes. They get their own tables (§4), which the pipeline never touches.
- **`image_no` is the natural key** (Golden Rule #3). Catalog UUIDs are internal. Key everything
  on `image_no`.
- **`anon` grants are deliberately narrow.** `anon` can read `mobile_catalog_view` and the small
  lookup tables only (`picaloco_web/DEVOPS.md` §3.2). New data reaches the public through the view.
- **DDL and grants on `oci` are auto-blocked for the agent.** Hand the exact SQL to the user to
  run. Fold every change into `filemaker_sync/supabase/schema/bootstrap_rat_schema.sql` and
  `picaloco_web/DEVOPS.md` §3.
- **Supabase Auth (GoTrue v2.189.0) is running on `oci`, with email login enabled.** This was
  checked live on 2026-11-14 through `/auth/v1/health` and `/auth/v1/settings`. Whether sign-up is
  disabled has not been checked.
- **`/admin` is currently public.** It shows the read-only Migration status page.
- **Postgres-only scripts run from WSL.** Only FileMaker access needs `python.exe`.
- **Validate against fixtures, not the live DB** (Golden Rule #4).

## 4. Data model (decided in outline; exact DDL left to the builder)

The model is generic, so later Data Fixes reuse it.

**`rat.data_fix`**: the registry of fixes. One row per fix.
- `id` text PK, e.g. `'loco_number'`, `'loco_name'`.
- `title`, `summary`.
- `instructions`: plain text, the client's format rules, shown beside the review card. Initially
  empty, because the client hasn't sent them yet.
- `sort_order`.

**`rat.data_fix_value`**: one row per (photo, fix).
- `image_no` text and `fix_id` text, together the PK. `fix_id` references `rat.data_fix`.
- `values` text[], ordered, possibly empty. The current value(s).
- `suggested_values` text[]: the extractor's latest suggestion. It is kept separate so that a
  re-extraction can update a suggestion without touching a reviewed value.
- `confidence`: `none | low | med | high`. Always the extractor's grade; review never changes it.
- `status`, one of:
  - `extracted`: nobody has looked at it.
  - `verified`: a person confirmed the suggestion.
  - `corrected`: a person changed it.
  - `none_visible`: there's a loco, but the number or name can't be read.
  - `no_loco`: there's no loco in the photo.
- `needs_recheck` boolean: the description changed in FileMaker after a person reviewed the record.
- `description_hash`: a hash of `description` at the time of extraction or review.
- `extractor_version` text.
- `reviewed_by` (auth user id), `reviewed_at`, `updated_at`.
- Search-friendly copy for the view: `values_text`, i.e. `array_to_string(values, '; ')`, as a
  generated column or computed in the view.

**`rat.data_fix_history`**: append-only. A trigger writes one row per insert or update on
`data_fix_value`, holding the old values, the new values, the old status, the new status, who made
the change, when, and the source (`extractor` or `review`). This gives traceability and undo.

**`rat.admin_user`**: `user_id` uuid PK, referencing `auth.users`. RLS policies check membership.

**Orphans (my call: no FK to `rat.catalog`).** If an `image_no` is corrected in FileMaker (the
known `msmsa026<CR>5` case, for example), the reviewed row must not vanish through a cascade. The
admin area shows a small "photo no longer in catalog" list instead.

**Access**
- `anon`: no direct access to these tables. Public reads go through `mobile_catalog_view` only.
- `authenticated` + `admin_user` membership: `SELECT` on all of these tables, and
  `INSERT`/`UPDATE` on `data_fix_value`. No `DELETE`. Enforced by RLS.
- The extractor connects as the Postgres owner role, exactly like the existing pipeline scripts.

**View change.** `rat.mobile_catalog_view` gains `loco_numbers text[]`, `loco_numbers_text`,
`loco_names text[]` and `loco_names_text`, through a `LEFT JOIN` on `data_fix_value`. Values with
status `none_visible` or `no_loco` are exposed as empty. The `anon` grant stays as it is, because
it is already on the view.

## 5. The preservation rules (the core promise)

These rules are enforced in SQL by the extractor's upsert and by RLS, not just by convention in
the code.

1. **The extractor only writes `values` when `status = 'extracted'`.** For every other status it
   may update only `suggested_values`, `confidence`, `extractor_version`, `description_hash` and
   `needs_recheck`.
2. **A changed description triggers a recheck flag, never an overwrite.** If a reviewed record's
   current `description` hash differs from the stored one, set `needs_recheck = true` and refresh
   `suggested_values`. `values` and `status` stay as they are.
3. **The sync never touches these tables.** Stage 2 has no code path that writes to `data_fix_*`.
   Add a test that fails if `db_dml_loader.py` ever references them.
   *Amended 2026-11-14 (final review):* after each load, Stage 2 now calls the extractor's
   `--apply` path for the rows it loaded. Without this, a GUI Full Sync or Load to Target would
   never queue new photos or raise `needs_recheck`, which would break rule 2. The loader still has
   no SQL of its own against `data_fix_*`, and the guard test enforces that. The extractor's upsert
   is the only writer, and the SQL guard trigger stops it changing a reviewed value.
4. **Every change is recorded** in `data_fix_history`, by the trigger, from both sources.
5. **Concurrent edits can't silently overwrite each other.** The review UI sends the
   `updated_at` it loaded. The update fails if the row has changed since, and the UI reloads the
   record.

**Assurance we hand the client**
- **An automated test** against a scratch schema, never the live DB:
  1. Seed records.
  2. Review some as verified, some as corrected and some as none visible.
  3. Run a Stage 2 upsert over the matching catalog rows.
  4. Run the extractor again, both with the descriptions unchanged and with some changed.
  5. Assert that every reviewed `values`/`status` pair is byte-identical, and that
     `needs_recheck` is set exactly on the changed ones.
- **A live check after each sync**, as a saved query or a figure in the admin area: the count of
  reviewed rows and a checksum of their values, before and after. They must match.
- **Backups.** Confirm the existing automated `oci` backups include the new tables, and restore
  them once to prove it.

## 6. Extraction

**Where it runs (my call).** A new script, `filemaker_sync/scripts/extract_loco_fields.py`.
Postgres only, so it runs from WSL.
- Modes: `--dry-run`, which writes a CSV report and nothing to the DB, and `--apply`.
- Scope: everything by default, or `--image-nos-file` for just a delta.
- It is called at the end of `run_incremental_sync.py` with that run's new and changed
  `image_no`s, so new photos get suggestions automatically. It can also be run by hand.
- It reads `description` from `rat.catalog` and writes only `data_fix_value` (§5).

**Loco number: starting rules.** These come from the 2026-11-14 dry run over all 141,244 rows.
The prototype is in the scratchpad (`dryrun.py`) and the figures are in `filemaker_sync/TODO.md`.

**Markers:** `number`, `numbers`, `No.`, `no.`, `Nos.`, `nos.`, `Nr.`, plus lists joined by `,`, `&`
or `and`.

**Excluded first:** `Works No. X`, `(NNNN/YYYY)` and the phrase "number of".

**Confidence bands:**

| Confidence | Rule | Dry-run size |
|---|---|---|
| high | Exactly one marked number (whether or not a Works No. is present) | 90,958 (64.4%) |
| med | Two or more marked numbers (several locos, or a renumbering such as `number 130, Urquiza no. 290`), or an odd format (contains `/`, more than 10 characters, or 7 or more digits) | 14,649 (10.4%) |
| low | No marker, but a likely bare number (3–6 digits, optionally with a letter prefix, not year-shaped) | 3,287 (2.3%) |
| none | Nothing found, or an empty description | 32,350 (22.9%) |

**Parser fixes to make before the first `--apply`.** All of these were found in the dry run.
- **Space-separated numbers** (`No. 99 7238`, `number 73 129`, `763 193`) are currently cut short
  to their first group. That affects about 2,693 high rows. Either capture the whole number, or
  demote the record to med when a digit group follows directly.
- **Missed marker variants**: `number. 2683`, `No, E113`, and letter prefixes separated by a space
  (`number DT 601`, `KDB 951455`, `ETA 178.110`). About 979 records currently land in none because
  of these.
- **Check the result.** Re-run the dry run, compare the bucket counts with the first run, and
  hand-check a random sample of 50 high records. The bar: high must be right at least 98% of the
  time. If it isn't, tighten the rules.

**Loco name: rules not yet derived (left to the builder).** Do a name dry run the same way first.
The obvious starting signal is a run of capitalised words straight after a marked number (`60103
Flying Scotsman`, `673 Maude`), or after a wheel arrangement (`0-6-0T Doll`). Stop at a verb
(`stands`, `heads`, `built`…) or at punctuation. Grade it like the numbers:
- **high:** directly follows a marked number.
- **med:** several names, or one after a wheel arrangement.
- **low:** a capitalised run anywhere else.
- **none:** nothing found.

Exclude place names, which already exist in the location, route and organisation lookup tables.
Share the name dry-run figures with the user before applying.

## 7. Admin → Data Fixes UI

**Login.** Supabase Auth, email and password.
- Sign-up is disabled. Accounts are created by us and added to `rat.admin_user`.
- The Data Fixes routes require a login. The existing Migration status page stays public, as it
  is today (my call: no behaviour change there).
- Show a clear "Sign in" option in the admin area.

**Routes (my call)**
- `/admin/fixes`: the list of Data Fixes. For each fix, show its title and progress: counts by
  status, counts by confidence, and how many need a recheck.
- `/admin/fixes/:fixId`: the review queue.

**Queue filters.** All are combinable, and they persist in the URL so the client can bookmark a
work batch.
- Confidence: none / low / med / high.
- Status: by default, everything not yet reviewed, plus anything marked "Needs recheck".
- Collection.
- Free text over the description.

**Review card: one record at a time.**
- **The photo, as large as fits, using the full-size image** (not the 320px mobile thumbnail),
  with click or scroll to zoom. The client reads numbers off cab sides.
  - Builder: confirm which Storage path holds the full-size `webp`. `VITE_IMAGES_BASE_URL` points
    at `picaloco/images`, and `getThumbnailUrl()` normalises whitespace in `image_no`.
- **Details:** `image_no`, the description with any extracted matches highlighted, collection, date.
- **The current value(s):** editable, one per line or as chips, with the suggestion and its
  confidence shown beside them.
- **Actions, each with a keyboard shortcut (my call on the keys):**

| Action | Key | Meaning |
|---|---|---|
| Confirm | `Enter` | The suggestion is right. Status becomes verified. |
| Edit | `E` | Change the value(s). Status becomes corrected. |
| Not visible | `N` | There's a loco, but no readable number or name. |
| No loco | `X` | There's no loco in the photo. |
| Next (skip) | `S` / `→` | Move on without saving anything. (See §13 for the current keys and layout.) |
| Back | `←` | Return to the previous record. |

- After an action, the next record loads at once. Prefetch the next few records and their photos.
- **Format instructions:** a side panel shows `data_fix.instructions`. Values that break the
  format rules get a soft warning, never a block (anti-goal).

**Bulk confirm for high confidence.** A grid of about 24 photos, each with its suggested value
overlaid. The client unticks any that look wrong, then confirms the rest in one action. The
unticked ones stay in the queue for single review.

**Mobile.** The queue must be usable on a tablet. The phone layout can be basic.

## 8. Public search

- **The Loco number filter switches to the new field.** It does a whole-token match on
  `loco_numbers_text`, using the same regex as the current stopgap.
- **Fallback.** For photos where the field is empty and the status is `extracted`, it falls back
  to today's description search. Photos marked `none_visible` or `no_loco` don't fall back.
- **A new Loco name filter**, a text input matching `loco_names_text` (`ilike`, words in any
  order is fine).
  - My call: add it to the default filters, since the client asked for it.
  - Bump the visible-filters storage key (`picaloco.visibleFilters.v1`, to v2), or merge the new
    default in, so existing visitors see it too.
- **The photo detail page** shows Loco number(s) and Loco name(s).
- **Confidence is not shown to the public** (my call). Unreviewed values look the same as
  reviewed ones.
- The public launch (the link from ratrust.org's menu) waits until the client is happy with the
  data. That's the client's decision, not a build step.

## 9. Order of work (suggested)

1. Fix the extraction parser. Re-run the number dry run and do the name dry run. Share both sets
   of figures.
2. Write the DDL: tables, trigger, RLS, the view change and the bootstrap/DEVOPS updates. Hand it
   to the user to run on `oci`.
3. Write the extractor with `--apply`, plus the preservation test (§5). Run it live, and hook it
   into `run_incremental_sync.py`.
4. Switch the public search, add the Loco name filter and show both fields on the photo detail
   page. Values become searchable straight away.
5. Build the admin login and Data Fixes list, then the review queue, then bulk confirm.
6. Do one end-to-end check with the client on a small batch, and tune shortcuts and speed from
   their feedback.

## 10. Open questions for the client

1. **Trams, cars, railcars, units, wagons.** About 5,600 high-confidence records are these, e.g.
   `Car number 19`. Do they count as "loco numbers"? Until they decide, the extractor includes
   them.
2. **Format instructions.** These are pending from the client. They get pasted into
   `data_fix.instructions`, and the soft warnings get derived from them.
3. **Who gets admin logins**, besides the client.

## 11. Calls made in this document (please check)

- Separate `data_fix_*` tables keyed on `image_no`, with no FK to `rat.catalog`.
- A generic registry, so later fixes reuse the same screens and tables.
- Two "nothing" statuses: `none_visible` and `no_loco`.
- Skip saves nothing.
- The extractor is a Python script in `filemaker_sync`, run after each incremental sync.
- Only the Data Fixes area needs a login. Migration status stays public.
- The keyboard shortcuts listed in §7, and bulk confirm for high-confidence records.
- Loco name is added to the default public filters.
- No confidence badges in public search.
- The "high must be right at least 98% of the time" bar for the first apply.

## 12. Amendment, 2026-11-15: number and name on one card; photo size

Asked for by the user after the signed-in checks, before anything was merged. The volunteers are
elderly or retired, so the photos must be easy to see, and a volunteer fixing one field should be
able to fix the other while the photo is in front of them.

### 12.1 The other fix on the same card (user's decision: editable, saved only if changed)

- The review card for one fix also shows every other fix for the same photo (today: the number
  card shows Loco name, the name card shows Loco number), below the main box, headed "Also on this
  photo: <title>". Each has its own box, status, and suggestion or current review, laid out like
  the main one.
- Its box starts from the same baseline as the main box (`editBaseline`).
- **It is saved only if the volunteer changes it.** An untouched box saves nothing, so nobody
  confirms a name by accident while checking numbers.
- An edited box is saved together with the next action on the card that saves: Confirm or Keep
  current, Use suggestion, Save edit, Not visible, No loco. Its status follows the usual rule:
  verified if the values are exactly its suggestion, otherwise corrected.
- An edited box left empty is saved as that fix's "not visible" status (e.g. "No name visible"),
  and the card says so under the box before saving. (My call.)
- The other fix is saved first, with its own optimistic lock. If that save fails (stale, signed
  out, error), the main save does not happen, the card stays put, and the notice names the field.
- Skip and Back never save. An edit in the other box is kept as a draft, exactly like the main
  box's drafts, and is there again on return. Esc in that box discards it.
- Keys: Ctrl+Enter in the other box is Save edit if the main box is edited, otherwise Confirm.
  No new single-letter shortcut (my call: the second box is reached with the mouse or Tab).
- The grid (bulk confirm) does not show the other fix.
- Added after the final review (2026-11-15):
  - Whenever the other box holds an edit, a line beside the action buttons says what will also be
    saved ("Also saves: Loco name → Dolly").
  - An edit carried in from an earlier visit (the same photo's draft, typed on the other fix's own
    queue and skipped) is never saved by the first save action on this card: that press shows the
    edit, scrolls to it and saves nothing; the next save action saves it.
  - Ctrl+Enter in the other box never "keeps" a main record that needs a recheck: the card asks the
    volunteer to choose Keep current or Use suggestion for it, and saves nothing.
  - The other box shows "Needs recheck" and "New suggestion" like the main one, and has a Discard
    button.
- A save from the other box counts towards that fix's progress, and its record leaves that fix's
  "not reviewed" queue like any other review.

### 12.2 Photo size (user's decision: size buttons plus browser zoom)

- A "Photo size: Normal / Large / Extra large" control on the review queue page, for both single
  review and the grid. Large buttons, with the current choice clearly marked. It is remembered in
  that browser (`localStorage`, falling back to Normal).
- Grid columns, narrow / medium / wide screen: Normal 2 / 3 / 6 (as today), Large 1 / 2 / 4,
  Extra large 1 / 2 / 3. The number label on each tile grows with the size.
- The queue page may be wider than today's 72rem, so a large window shows bigger photos.
- The single-review photo gets taller with the size.
- Browser zoom (Ctrl +) keeps working; the layout breakpoints respond to it.

### 12.3 Correction to §7: there is no full-size image

§7 asked for "the full-size image, not the 320px mobile thumbnail". Measured on 2026-11-15, the
FileMaker export's own originals (`exports/images/jpg` and `webp`) are only about 376px wide
(median; 90% at or below 389px). Serving them would gain about 17% width for 2.5x the bytes, so
the review screens keep the 320px thumbnails. Larger photo sizes will look soft. Sharper photos
need new high-resolution scans from RAT (a client question).

## 13. Amendment, 2026-11-15 (later): select, then Save & next; answer panel; no scrolling

Asked for by the user after reviewing the finished card on a 2560x1440 screen. The model is the one
image-labelling tools use: the photo on the left, the answers on the right, choose the labels, then
one key saves and moves on. This replaces parts of §7's key table and §12.1, as noted.

### 13.1 Answers are selected, then saved together (user's decisions)

- **No loco in photo (X) and Not visible (N) select, they don't save.** The button lights up (tick,
  outline) and pressing it again switches it off. Nothing is saved until Save & next. (User: "Select,
  save on Enter".)
- **No loco in photo covers the whole photo:** saving it sets every field (number and name) to
  `no_loco`. (User: "Yes, both fields".)
- Not visible is per field: one toggle per field, N for the queue's own field, the other field's
  toggle by mouse only.
- Selecting N on a field that shows No loco switches No loco off. Typing in a box switches off that
  field's toggles (and No loco): there is something to read.
- A photo that is already saved shows its saved answer lit (from its `status`) until the volunteer
  changes it. A typed, unsaved edit beats a saved mark.
- Back and Next forget unsaved selections; the photo shows its saved answer again on return. Typed
  edits are still kept as drafts (§12.1).
- **Save & next** (button, Enter; Ctrl+Enter inside a box) saves every field on the card and moves to
  the next photo. It replaces Confirm, Keep current, Save edit, and the separate Edit button. Enter
  with an edited box saves the edit: the card shows exactly what will be saved, so the old "you edited
  — press Ctrl+Enter" guard is gone.
  - The queue's own field is always saved: a selected mark, else a typed edit, else the open record's
    values or suggestion, else the reviewed record as it is ("Keeps"). Nothing in the box and nothing
    selected: nothing is saved and the card says so.
  - The other field is saved only if the volunteer changed it on this card: typed in it, or selected
    a mark it doesn't already have. Switching a saved mark off without typing anything saves nothing
    for that field, so no answer is invented. (My call.)
  - A "Saves:" list above the button names each field and what it will be saved as.
- Use suggestion (U) now puts the new suggestion in the box; Save & next saves it.
- Unchanged: the other field saves first with its own lock; a carried-in edit pauses the first press;
  Ctrl+Enter from the other box never silently keeps a main record that needs a recheck; a held key
  doesn't repeat a save or a toggle.
- While the other field hasn't loaded, a save that would change it (a carried edit, or No loco)
  waits with a notice.

### 13.2 Layout (user's decisions)

- Right-hand **answer panel** where the instructions were: "Whole photo: No loco in photo", "Can't
  read it: No number visible / No name visible", Use new suggestion when offered, notices, the
  "Saves:" list and a large **Save & next** button. Sticky beside the photo on wide screens.
- The instructions moved behind a **Help** button beside Photo size: format instructions, how it
  works, and the keyboard list. Review keys are ignored while Help is open.
- **Back and Next sit directly beneath the photo**, with "Back and Next don't save" between them.
- Below them: one line of details (image, collection, date, CD), the description, then the number and
  name boxes side by side on wider screens, each headed by the field name in bold.
- "Will be saved as: …" appears over a box whose field has a mark selected, so selecting never moves
  the page.

### 13.3 No scrolling at Normal size

- At Normal photo size the whole card fits the window: the photo's height is the window height less
  the rest of the page (about 44rem), between 14rem and 48rem. Large and Extra large give the photo
  more room and may need a short scroll. Checked with no scroll at 1440x900, 1920x970 and 2560x1300
  windows; a 1366x700 window scrolls a little once the photo reaches its minimum.
- The page header is one row (title, Data fixes link, Grid, Photo size, Help); the "Migration status"
  footer link is hidden on the review pages.
- On the Data Fixes pages the whole page scales with the window width: 16px text up to a 1440px-wide
  window, rising to 20px at 2560px (rem-based, on top of the browser's own text size and zoom).
