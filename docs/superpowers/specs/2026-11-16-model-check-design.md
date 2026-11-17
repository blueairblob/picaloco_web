# Model Check: volunteers check an AI model's answers — design

Status: draft for the user's approval, 2026-11-16. Approach chosen by the user: **B (a general
model-check layer) with C's link to Data Fixes**. Built for RAT first; every place RAT departs from the
general design is listed in §10. Builder check done; the user's answers to its three questions are in
§4, §6 and §7, and the assistant's own calls are marked "(assistant's call)".

## 1. Intent

A model looks at every photo and proposes an answer to one question. Volunteers check those answers one
photo at a time, on a screen built from the Data Fixes review screen: agree with one key press, or pick
the right answer. The user's words: "the user can truth the model", and "this feature of using AI to
clean up a client's data is core to a commercial service".

The saved answers do three jobs:

1. **Clean-up.** Each checked answer is a fact about the photo. For RAT, a checked "no loco" answer also
   fills in Data Fixes (§7), which volunteers would otherwise do by hand.
2. **Measurement.** Each model run gets an honest accuracy figure: the number a client would be shown.
3. **Training.** Checked answers are labelled examples for training a better model (separate project,
   §11), whose answers come back as a new run and are measured the same way.

## 2. Goals, non-goals, anti-goals

Goals:
- One general page that works for any question with a fixed answer list, any model run, any client.
- Fast checking: the model's answer is pre-selected, Enter agrees, one number key picks another answer
  (except in the random sample, where it is hidden — §6).
- Several model runs side by side; each measured against the same checked answers.
- RAT's first question, "What's the main subject?", live end to end.

Non-goals (this design):
- Training the improved model (§11, separate).
- Free-text questions (reading numbers or names). Data Fixes already does those.
- Showing model answers on the public search site.
- Running the model from the web app. Models run offline on the GPU machine.

Anti-goals (a failure even if it works):
- Any model answer, or any checked answer, silently changing a reviewed Data Fixes value.
- An accuracy figure that flatters the model (§6).
- A volunteer losing a saved answer: answers are never overwritten or deleted.
- Review keys firing while a menu or dialog is open (the user menu already guards this).

## 3. The first question: subject type (RAT)

"What's the main subject?" One answer per photo. The user's call: a photograph always has a main
subject. "Is a loco present?" is not asked; it follows from the subject type.

| Key | Answer | Means a loco is present (RAT) |
|---|---|---|
| 1 | Steam loco | yes |
| 2 | Diesel loco | yes |
| 3 | Electric loco | yes |
| 4 | Railcar / unit | yes |
| 5 | Tram | yes (RAT records tram fleet numbers) |
| 6 | Bus / lorry | no |
| 7 | Wagons / coaches only | no |
| 8 | Ship | no |
| 9 | Station / building / track | no |
| 0 | Other | no |

The list lives in one task file, `filemaker_sync/scripts/model_tasks/rat_subject_type.json`. It holds
the question, each answer's key, id, label, the `loco` flag and the model's text prompts. The scoring
script reads it, and the loader copies it into the database, so the page and the model always agree.

## 4. Data (new tables in `rat`, applied by the user — DDL is never run by the assistant)

- **`rat.model_task`** — `id` (e.g. `subject_type`), `question`, `answers jsonb` (ordered list: key, id,
  label, flags such as `loco`), `sure_threshold real` (default 0.9), `links jsonb` (the Data Fixes link
  settings, §7; null = no link), `sort_order`.
- **`rat.model_run`** — `id`, `task_id`, `model` (e.g. `ViT-SO400M-14-SigLIP-384/webli`), `version`
  label, `notes`, `created_at`, `n_predictions`, and `answers jsonb`: a frozen copy of the task's answer
  list as it was when the run was scored, so `probs` can always be read in the right order.
- **`rat.model_prediction`** — `(run_id, image_no)` key, `answer` (answer id), `p real` (its
  probability), `probs real[]` (all answers, in task order). ~141k rows per run.
- **`rat.model_answer`** — append-only. `id`, `task_id`, `image_no`, `answer`, `shown_run_id`,
  `shown_answer` (what the volunteer was shown, null when hidden — §6), `mode` (`sure` / `unsure` /
  `sample`), `answered_by`, `answered_at`. The current answer for a photo is its latest row. Correcting
  an answer adds a row; no UPDATE or DELETE is allowed (trigger), mirroring Data Fixes' protection.

Access: RLS on, admin-only through SECURITY DEFINER RPCs with an empty `search_path`, the same pattern
as `rat.review_fix_value`:
- `rat.model_check_queue(task, run, mode, answer filter, collection, after, limit)` — photos with their
  description, the run's prediction, and the photo's current checked answer if any.
