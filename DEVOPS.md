# DevOps / Rebuild Manual

A from-scratch guide to this system, written so a developer with no prior context could rebuild
and redeploy every piece of it. Read section 1 first for the map, then jump to whichever section
matches what you're actually trying to do.

This document deliberately contains **no secrets** (passwords, API tokens, private keys, or private
IP addresses) — this repo is public. Every step below says *where* to get a credential, never what
it is.

---

## 1. System map

Three things have to work together for `picaloco_web` to function. None of them live in this repo.

```
┌─────────────────────┐     ┌──────────────────────────┐     ┌───────────────────────────┐
│  picaloco_web (this  │     │  Self-hosted Supabase      │     │  A separate Supabase       │
│  repo) — static site │────▶│  ("oci"), schema `rat`     │     │  project's public Storage  │
│  on Vercel           │     │  — metadata & search       │     │  bucket — real images      │
└─────────────────────┘     └──────────────────────────┘     └───────────────────────────┘
                                        ▲
                                        │ populated by
                             ┌──────────────────────────┐
                             │  filemaker_sync (sibling  │
                             │  repo) — the migration    │
                             │  pipeline, FileMaker→rat  │
                             └──────────────────────────┘
```

- **`picaloco_web`** (this repo): a static Vite/React SPA. No backend of its own — every data
  fetch goes straight from the browser to Supabase's REST API (PostgREST) via `@supabase/supabase-js`.
- **The "oci" Supabase instance**: self-hosted (Docker Compose, the standard Supabase self-host
  stack — Postgres, PostgREST, Storage, Studio, etc.), reachable only over Tailscale by hostname,
  made public via **Tailscale Funnel**. Holds the `rat` schema, which `filemaker_sync` populates
  from the RAT charity's FileMaker Pro archive (~141k photo records, growing). This is the **only**
  live, current data source for search/metadata.
- **The images project**: a *different*, ordinary cloud Supabase.com project, used only for its
  Storage bucket (`picaloco/images/`). It holds ~1,000 real thumbnail `.webp` files — a small pilot
  batch, not the whole archive. It is otherwise unrelated to `oci`; its own Postgres database (a
  `dev` schema, an old frozen copy of the catalog) is **not** used by this app.
- **`filemaker_sync`** (sibling repo, public): the migration pipeline. Not part of this app's
  runtime at all — it's what keeps `oci`'s `rat` schema populated and current. See its own
  `CLAUDE.md` and `devlog/worksheet.md` for that side of the system.

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
curl -s https://huey.taila2eeb2.ts.net/rest/v1/mobile_catalog_view?select=image_no&limit=1 \
  -H "apikey: <anon key>"
