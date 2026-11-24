# DevOps / Rebuild Manual

A from-scratch guide to this system, written so a developer with no prior context could rebuild
and redeploy every piece of it. Read section 1 first for the map, then jump to whichever section
matches what you're actually trying to do.

This document deliberately contains **no secrets** (passwords, API tokens, private keys, or private
IP addresses) — this repo is public. Every step below says *where* to get a credential, never what
it is.

---

## 1. System map

Two things have to work together for `picaloco_web` to function. Neither lives in this repo.

```
┌─────────────────────┐     ┌────────────────────────────────┐
│ picaloco_web (this  │     │  Self-hosted Supabase           │
│ repo) — static site │───> │  ("oci"), schema 'rat' + Storage│
│ on Vercel           │     │  — metadata, search, AND images │
└─────────────────────┘     └────────────────────────────────┘
                                        ▲
                                        │ populated by
                             ┌──────────────────────────┐
                             │  filemaker_sync (sibling │
                             │  repo) — the migration   │
                             │  pipeline, FileMaker→rat │
                             └──────────────────────────┘
```

- **`picaloco_web`** (this repo): a static Vite/React SPA. No backend of its own — every data
  fetch goes straight from the browser to Supabase's REST API (PostgREST) via `@supabase/supabase-js`.
- **The "oci" Supabase instance**: self-hosted (Docker Compose, the standard Supabase self-host
  stack — Postgres, PostgREST, Storage, Studio, etc.), reachable only over Tailscale by hostname,
  made public via **Tailscale Funnel**. Holds the `rat` schema, which `filemaker_sync` populates
  from the RAT charity's FileMaker Pro archive (~141k photo records, growing) — the single,
  current source for both search/metadata **and** images. As of 2026-09-07 this hosts **141,197 of
  the ~141,244 catalog rows' real photos (99.97% coverage)** — uploaded directly from the actual
  local FileMaker export folder (not the small, partial old Supabase.com cloud project first assumed
  to be the source — that project is no longer used at all) via `filemaker_sync`'s
  `upload_images_oci.py` (parallelized; GUI: "Upload Images"). A known ~46-file gap exists — `image_no`
  values containing characters Supabase Storage rejects as invalid object keys — see
  `filemaker_sync/devlog/worksheet.md` Session 16 for the full story (Session 15's own entry describes
  an earlier, wrong, much-smaller figure — superseded, not fixed, kept for history).
- **`filemaker_sync`** (sibling repo, public): the migration pipeline. Not part of this app's
  runtime at all — it's what keeps `oci`'s `rat` schema and Storage populated and current. See its
  own `CLAUDE.md` and `devlog/worksheet.md` for that side of the system.

**If you only need to redeploy the web app** (backend already exists and is healthy): skip to
§4 (scaffold) is not needed — just clone this repo and go to §6 (deploy).