- `rat.save_model_answer(task, image_no, answer, shown_run, shown_answer, mode)` — inserts the answer,
  applies the Data Fixes link (§7) in the same transaction, returns what it changed.
- `rat.model_check_progress()` — per task and run: photos predicted, checked, agreement overall and in
  the random sample, and per-answer counts (a confusion table: model answer × checked answer).

Changing the answer list (assistant's call): once any `model_answer` row exists for a task, answers may
be added but never removed, renamed (id) or re-keyed. The loader compares the task file with the stored
task and refuses an incompatible change with a message naming the answer; labels and prompts may change
freely. A genuinely different list is a new task id.

`rat.data_fix_history.source` CHECK gains a third value, `model_check` (signed off by the user under
Golden Rule 7, 2026-11-16): history rows written by the §7 link carry it, so a volunteer's own No loco
can always be told apart from one filled in by a subject answer. Widening the CHECK touches no existing
row.

DDL goes in a new `filemaker_sync/supabase/schema/add_model_check_tables.sql`, idempotent, folded into
`bootstrap_rat_schema.sql`, tested on a throwaway Docker `postgres:17` (the existing
`tests/test_data_fix_schema.py` pattern), never against the live DB.

## 5. Getting model results in

- `filemaker_sync/scripts/model_score.py` (exists): scores the local thumbnails against a task file and
  writes a CSV (`image_no, answer, p, p_<answer>…`), plus the image embeddings for training later.
  Runs on the Windows GPU machine. First full run, 2026-11-16: 141,113 photos in 99 minutes, 0
  unreadable, 76,196 at p ≥ 0.9; `exports/ai_pilot/subject_scores.csv` and `emb_siglip_so400m.npy` —
  this is the run the first load uses.
- New `filemaker_sync/scripts/load_model_run.py --task <file> --scores <csv> --model <name> --version
  <label> --target-profile oci`: upserts `model_task` from the task file, creates a `model_run`, bulk
  loads the predictions (COPY). Writes only to the model-check tables. Dry run by default, `--apply` to
  write, like the loco extractor. Photos without a `rat.catalog` row are skipped and counted.
- A new model version is a new run; old runs stay.

## 6. Measuring honestly

- **Three queue modes**, chosen on the queue page:
  - **Sure** (model p ≥ the task's `sure_threshold`): fast clean-up, Enter, Enter, Enter.
  - **Unsure** (p below it): where volunteers teach the model most.
  - **Random sample**: photos in a fixed pseudo-random order (hash of image_no), regardless of the
    model's confidence. **The model's answer is hidden and nothing is pre-selected** (user's call): the
    volunteer must press 1–0. Saved with `shown_run_id` and `shown_answer` null.
- **Accuracy** for a run is computed only from blind answers (`mode = 'sample'` and `shown_answer` is
  null), and those same answers score **every** run of the task, so each new model is measured against
  the same checked photos. A photo answered blind more than once uses its latest blind answer.
- The volunteer is not told which mode a photo came from beyond the queue they chose.
- Agreement in Sure mode is reported too, but labelled as "agreement on confident answers", not
  accuracy.
  (decided at build, 2026-11-16; approved by the user 2026-11-17) Agreement is reported over each photo's latest answer in any mode,
  labelled "Agreement" (distinct from "Accuracy (blind sample)").
- Every saved answer records what was shown, so a later run can be scored against answers given while
  looking at another run's suggestion, and that bias can be accounted for.

## 7. The link to Data Fixes (RAT; option C)

Configured per task in `model_task.links`; for `subject_type`:
`{"no_answer_flag": "loco", "fix_ids": ["loco_number", "loco_name"]}`.

A "not a loco" main subject does not mean no loco is in the photo. Checked on the first run: of the
20,553 photos the model answered "not a loco", 8,086 have a description naming a loco number or name;
in a sample of "Station" answers the scene was rightly the main subject, but the named loco was there
too (small, distant, through a window). So (user's call):

When a saved answer has `loco = false` (Bus/lorry, Wagons/coaches, Ship, Station/building/track,
Other):
- **Fill** only if every listed field is still `extracted` **and** its extractor confidence is `none`
  (the description named no number or name). Then each is saved as `no_loco` inside
  `rat.save_model_answer`, through the same review-context path `rat.review_fix_value` uses (reviewer,
  time, history row with source `model_check`). The answer panel shows this before saving: "Also saves:
  Loco number — No loco, Loco name — No loco".
- **Otherwise change nothing** and record a conflict: if any listed field has a description-derived
  value (confidence `low`/`med`/`high`) or was already reviewed with a value. The panel says so before
  saving ("Description names 6853 — Loco number not changed") and the photo is listed on the progress
  page as a conflict to look at, linking to its Data Fixes review.
  (decided at build, 2026-11-16; approved by the user 2026-11-17) A photo is listed only while it needs a person: a not-a-loco answer
  while a listed field is still `extracted` with confidence other than `none`; or a loco answer while a
  field is saved `no_loco`. A not-a-loco photo whose field was reviewed with a value is consistent (a loco
  is present, just not the main subject): the panel says "not changed" but the photo is not listed.
- A field already reviewed by a volunteer is **never changed**, whatever its value.
- Filling is all or nothing per photo (assistant's call): both fields, or neither.

When a saved answer has `loco = true` and a Data Fixes field is saved as `no_loco`, the same conflict
note and listing apply. Nothing is changed automatically in that direction.

## 8. The page

- **Menu → "Model check"** (admins) → `/admin/model-check`: one card per task with the latest run's
  progress, accuracy from the random sample, conflicts, and a run picker.
- **Queue** `/admin/model-check/:taskId?run=&mode=&answer=&collection=`: the review screen layout reused —
  photo (click to zoom, photo size control, scaled text, no page scroll), Back / Next under the photo,
  meta line and description, and on the right the answer panel:

```
┌──────────── photo ─────────────┐ ┌ What's the main subject? ┐
│                                │ │ Model thinks: Tram (93%) │  (hidden in random sample)
│                                │ │ ● [5] Tram               │
└────────────────────────────────┘ │   [1] Steam loco …        │
   ◀ Back        Next ▶            │ Also saves: …            │
 description…                      │ [ Save & next ]  (Enter) │
                                   └──────────────────────────┘
```

- The model's answer is pre-selected; Enter saves it (agree). 1–9, 0 select another answer; Enter saves.
  In random sample mode no answer is pre-selected and the "Model thinks" line is not shown; Enter does
  nothing until an answer is picked.
  → / S skip, ← back, as on Data Fixes. Help button lists the keys.
- A photo already checked shows the saved answer selected and "Checked by … on …"; saving again adds a
  correcting answer.
  (decided at build, 2026-11-16; approved by the user 2026-11-17) Photos already answered are not offered again by the queue, and
  "Checked by … on …" shows only for photos answered in the current session (reached with Back).
  Correcting an earlier session's answer is not offered yet.
- Saves follow Data Fixes' rules: one at a time, a failed save keeps the photo on screen with the error.

## 9. Constraints

- Golden Rule 7 holds: reviewed `rat.data_fix_value` rows are never changed by this feature; the link
  only fills `extracted` rows with confidence `none`, through the guarded review path. The only change
  to the Data Fixes tables' definitions is the signed-off `model_check` history source (§4). Run
  `scripts/data_fix_preservation_check.py` before and after the load step only. After live use the
  checksum will change (each fill adds a reviewed `no_loco` row); verify instead that no model-check fill
  touched a reviewed value: `select count(*) from rat.data_fix_history where source = 'model_check' and
  (old_status is distinct from 'extracted' or new_status <> 'no_loco');` must be 0.
- DDL, grants and RPCs are handed to the user to apply on `oci`.
- No photo is sent to an outside service; models run on the client's machine.
- Tests never touch the live DB. Web saves are tested with stubbed RPC routes.
- Volunteers are elderly: large targets, scaled text, keyboard-first, no scrolling (as Data Fixes).

## 10. Where RAT departs from the general design

1. Tables live in the `rat` schema, not a per-client schema or tenant.
2. Photos are keyed by `image_no` (RAT's archive id), not a generic item id.
3. The answer list and its `loco` flag are RAT's (§3).
4. The Data Fixes link (§7) is RAT-specific and switched on per task.
5. The model runs on the client's own machine against 320px thumbnails.

## 11. Next, separately: the improved model

Train a small classifier on the saved embeddings (`exports/ai_pilot/emb_siglip_so400m.npy`), using
volunteers' checked answers plus labels drawn from the 91k high-confidence descriptions; load its
answers as a new run; the progress page shows whether it beats the first run. Designed after this page
exists, because the checked answers are its best training data.

## 12. Approaches considered

- **A. Reuse the Data Fixes tables** (model answer as a new data fix): least code, but mixes machine
  guesses into the irreplaceable review table and can't hold or compare several runs.
- **B. A general model-check layer** (chosen): clean separation, several runs, honest measurement,
  training data. Costs new tables, RPCs and a page.
- **C. B plus a link to Data Fixes** (chosen as part of B): saves volunteers answering the same photo
  twice; RAT-specific, switched on per task.

## 13. Left to the builder

- Whether to extract the photo + navigation part of `ReviewCard` into a shared component or build the
  model-check card beside it; extract if it separates cleanly.
- Index choices, batch size for the loader's COPY, the exact pseudo-random ordering function.
- Copy wording beyond the strings given here.
