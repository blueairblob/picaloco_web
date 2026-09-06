# picaloco_web

A public web tool to search and browse the RAT photo archive, keyed on `image_no`. Built as a
much simpler alternative to the over-specced, unfinished `trainpixelfolio` mobile app — see
`filemaker_sync/devlog/worksheet.md` Session 14 for the full backstory.

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
- **Images**: a *separate* Supabase project's public storage bucket (`VITE_IMAGES_BASE_URL`) — no
  key needed, plain public GET. Only ~1,000 of the ~141k catalog rows have a real image today; the
  rest show a "not yet available" placeholder.

## Project structure

```
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

## Known gaps (as of initial scaffold)

- No automated tests — verify manually per the smoke-test list in the approved plan
  (`~/.claude/plans/linked-puzzling-phoenix.md` on the machine that built this).
- Not yet deployed to Vercel.
- Not yet visually verified in a browser (build/typecheck pass, and the underlying queries are
  proven against live data, but no interactive click-through has happened yet).