**If the `oci` backend itself is gone and needs rebuilding**: you need `filemaker_sync` re-run
first (that's a separate, larger process — see that repo), then §3 below to recreate this app's
view/grants/public exposure on top of it.

---

## 2. Prerequisites

- Node.js 18+ and npm (this was built against Node 22).
- A GitHub account with push access to `picaloco_web` (or fork it).
- A Vercel account, linked to that GitHub account.
- For §3 (backend rebuild only): SSH/console access to the `oci` host, and a Postgres connection
  string for it (host/port/user — see `filemaker_sync/config.toml`'s `[database.target.oci]`
  block; the password is in that repo's untracked `.env`, ask its owner) — arranged separately,
  not needed for a routine app redeploy.

---

## 3. Backend dependencies (only needed if rebuilding `oci` from scratch)

Skip this whole section if `oci`'s `rat.mobile_catalog_view` already exists, Funnel is already
live, and `anon`'s grants are already scoped. Check quickly:

```bash
curl -s 'https://huey.taila2eeb2.ts.net/rest/v1/mobile_catalog_view?select=image_no&limit=1' \
  -H "apikey: <anon key>" -H "Accept-Profile: rat"
```

A JSON row back means it's already working — move on to §4/§6. If you get a 404/PGRST error or
the request times out, rebuild as follows.

### 3.1 Recreate the view

The view's single source of truth is SQL in the sibling `filemaker_sync` repo. Do not copy it
here; it drifts. Run one of these against the `oci` Postgres instance (psql, or Supabase Studio's
SQL editor at `http://<oci-host>:3000` if you have Tailscale access). Both are idempotent.

- **Fresh host:** `filemaker_sync/supabase/schema/bootstrap_rat_schema.sql`. It creates every
  `rat` table, the Data Fixes tables, the view and the grants below.
- **Existing host missing only the Data Fixes part:**
  `filemaker_sync/supabase/schema/add_data_fix_tables.sql`. It runs as one transaction.

On huey, after copying the file to `/tmp/`:

```bash
cd /home/huey/supabase && docker compose exec -T db psql -U postgres -d postgres \
  -v ON_ERROR_STOP=1 < /tmp/add_data_fix_tables.sql
```

The view has 37 columns. The last four (added 2026-11-14) come from `rat.data_fix_value`, the
client-reviewed "Data Fixes":

| Column | Type | Meaning |
|---|---|---|
| `loco_numbers` / `loco_names` | `text[]` | Extracted or reviewed values; `{}` when there are none |
| `loco_numbers_text` / `loco_names_text` | `text` | Values joined with `; ` for search. `NULL` = no row yet, or an unreviewed empty extraction; `''` = reviewed as "none visible" / "no loco" |

After a fresh install, fill the Data Fixes tables from the descriptions:
`venv/bin/python scripts/extract_loco_fields.py --apply --target-profile oci` (in
`filemaker_sync`). It never overwrites a reviewed value.

Note: `thumbnail_url` in the view is a dead placeholder (`cdn.example.com`). The app doesn't use
it; it builds real image URLs itself from `VITE_IMAGES_BASE_URL` (§5).

### 3.2 Scope `anon`'s access

By default, a fresh Supabase Postgres role setup often grants `anon` `SELECT` on every table in an
exposed schema. **This is not safe once the schema is public** — `rat.catalog` has `valuation` and
`owners_ref` columns that must never be exposed. Lock it down to exactly what this app needs:

```sql
GRANT SELECT ON rat.mobile_catalog_view TO anon;
GRANT SELECT ON rat.photographer, rat.location, rat.organisation,
                rat.collection, rat.country, rat.route, rat.builder TO anon;
REVOKE ALL ON rat.catalog, rat.catalog_metadata, rat.catalog_builder,
              rat.usage, rat.picture_metadata FROM anon, authenticated;
```

`authenticated` is revoked too: since the Data Fixes admin sign-in (2026-11-14), signed-in
sessions are real, and live `oci`'s default ACL on schema `rat` had granted `authenticated`
`SELECT` on these tables. Signed-in users get only `SELECT` on `rat.data_fix`,
`rat.data_fix_value` and `rat.data_fix_history` (RLS: admins listed in `rat.admin_user` only), and
`EXECUTE` on the review RPCs. `anon` gets nothing on the Data Fixes tables; the public sees the
values only through the view. All of this is in the two SQL files from §3.1. Also keep Auth
sign-up off (`DISABLE_SIGNUP=true` in the Supabase docker `.env`); admins are created by hand.

Verify:

```sql
SELECT table_name FROM information_schema.role_table_grants
WHERE grantee = 'anon' AND table_schema = 'rat' ORDER BY 1;
-- Expect exactly: builder, collection, country, location, mobile_catalog_view,
--                 organisation, photographer, route

SELECT has_table_privilege('authenticated', 'rat.catalog', 'SELECT');
-- Expect: f
```

### 3.3 Make it public (Tailscale Funnel)

The `oci` host is Tailscale-only by default. To expose its Supabase REST API to the open internet:

1. A tailnet admin enables Funnel once, tailnet-wide, at `https://login.tailscale.com/f/funnel`
   (the CLI prints this exact URL and refuses to proceed until it's done).
2. On the `oci` host itself (SSH in), find the port Supabase's gateway (Kong/Envoy) is bound to —
   check `docker ps`, look for the container publishing something like `<tailscale-ip>:8000->8000`.
3. Run:
   ```bash
   tailscale funnel --bg http://<that-tailscale-ip>:8000
   ```
   This must target the machine's own Tailscale IP (not `127.0.0.1`) if the container is bound
   specifically to that interface rather than loopback — check with `curl` against both before
   assuming which one works.
4. Verify from **outside** the tailnet (a request from your own machine on the tailnet isn't a
   real test — it may route privately and never touch Funnel at all):
   ```bash
   curl -I https://<oci-host>.<tailnet-name>.ts.net/rest/v1/mobile_catalog_view
   ```
   Any real HTTP response (even a `401`) confirms it's genuinely public. A hang/connection
   failure means Funnel isn't actually live yet.
5. **Turn off key expiry for the `oci` host** (and for the loader PC): Tailscale admin console,
   Machines, the host's `⋯` menu, **Disable key expiry**. By default a machine's key expires after
   180 days; the host then drops off the tailnet and Funnel stops, so the whole site loses its
   data and photos at once. This happened on 2026-11-22 (`tailscale ping huey` answered
   `peer's node key has expired`). If a key has already expired: disable expiry, and if the host
   still shows expired, `⋯` then **Temporarily extend key**, then on the host run
   `sudo tailscale up --force-reauth` and open the link it prints.

**Note:** in this project's Claude Code sessions, both the `REVOKE`/`GRANT` SQL and the
`tailscale funnel` command get blocked by the coding agent's own safety classifier when attempted
directly (schema/permission changes and network-exposure changes are treated as needing a human's
hands on the keyboard) — a human always ran these two steps manually. Expect the same if you're
using an AI agent to help rebuild this.

---

## 4. Scaffolding the web app from scratch

If this repo is gone and you're starting over:

```bash
npm create vite@latest picaloco_web -- --template react-ts
cd picaloco_web
npm install @supabase/supabase-js @tanstack/react-query react-router-dom
npm install -D tailwindcss @tailwindcss/vite
```

Then, at minimum:
- `vite.config.ts`: add the `@tailwindcss/vite` plugin and a `@` → `./src` path alias.
- `tsconfig.app.json`: add the matching `"paths": { "@/*": ["./src/*"] }` (no `baseUrl` — deprecated
  in modern TypeScript).
- `src/index.css`: `@import "tailwindcss";` plus CSS custom properties for the light/dark palette
  (see the committed file for the exact three-state pattern: default `:root`, a
  `prefers-color-scheme: dark` media query guarded by `:not([data-theme="light"])`, and explicit
  `[data-theme="dark"]`/`[data-theme="light"]` overrides so a manual toggle always wins).

Rather than re-deriving the rest from scratch, the simplest path is: clone the actual repo
(`git clone https://github.com/blueairblob/picaloco_web`) and treat the above as a description of
what's already there, not a blank-slate exercise. The real value in rebuilding "from scratch" is
almost always about §3 (backend) and §6 (deploy), not re-typing the frontend.

---

## 5. Environment variables

Copy `.env.example` to `.env.local` and fill in:

| Variable | What it is | Where to get it |
|---|---|---|
| `VITE_SUPABASE_URL` | The public `oci` Funnel URL | `https://<oci-host>.<tailnet-name>.ts.net` — ask the `oci` owner for the exact hostname if unknown |
| `VITE_SUPABASE_ANON_KEY` | The `oci` project's anon (public) JWT | Supabase Studio → Settings → API, on the `oci` instance. This key is meant to be public — it ships in the browser bundle either way — but scope its grants per §3.2, not this key's secrecy, as the real security boundary |
| `VITE_IMAGES_BASE_URL` | Public Storage URL prefix for images | `https://<oci-host>.<tailnet-name>.ts.net/storage/v1/object/public/picaloco/images` — same `oci` instance as `VITE_SUPABASE_URL` now (migrated from a separate cloud project 2026-09-06, see §1) |

None of these are secret in the traditional sense (all three are embedded in the public JS bundle
of a deployed site). `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are also read at run time by
`api/health.ts` (the uptime health page), so they must be set for Vercel's Production
environment, not only at build time. Keep them in `.env.local` (gitignored) rather than committed,
as normal hygiene and to make rotation easy.

**Two more, genuinely secret this time, for `api/agent-auth.ts`** (§11) — set these directly in
Vercel, never in a committed `.env*` file, and never with the `VITE_` prefix (that prefix means
Vite inlines the value into the browser bundle, which is exactly what must not happen here):

| Variable | What it is |
|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | `oci`'s `service_role` key — full RLS-bypass access. Supabase Studio → Settings → API, on the `oci` instance. |
| `AGENT_DB_PASSWORD` | The `picaloco_agent` Postgres role's real password (see `filemaker_sync/create_agent_role.sql`) |

---

## 6. Deploying

### 6.1 GitHub

```bash
git init && git add -A && git commit -m "..."
gh repo create <org>/picaloco_web --public --source=. --remote=origin
git push -u origin main
```

### 6.2 Vercel

```bash
npx vercel login          # or use a token: npx vercel <cmd> --token=<VERCEL_TOKEN>
npx vercel link --yes --project picaloco-web
npx vercel env add VITE_SUPABASE_URL production --value "<url>" --yes
npx vercel env add VITE_SUPABASE_ANON_KEY production --value "<key>" --type config --yes
npx vercel env add VITE_IMAGES_BASE_URL production --value "<url>" --yes
# The next two are real secrets -- do NOT pass --type config (that's what keeps §5's three
# VITE_-prefixed vars deliberately public/readable-after-saving; these must stay actually secret).
npx vercel env add SUPABASE_SERVICE_ROLE_KEY production --value "<service_role key>" --yes
npx vercel env add AGENT_DB_PASSWORD production --value "<picaloco_agent role password>" --yes
npx vercel deploy --prod --yes
```

Notes from experience:
- `vercel env add` for a value that *looks* like a credential (a JWT, for instance) will ask
  interactively whether it should be `secret` (private) or `config` (readable after saving) unless
  you pass `--type config` explicitly. Use `config` for all three of these — they're meant to be
  public.
- `vercel link`'s automatic GitHub connection can fail silently ("Failed to connect ... to project")
  even with a valid repo URL. This means the Vercel GitHub App isn't authorized for that specific
  repo yet. Fix on GitHub: **Settings → Applications → Installed GitHub Apps → Vercel → Configure**,
  and add the repo to its access list (or grant "All repositories"). Then retry with:
  ```bash
  npx vercel git connect --yes --token=<VERCEL_TOKEN>
  ```
  Once connected, every push to `main` auto-deploys to production — no more manual `vercel deploy`.
- **`vercel.json` is required** for a Vite SPA — without it, a direct browser load of any route
  other than `/` (e.g. sharing a link to `/photo/ab0002`) 404s, because Vercel's static file server
  has no file at that path and nothing tells it to fall back to `index.html` for React Router to
  handle. This repo's `vercel.json`:
  ```json
  { "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }
  ```

---

## 7. Ongoing maintenance

- **Normal changes**: just commit and push to `main` — auto-deploys once §6.2's git connection is
  live.
- **Rotating the anon key**: generate a new one in Supabase Studio, update it in Vercel
  (`vercel env rm VITE_SUPABASE_ANON_KEY production` then re-add), and in your local `.env.local`.
  No code change needed.
- **The `rat` schema changed shape** (a new column/table `filemaker_sync` now populates): update
  `rat.mobile_catalog_view` (§3.1) to expose it, then update `src/lib/supabase/types.ts` and
  `src/types/catalog.ts` in this repo to match, plus whichever service/component needs the new
  field.
- **Checking the backend is still healthy**: the one-line `curl` check at the top of §3 is the
  fastest smoke test; it exercises the view, the public grants, and Funnel all at once.

---

## 8. Known issues / deliberately deferred

- **Near-complete photo coverage as of 2026-09-07**: 141,197 of ~141,244 catalog rows have a real
  photo (99.97%). The remaining ~47 render a clean "not yet available" placeholder — 46 are a known,
  quarantined data-quality gap (`image_no` values with characters Supabase Storage rejects as
  invalid object keys), not a bug in this app.
- **`Location`/`Organisation`/`Route` filter dropdowns are capped at ~1,000 options** by
  PostgREST's default row limit, against real counts of ~14,178 / ~1,520 / ~2,874. `Category`,
  `Country`, `Collection`, and `Photographer` are all small enough to be unaffected. Search itself
  still works correctly regardless (it's a live `ilike` query, not limited to the dropdown's
  options) — this only affects browsing those three facets exhaustively via the dropdown UI.
  Deferred rather than fixed immediately; two reasonable fixes if picked up later: raise
  PostgREST's `db-max-rows` setting on the `oci` instance, or replace those three `<select>`s with
  a searchable/paginated combobox that queries on keystroke instead of loading the whole list.
- **No automated test suite.** Verify manually per the smoke-test checklist that was used to build
  this (exact `image_no` search, partial prefix search, free-text search, empty search, pagination,
  one facet filter, direct deep-link to a detail page, simulated backend-unreachable state).

---

## 9. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Blank page, console error about missing env vars | `.env.local` not set up | Copy `.env.example`, fill in real values, restart `npm run dev` |
| Search returns nothing, ever | `mobile_catalog_view` missing or `anon` grants revoked entirely | Run the §3 checks/SQL |
| Search and photos both fail; `/api/health` says `server unreachable` or `no answer within 10000 ms` | `oci` is off the tailnet, most often an expired Tailscale key | `tailscale ping huey`; if it says `node key has expired`, see §3.3 step 5 |
| Images never load, even for known-good `image_no`s | `VITE_IMAGES_BASE_URL` wrong, or `oci`'s Funnel/Storage is down | Confirm the URL directly with `curl` |
| A shared/bookmarked `/photo/...` link 404s but `/` works | Missing `vercel.json` rewrite | See §6.2's last note |
| `vercel env add` hangs or errors on a JWT-looking value | Needs an explicit `--type` | Add `--type config --yes` |
| `vercel link`/`vercel git connect` says "Failed to connect ... to project" | Vercel's GitHub App isn't authorized for this repo | See §6.2's GitHub Apps fix |
| An AI coding agent's direct DB/network commands get silently blocked | Expected — see the note at the end of §3.3 | Have a human run the exact command instead |

---

## 10. Production reliability (on the `oci` host)

Confirmed 2026-09-07, live (a real reboot was performed as the test, not simulated):

- **Reboot resilience: good, no manual steps needed.** All Docker containers already run with
  `restart: unless-stopped`, and both `docker` and `tailscaled` are enabled on boot. A full host
  reboot brought every container back up automatically *and* restored the Tailscale Funnel config
  with zero manual re-run — `tailscale funnel status` showed it active again within ~20 seconds of
  the host coming back, no `tailscale funnel ...` command needed after boot.
- **Postgres shared memory raised to 1GB (2026-11-14).** Docker's default `/dev/shm` of 64MB
  caused intermittent API failures under parallel queries: `could not resize shared memory segment
  "/PostgreSQL.…" to 16777216 bytes: No space left on device` (disk itself was 57% used, 17Gi RAM
  free — not a real space problem). Fixed with `/home/huey/supabase/docker-compose.override.yml`:
  ```yaml
  services:
    db:
      shm_size: 1gb
  ```
  applied via `docker compose up -d db` (~30s DB downtime, data volume untouched). Kept in an
  override file so Supabase upgrades to `docker-compose.yml` don't drop it. **Recreate this file
  on any rebuild of the host.** Verify: `docker inspect -f "{{.HostConfig.ShmSize}}" supabase-db`
  → `1073741824`.
- **Backups: local-only, automated, cron-driven.** `~/bin/rat-backup.sh` on the `oci` host (as user
  `huey`, no root needed — Postgres dumps via `docker exec supabase-db pg_dump -U supabase_admin`,
  which authenticates locally inside the container with no password required; Storage backups via
  `docker exec supabase-storage tar ...` against `/var/lib/storage`):
  - `rat-backup.sh db` — nightly at 02:17, `pg_dump -Fc` of the `rat` + `rat_migration` schemas to
    `~/backups/rat/db/`, rotated to the last 14 days. ~30MB per dump.
  - `rat-backup.sh storage` — weekly (Sunday 03:23, images are static so daily full copies would be
    wasteful) tar+gzip of the whole Storage volume to `~/backups/rat/storage/`, keeps the last 4.
    ~550MB per backup.
  - Both wired via `crontab -l` on that host; `cron` itself confirmed enabled+active.
  - **Off-host copies (2026-11-18/19): the dumps no longer live only on oci's disk.** The DB dumps
    hold the client's Data Fixes reviews and Model check answers (`rat.data_fix*`,
    `rat.model_answer`), which can't be rebuilt from FileMaker. Two copies now leave the host,
    both made by one script on the developer's Windows PC: `ops/rat-backup-pull.sh` in this repo,
    installed as `~/bin/rat-backup-pull.sh` in WSL.
    - **PC copy (plain):** rsync over ssh (`huey` alias) into `D:\backups\rat_oci\db`, kept 60
      days. Each newly fetched file's sha256 is checked against oci's.
    - **Google Drive copy (encrypted):** the last 30 days are encrypted with gpg (AES-256,
      symmetric) and mirrored by Windows `robocopy` to `I:\My Drive\RAT backups` (blueairblob's
      Drive; WSL can't see the Drive mount). Each `.gpg` is decrypted and checked against the
      dump's sha256 before upload. RAT agreed to Drive storage of the encrypted dumps.
    - **Passphrase:** `~/.config/rat-backup/passphrase` in WSL (mode 600), with a copy in the
      developer's KeePass. Without it the Drive copies are unreadable.
    - **Schedule:** Windows Task Scheduler task "RAT backup pull" runs
      `wsl.exe -d Ubuntu -u trevour -- /home/trevour/bin/rat-backup-pull.sh` daily at 09:00 and at
      logon, with "start when available". oci keeps 14 days, so the PC can be off for about 13 days
      without a gap. Log: `D:\backups\rat_oci\pull.log`; a failed run writes a `FAILED:` or
      `CHECKSUM MISMATCH` line and exits non-zero.
    - **Restore a Drive copy:** `gpg --pinentry-mode loopback --passphrase-file
      ~/.config/rat-backup/passphrase -d rat_backup_<date>.dump.gpg > rat_backup_<date>.dump`, then
      `pg_restore` as below.
    - **Verified 2026-11-19:** a file copied back from I: decrypted to exactly the sha256 of oci's
      dump; a second run redid nothing.
    - **Not covered:** the weekly Storage tar (images can be re-exported from FileMaker and the
      local export folder), and the passphrase if both the PC and KeePass are lost (keep the
      `.kdbx` off this PC too).
  - **Restore**: `docker cp <dump> supabase-db:/tmp/restore.dump && docker exec supabase-db
    pg_restore -U supabase_admin -d postgres --clean --if-exists /tmp/restore.dump` for Postgres;
    `docker cp <tar.gz> supabase-storage:/tmp/restore.tar.gz && docker exec supabase-storage tar
    -xzf /tmp/restore.tar.gz -C /var/lib/storage` for Storage. These are the correct commands for a
    REAL disaster (an in-place restore over data that's already gone) — never run them literally as
    a rehearsal, they'd overwrite the live database/volume.
  - **Rehearsed for real, 2026-09-19 — both restores work.** Tested against a throwaway target
    instead of the live one: `pg_restore` into a scratch database (`CREATE DATABASE
    rat_restore_test`, dropped after) rather than `-d postgres`, and the Storage tar extracted into
    a scratch directory (`/tmp/storage_restore_test`) rather than `/var/lib/storage`. Postgres: all
    four spot-checked table counts (`catalog`/`catalog_metadata`/`picture_metadata`/`sync_manifest`)
    matched the live database exactly. Storage: 141,327 files extracted, matching the live bucket's
    real object count; a spot-checked file was present with real content.
  - **One real gap found and fixed getting the rehearsal to run**: a bare `CREATE DATABASE` doesn't
    carry the `extensions` schema/`uuid-ossp`/`pgcrypto` extensions that Supabase's own project
    bootstrap installs into the live `postgres` database — every table's `id` column defaults to
    `extensions.uuid_generate_v4()`, so the very first `CREATE TABLE` in the dump failed, cascading
    into every downstream `COPY`/constraint/grant (87 errors). Fixed by provisioning
    `CREATE SCHEMA extensions; CREATE EXTENSION "uuid-ossp"/"pgcrypto" WITH SCHEMA extensions;`
    before `pg_restore`. This only bites when restoring onto a target that never went through
    Supabase's own project bootstrap (a scratch database on the same cluster, as here, or — the
    scenario that actually matters — a **brand new host** after a full host loss, if this pg_dump
    backup is used to restore it rather than the separate FileMaker-rebuild path documented in
    `filemaker_sync/devlog/worksheet.md`'s Disaster Recovery reference, which self-provisions its
    own extension and needs no such fix). The existing live `postgres` database
    already has both extensions, so an in-place restore onto a host that still exists is unaffected.
  - **Rehearsed again, 2026-11-18, for the irreplaceable tables.** The nightly dump was copied off
    oci and restored into a throwaway local `postgres:17` container (oci itself untouched). Every
    table matched live row for row (md5 of each row) as of the dump time: `model_answer` 553,
    `data_fix_history` 282,619, 127 reviewed `data_fix_value` rows, `admin_user` 3, `model_task`,
    the zero-shot run and its 141,111 predictions, `catalog` 141,244. The only differences were 2
    values reviewed after the dump. **Before `pg_restore` onto a new host, provision:** the
    `extensions` schema with `uuid-ossp` and `pgcrypto` (above); the roles `anon`, `authenticated`,
    `service_role` **and `picaloco_agent`** (without it, 21 grants fail, new in this rehearsal); and
    the admin accounts in `auth.users`, which the dump doesn't contain (§12), or the
    `admin_user_user_id_fkey` constraint fails.
- **`config.toml`'s `[export]` path is now fixed** (`filemaker_sync`, 2026-09-07) — previously
  neither a valid Windows nor WSL path. `scripts/paths.py::resolve_export_path()` translates the
  now-correct Windows-native value to its WSL mount-point form automatically; `upload_images_oci.py`
  and `db_dml_loader.py` both use it. `upload_images_oci.py`'s default folder is also now
  `webp_mobile` (thumbnail-size, matches what's actually served) instead of the full-size `webp`
  folder it silently would have used before. See `filemaker_sync/devlog/worksheet.md` Session 17.

Still open, lower priority than the above: the S3-protocol default `dev`/`dev` credentials on `oci`
(flagged repeatedly, still not rotated); no rate limiting on the public REST API beyond what
Supabase ships with by default.

**Uptime alerting (2026-11-21):** three free UptimeRobot monitors watch the site, the backend's
search data (through `GET /api/health`, `api/health.ts`, which sends the `apikey`/`Accept-Profile`
headers the free plan can't) and one photo, emailing the developer and the head of RAT. Exact
settings and what each alert means: `docs/ops-manual/uptime-monitors.md`.

---

## 11. `picaloco_agent`'s activation gate (`api/agent-auth.ts`, `api/agent-storage-*.ts`)

**Why this exists**: `picaloco_agent` (sibling repo, the Windows desktop sync tool) needs a DB
password to run, but its installer is meant to be handed out via a plain weblink rather than a
gated download. Baking the password into every copy of the `.exe` would mean anyone who gets the
file has it forever, with no way to revoke it. Instead, the agent ships with no password at all,
prompts for a registration key on first run, and exchanges that key for the real password here.
Full design discussion: `filemaker_sync` session log, 2026-09-10.

**Why this lives in `picaloco_web`, not a Supabase Edge Function**: `oci`'s
`supabase-edge-functions` container has never actually had a function deployed to it — it's been
crash-looping since setup with no entrypoint (see `filemaker_sync/devlog/worksheet.md`), and a
prior session recommended just stopping it. Reviving and deploying to it means live SSH work on
`oci` itself. `picaloco_web` already has a proven Vercel deploy path (§6), and a Vercel serverless
function gives the exact same security property (the real secret lives server-side, never reaches
a client) without needing new infrastructure.

**Setup** (one-time):

1. Run `supabase_agent_licenses.sql` (repo root) against `oci` — creates `rat.agent_licenses`,
   deliberately **no** `anon` grant (only `api/agent-auth.ts`'s service_role client ever queries
   it). **Lives in `rat`, not `rat_migration`** — confirmed live that this instance's PostgREST only
   exposes schemas explicitly configured for the REST API, and `rat_migration` isn't one of them
   (it's only ever been reached via direct Postgres connections elsewhere in this project); a table
   created there was silently unreachable via `supabase-js`, with a valid key failing exactly like
   a bad one. See the SQL file's own header and `api/agent-auth.ts`'s module docstring.
2. **Grant `service_role` access explicitly** — confirmed live this doesn't come for free just
   because the table lives in `rat`: `anon` has its own long-standing explicit grants there, but
   nothing had ever granted `service_role` anything on this project's own schemas before this table
   (`service_role`'s usual broad access is Supabase's own bootstrap default for schemas *it*
   creates, like `public`/`auth`/`storage` — not automatic for a project's own custom schema).
   Without this, every lookup fails with Postgres `42501 permission denied for schema rat`,
   regardless of whether the key is valid:
   ```sql
   GRANT USAGE ON SCHEMA rat TO service_role;
   GRANT SELECT, UPDATE ON rat.agent_licenses TO service_role;
   ```
3. Set `SUPABASE_SERVICE_ROLE_KEY` and `AGENT_DB_PASSWORD` in Vercel (§5, §6.2) — **the real
   password**, not the `CHANGE_ME_BEFORE_RUNNING` placeholder `picaloco_agent/src/_secret.py` ships
   with on a fresh checkout (confirmed live: this is exactly the failure mode if you paste that
   placeholder in instead of the real `picaloco_agent` role password from `create_agent_role.sql`).
4. Issue a key for an install: `INSERT INTO rat.agent_licenses (label) VALUES ('...')
   RETURNING key;` — hand the returned UUID to whoever's running `picaloco_agent`.
5. Revoke a key any time, no redeploy needed: `UPDATE rat.agent_licenses SET revoked =
   true WHERE label = '...';`

**Done and confirmed live end-to-end (2026-09-11/12)**: `picaloco_agent`'s own side (a "Registration
Key" field under Help → Registration..., `target_config.py` calling this endpoint instead of reading
a baked-in secret) — a real key, issued via the SQL above, entered in the actual running GUI and
accepted, `Sync`/`Upload Images` correctly enabling. Getting there needed real live debugging: the
table started in `rat_migration`, which this instance's PostgREST doesn't expose (moved to `rat`);
`service_role` then needed explicit `GRANT`s on it (step 2 above, not automatic just because the
table's in `rat`); and `AGENT_DB_PASSWORD` had to actually match the live Postgres role's password,
not just look right in Vercel. Full trace: `filemaker_sync/devlog/worksheet.md` Session 19.

**Storage `service_role` relay (2026-09-12) — done, both halves of the gate now match.** The
password half above only covers Postgres; Storage uploads are the materially bigger risk
(`service_role` bypasses RLS across the *entire* database and Storage, not just images), so it
gets the same treatment: `api/agent-storage-upload.ts` relays one image upload, `api/agent-
storage-list.ts` relays one Storage bucket-listing page — both gated by the same
`rat.agent_licenses` key check (factored into shared `lib/agentAuth.ts`, used by all three
functions). Reuses the *same* `SUPABASE_SERVICE_ROLE_KEY` env var already set for §11's Postgres
half — no new Vercel config needed. On `picaloco_agent`'s side, `vendor/scripts/
upload_images_oci.py` grew an opt-in `--registration-key` mode (resolved via env var
`RAT_AGENT_REGISTRATION_KEY`) that routes every Storage call through these two endpoints instead
of talking to Storage directly; the existing direct-`service_role` path is completely unchanged
and stays the default for `filemaker_sync`'s own trusted, admin-run use (disaster recovery, a full
archive migration) — there's no reason to pay per-request relay overhead for something already
running with legitimate direct access. `target_config.has_storage_access()` replaces the old
`has_service_key()` gate on the Upload Images button — that gate previously blocked Upload Images
entirely on any real distributed install (no baked `service_role` key, registration key
notwithstanding), which was the actual gap this closes.

**Confirmed live end-to-end (2026-09-12, filemaker_sync session log Session 21)**: reused the same
registration key already proven for the Postgres half. `agent-storage-list.ts` paginated the real
141,327-object bucket (95 pages) and landed on the same 48 missing image_nos the direct path
finds; `agent-storage-upload.ts` both uploaded a genuine missing image (`msmsa0265`, independently
verified present in Storage afterward) and correctly classified a fresh InvalidKey case
(`` mssacpe3042` ``) as `storage_invalid_key: true`, which landed in `rat_migration.reject_log` on
the agent side exactly as the direct path would. Both halves of the gate are now live-proven, not
just deployed.

`picaloco_agent` still isn't repackaged/distributed yet — this gate makes that safe to do via a
plain weblink once it is.

## 12. Data Fixes (`/admin/fixes`)

The client reviews values extracted from `rat.catalog.description`. The first fixes are
`loco_number` and `loco_name`. Design:
`docs/superpowers/specs/2026-11-14-data-fixes-loco-number-name-design.md`.

**Where the data lives.** `rat.data_fix` (one row per fix, including the client's format
`instructions`), `rat.data_fix_value` (one row per photo per fix, keyed on `image_no`, no FK to
`rat.catalog`), `rat.data_fix_history` (every change, append-only) and `rat.admin_user` (who may
review). The FileMaker → Postgres loader never writes these tables. The DDL is in
`filemaker_sync/supabase/schema/add_data_fix_tables.sql` (see §3.1).

**The protection promise.** A value a person has reviewed (status `verified`, `corrected`,
`none_visible` or `no_loco`) can't be overwritten by the extractor or a sync. A trigger rejects
any change to a reviewed value that doesn't come from a review RPC. When a photo's description
changes in FileMaker, the extractor refreshes only the *suggestion* and sets `needs_recheck`. The
reviewed value stays. Rechecks show on the list page as "Needs recheck (N)". On a recheck
card, Enter **keeps the current review** and U **uses the new suggestion**. A saved value counts as
`verified` when it equals the suggestion, and as `corrected` otherwise.

**Admin accounts.**
1. Keep public sign-up off: `DISABLE_SIGNUP=true` in the Supabase docker `.env`, then
   `docker compose up -d auth`. Verify with
   `curl -s https://huey.taila2eeb2.ts.net/auth/v1/settings -H "apikey: <anon key>"`, which should
   show `"disable_signup":true`.
2. Create the user in Studio → Authentication → Add user, ticking "Auto Confirm User".
3. Grant review rights:
   ```sql
   insert into rat.admin_user(user_id) select id from auth.users where email = '<email>';
   ```
   To revoke: `delete from rat.admin_user where user_id = (select id from auth.users where email = '<email>');`.
   A signed-in account that isn't listed sees "This account isn't an admin." and no data.

The admin pages use a separate supabase-js client (`src/lib/supabase/adminClient.ts`, session key
`picaloco-admin-auth`). The public client stays anonymous.

**RPCs** (all `SECURITY DEFINER`, `EXECUTE` for `authenticated` only, and all but `is_admin`
raise `42501` for non-admins):

| RPC | Purpose |
|---|---|
| `is_admin()` | Is the signed-in user in `rat.admin_user` |
| `data_fix_progress()` | Counts by fix, status, confidence and `needs_recheck` |
| `data_fix_queue(p_fix_id, p_confidence, p_status, p_include_recheck, p_collection, p_text, p_after, p_limit)` | One page of the review queue, keyset on `image_no` |
| `review_fix_value(p_image_no, p_fix_id, p_values, p_status, p_expected_updated_at)` | Save one review. `PT409` (HTTP 409) means someone else changed it first (optimistic lock on `updated_at`, so the exact string is passed through) |
| `confirm_fix_values(p_fix_id, p_items)` | Bulk confirm `{image_no, updated_at}` items; only rows still `extracted` and unchanged are confirmed |
| `data_fix_orphans()` | Reviewed rows whose photo is no longer in `rat.catalog` |

**Filling and refreshing** (from `filemaker_sync`, WSL):
```bash
venv/bin/python scripts/extract_loco_fields.py --target-profile oci           # dry run: counts + CSV
venv/bin/python scripts/extract_loco_fields.py --apply --target-profile oci   # write (never touches reviewed values)
```
Every Stage 2 load (`db_dml_loader.py`: GUI Full Sync, Load to Target) and every Delta Sync
(`run_incremental_sync.py`) also refreshes the loco fields for the rows it loaded. This puts new
photos into the queue and sets `needs_recheck` when FileMaker changes a reviewed photo's
description. Neither step can fail the load. **`picaloco_agent`'s vendored copies of these scripts
don't do this yet.** Until they are synced, run the `--apply` command above after each agent sync.

**Preservation check.** Run it before and after any reload or full sync. The `checksum` must not
change except through the client's own reviews:
```bash
venv/bin/python scripts/data_fix_preservation_check.py --target-profile oci
# baseline 2026-11-14, before any review: {"reviewed": 0, "checksum": "d41d8cd98f00b204e9800998ecf8427e"}
```

**Backups and recovery: the reviews are irreplaceable.** The client's reviews exist only in
`oci`. The FileMaker rebuild (filemaker_sync's Disaster Recovery chain) plus `--apply` would
recreate every row as an unreviewed suggestion, so **restore `rat.data_fix*` from the nightly
dump; never re-extract over it.** The nightly `rat-backup.sh db` dump covers the whole `rat`
schema (§10) and is copied nightly off the host (PC plus encrypted Google Drive, §10). `rat.admin_user` references `auth.users`, which isn't
in that dump: on a new host, recreate the admin accounts first, then re-insert `admin_user` by
email. Restore check, run on huey once a dump containing the tables exists:
```bash
F=$(ls -t ~/backups/rat/db/* | head -1); pg_restore --list "$F" | grep data_fix
docker exec supabase-db createdb -U supabase_admin restore_check
docker exec supabase-db psql -U supabase_admin -d restore_check -c 'create schema rat'
docker exec -i supabase-db pg_restore -U supabase_admin -d restore_check -n rat -t data_fix_value < "$F"
docker exec supabase-db psql -U supabase_admin -d restore_check -c "select count(*), count(*) filter (where status <> 'extracted') from rat.data_fix_value"
docker exec supabase-db dropdb -U supabase_admin restore_check
```
The counts must match the live table.

### Volunteers, approvals and undo

Design: `docs/superpowers/specs/2026-11-22-ai-volunteer-design.md`.

**Migration file.** `filemaker_sync/supabase/schema/add_volunteer_tables.sql` (applied to `oci`
2026-11-23; the preservation checksum was unchanged). **Apply it last**, and re-apply it after any
re-run of `add_data_fix_tables.sql`, `add_model_check_tables.sql` or the `fix_*.sql` files: those
revert shared functions, and the history `source` CHECK would reject `undo` rows once any exist.

**Roles.** Admin (`rat.admin_user`) and AI volunteer (`rat.volunteer`; `in_training` defaults on;
`must_change_password`). Volunteers see only Data fixes and Model check. Migration status (`/admin`)
stays open without sign-in, because the FileMaker GUI's "Open Admin Dashboard" links to it.

**`/api/volunteers`** (Vercel function, `lib/volunteers.ts`; uses `SUPABASE_SERVICE_ROLE_KEY`,
already set on Vercel). The caller's own token is checked as admin first. Email is normalised.
- `create`: makes the account with a 12-character temporary password, shown once. An existing
  non-volunteer account is refused with 409.
- `reset`: volunteers only.
- `set_password`: only for a volunteer who must change their password. Used only if the auth server
  requires reauthentication for password changes. **Check this on the first live run** (huey's auth
  settings); if it does, the first-sign-in form must call `set_password`.

**Pages** (admin only, under the menu's "People"): `/admin/volunteers`, `/admin/approvals`,
`/admin/changes`.

**Held work.** With `in_training` on, saves go to `rat.pending_fix_review` /
`rat.pending_model_answer` and don't count. Approve replays the save through the normal path,
recording the trainee as author and the admin as approver. A stale fix (the value changed since) is
skipped unless the admin picks "Approve anyway". A rejected item keeps the admin's note and shows to
the trainee under "Sent back".

**Undo.** `rat.undo_fix_change` works per photo and fix: it restores the state before the earliest
undone change, only if nothing outside the batch has changed it since, and records a history row with
source `undo`. `rat.withdraw_model_answers` is append-only: withdrawn answers stop counting
everywhere, including `scripts/model_train.py`, and the Data fixes they filled are also undone when
unchanged since. `rat.change_list` feeds the Changes page.

**Irreplaceable (Golden Rule 7).** `rat.model_answer_withdrawal`, `rat.pending_fix_review` and
`rat.pending_model_answer` join `rat.data_fix*` and `rat.model_answer`: restore from backup, never
rebuild.

**Changes page question filter.** It needs the re-applied `supabase/schema/add_volunteer_tables.sql` (the updated `rat.change_list`) on `oci`; until then the filter has nothing to call.