```

A JSON row back means it's already working — move on to §4/§6. If you get a 404/PGRST error or
the request times out, rebuild as follows.

### 3.1 Recreate the view

Run this against the `oci` Postgres instance (psql, or Supabase Studio's SQL editor at
`http://<oci-host>:3000` if you have Tailscale access to it). It's additive — safe to run even if
some of it already exists (drop-and-recreate the view specifically if it's stale).

```sql
CREATE VIEW rat.mobile_catalog_view AS
SELECT c.image_no,
    c.category,
    c.date_taken,
    c.circa,
    c.imprecise_date,
    c.description,
    c.gauge,
    concat('https://cdn.example.com/thumbnails/', c.image_no, '.webp') AS thumbnail_url,
    cnt.name AS country,
    org.name AS organisation,
    org.type AS organisation_type,
    l.name AS location,
    r.name AS route,
    col.name AS collection,
    p.name AS photographer,
    u.prints_allowed,
    u.internet_use,
    u.publications_use,
    array_agg(DISTINCT jsonb_build_object('builder_name', b.name, 'builder_code', b.code, 'works_number', cb.works_number, 'year_built', cb.year_built, 'plant_code', cb.plant_code, 'builder_order', cb.builder_order)) FILTER (WHERE b.id IS NOT NULL) AS builders,
    pm.file_type,
    pm.width,
    pm.height,
    pm.resolution,
    pm.colour_space,
    pm.colour_mode,
    c.cd_no,
    c.cd_no_hr,
    c.bw_image_no,
    c.bw_cd_no,
    c.active_area,
    c.corporate_body,
    c.facility,
    c.modified_date AS last_updated
   FROM rat.catalog c
     LEFT JOIN rat.catalog_metadata cm ON c.id = cm.catalog_id
     LEFT JOIN rat.organisation org ON cm.organisation_id = org.id
     LEFT JOIN rat.country cnt ON org.country_id = cnt.id
     LEFT JOIN rat.location l ON cm.location_id = l.id
     LEFT JOIN rat.route r ON cm.route_id = r.id
     LEFT JOIN rat.collection col ON cm.collection_id = col.id
     LEFT JOIN rat.photographer p ON cm.photographer_id = p.id
     LEFT JOIN rat.usage u ON c.id = u.catalog_id
     LEFT JOIN rat.catalog_builder cb ON c.id = cb.catalog_id
     LEFT JOIN rat.builder b ON cb.builder_id = b.id
     LEFT JOIN rat.picture_metadata pm ON c.id = pm.catalog_id
  GROUP BY c.id, c.image_no, c.category, c.date_taken, c.circa, c.imprecise_date, c.description, c.gauge, cnt.name, org.name, org.type, l.name, r.name, col.name, p.name, u.prints_allowed, u.internet_use, u.publications_use, pm.file_type, pm.width, pm.height, pm.resolution, pm.colour_space, pm.colour_mode, c.cd_no, c.cd_no_hr, c.bw_image_no, c.bw_cd_no, c.active_area, c.corporate_body, c.facility, c.modified_date;
```

Note: `thumbnail_url` here is a dead placeholder (`cdn.example.com`) — the app doesn't use it; it
builds real image URLs itself from `VITE_IMAGES_BASE_URL` (§5). Leave it as-is for fidelity to the
original design, or drop the column if you're rebuilding cleanly.

### 3.2 Scope `anon`'s access

By default, a fresh Supabase Postgres role setup often grants `anon` `SELECT` on every table in an
exposed schema. **This is not safe once the schema is public** — `rat.catalog` has `valuation` and
`owners_ref` columns that must never be exposed. Lock it down to exactly what this app needs:

```sql
GRANT SELECT ON rat.mobile_catalog_view TO anon;
GRANT SELECT ON rat.photographer, rat.location, rat.organisation,
                rat.collection, rat.country, rat.route, rat.builder TO anon;
REVOKE SELECT ON rat.catalog, rat.catalog_metadata, rat.catalog_builder,
                 rat.usage, rat.picture_metadata FROM anon;
```

Verify:

```sql
SELECT table_name FROM information_schema.role_table_grants
WHERE grantee = 'anon' AND table_schema = 'rat' ORDER BY 1;
-- Expect exactly: builder, collection, country, location, mobile_catalog_view,
--                 organisation, photographer, route
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
| `VITE_IMAGES_BASE_URL` | Public Storage URL prefix for images | `https://<images-project-ref>.supabase.co/storage/v1/object/public/picaloco/images` — see §1, this is a *different* Supabase project than `oci` |

None of these are secret in the traditional sense (all three are embedded in the public JS bundle
of a deployed site) — but keep them in `.env.local` (gitignored) rather than committed, as normal
hygiene and to make rotation easy.

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

- **Only ~1,000 of ~141,244 catalog rows have a real photo.** The rest render a clean "not yet
  available" placeholder — this is a real data gap (most archive images were never uploaded
  anywhere), not a bug in this app.
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
| Images never load, even for known-good `image_no`s | `VITE_IMAGES_BASE_URL` wrong, or that separate Supabase project is paused/deleted | Confirm the URL directly with `curl`; check that project's dashboard for a paused-project banner |
| A shared/bookmarked `/photo/...` link 404s but `/` works | Missing `vercel.json` rewrite | See §6.2's last note |
| `vercel env add` hangs or errors on a JWT-looking value | Needs an explicit `--type` | Add `--type config --yes` |
| `vercel link`/`vercel git connect` says "Failed to connect ... to project" | Vercel's GitHub App isn't authorized for this repo | See §6.2's GitHub Apps fix |
| An AI coding agent's direct DB/network commands get silently blocked | Expected — see the note at the end of §3.3 | Have a human run the exact command instead |
