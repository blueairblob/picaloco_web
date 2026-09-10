# picaloco_web

A public web tool to search and browse the RAT photo archive, keyed on `image_no`. Built as a
much simpler alternative to the over-specced, unfinished `trainpixelfolio` mobile app — see
`filemaker_sync/devlog/worksheet.md` Session 14 for the full backstory.

**Live at https://picaloco-web.vercel.app.** For a full rebuild-from-scratch guide (backend setup,
deployment, troubleshooting), see [`DEVOPS.md`](./DEVOPS.md).

## Stack

Vite + React + TypeScript + Tailwind CSS 4 + react-router + `@supabase/supabase-js` + React Query.

## Setup

```bash
npm install
cp .env.example .env.local   # fill in VITE_SUPABASE_ANON_KEY
npm run dev
```

## Backend

- **Metadata/search**: self-hosted Supabase (`oci`, schema `rat`) at `VITE_SUPABASE_URL`, exposed
  publicly via Tailscale Funnel. Queries go through `rat.mobile_catalog_view` (a joined, denormalised
  view — see its definition in the `filemaker_sync` worksheet if it ever needs recreating) plus a
  handful of small lookup tables for facet dropdowns. The `anon` role is scoped to exactly these —
  it does **not** have access to raw `rat.catalog` (which holds non-public columns like `valuation`).
- **Images**: `oci`'s Storage now too (`VITE_IMAGES_BASE_URL`, same instance as the metadata) — no
  key needed, plain public GET. As of 2026-09-07, 141,197 of the ~141,244 catalog rows have a real
  image (99.97% — uploaded from the actual local FileMaker export, not the small old cloud project
  first assumed to be the source; see `filemaker_sync/devlog/worksheet.md` Session 16). ~47 rows show
  a "not yet available" placeholder — a known, small data-quality gap, not a bug.
- **`picaloco_agent` activation gate** (`api/agent-auth.ts`, a Vercel serverless function, not part
  of the Vite app): lets the sibling `picaloco_agent` desktop tool exchange a revocable registration
  key for its real DB password, server-side only. See [`DEVOPS.md` §11](./DEVOPS.md#11-picaloco_agents-activation-gate-apiagent-authts).

## Project structure

```
api/
  agent-auth.ts        picaloco_agent's activation gate (Vercel serverless function, see §11)
src/
  lib/supabase/       Supabase client + hand-authored types (reference only, see client.ts)
  services/           catalogService (search/detail), lookupService (facets), images (URL builder)
  hooks/               useCatalogSearch, useLookupOptions, useDebouncedValue
  components/
    search/            SearchBar, FilterPanel, FilterChip
    results/           PhotoGrid, PhotoCard, Pagination
    detail/            PhotoDetailView, MetadataRow
    layout/            Header
  pages/               SearchPage (/), PhotoDetailPage (/photo/:imageNo), NotFoundPage
```

## Known gaps

See `DEVOPS.md` §8 for the current, maintained list (dropdown truncation on large facets, sparse
real-image coverage, no automated tests). Both deploy and browser verification are done — this
section used to say otherwise when the app was first scaffolded.
