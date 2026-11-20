# RAT operations manual and automatic site check — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A plain-English operations manual for RAT (volunteers, the head of RAT, a technician),
published as a Claude Doc with a PDF export, plus exact settings for three uptime monitors.

**Architecture:** Facts and screenshots are gathered into `picaloco_web/docs/ops-manual/` first
(checked, committed, no secrets). The manual is written from them as a Claude Doc, then exported to
PDF. The uptime monitors are specified in a settings file the user applies in UptimeRobot.

**Tech Stack:** Claude Docs connector (write, upload images, export); Playwright (screenshots,
as used for earlier browser checks); `curl` (endpoint checks).

**Spec:** `picaloco_web/docs/superpowers/specs/2026-11-20-ops-manual-design.md`

## Global Constraints

- No secrets anywhere: manual, doc, repo, chat, screenshots. The envelope checklist names items,
  never values.
- No developer email or personal details written by the builder; the "Developer contact" box is
  left for the user.
- Admin test login comes from `picaloco_web/.env.local` (ADMIN_TEST_EMAIL / ADMIN_TEST_PASSWORD),
  read only inside scripts, never printed.
- Volunteer and head parts: no commands, ssh, SQL, Docker or unexplained jargon. Short sentences,
  British spelling.
- Funnel address and anon key may appear only in the monitor settings and the technician page.
- Alerts go to the developer and the head of RAT. Server: Oracle Cloud Always Free, developer's
  Oracle account.
- Never write to the live database; never touch `rat.data_fix*` or `rat.model_answer`.

## Review Focus

1. A screenshot that shows an email address, reviewer name or key: each one is checked before use
   (Task 2 step 3).
2. A monitor that stays green while the server is down (the Vercel page is static): monitor 2
   checks a keyword in the API answer, not just a 200 (Task 3 step 2).
3. The manual surviving the developer: the PDF carries a date and is the copy handed over (Task 5).
4. Jargon leaking into the volunteer part: a word check against a banned list (Task 4 step 4).
5. A broken-state screenshot that doesn't match what a volunteer would really see: each is made by
   blocking the real request in the browser, not by editing the page (Task 2 step 2).

---

### Task 1: Fact sheet

**Files:** Create `docs/ops-manual/facts.md`

**Produces:** the service list (name, what it does in plain words, whose account, cost, what
breaks if it lapses, envelope item), the public site address, the server address, the photo
address pattern, and two sample photo numbers with images present.

- [ ] **Step 1:** List services from `DEVOPS.md`, the repos and the spec: Vercel, GitHub
  (blueairblob), Oracle Cloud (Always Free, the `huey` server), Tailscale (Funnel), self-hosted
  Supabase on the server, Google Drive (blueairblob, encrypted backups), the developer's PC (backup
  copy and scheduled task), KeePass, the uptime service, picaloco_agent's registration keys.
- [ ] **Step 2:** Pick two sample photos and check them: `curl` the API row and the photo for
  each. Expected: row returned, photo HTTP 200 with image content type.
- [ ] **Step 3:** Grep the file for `@`, `password`, `key=`, `eyJ`. Expected: no secret values
  (the word "password" may appear as an item name only).
- [ ] **Step 4:** Commit `docs: ops manual fact sheet`.

### Task 2: Screenshots

**Files:** Create `docs/ops-manual/screenshots/*.png` and the capture script
`docs/ops-manual/capture.mjs`

**Consumes:** sample photo numbers and addresses from Task 1.

- [ ] **Step 1:** Working states, desktop width: home; search for sample photo 1; its detail
  page with the photo; admin login page; Data Fixes and Model check overviews (logged in with the
  test login).
- [ ] **Step 2:** Broken states, made by blocking real requests with Playwright routing: server
  unreachable (block the Funnel host); photos missing (block Storage only); search finds nothing
  (a nonsense search); login fails (wrong password).
- [ ] **Step 3:** Before saving each admin shot, check the page text for `@` and the test login
  email; hide or crop it. Look at every image. Expected: no email, name or key visible.
- [ ] **Step 4:** Commit `docs: ops manual screenshots`.

### Task 3: Uptime monitor settings

**Files:** Create `docs/ops-manual/uptime-monitors.md`

- [ ] **Step 1:** Three monitors, 5-minute interval, alerts to the developer and the head of RAT:
  (1) site home page, HTTP; (2) the API health query from `DEVOPS.md` §3 with its anon key header,
  keyword monitor on `image_no`; (3) sample photo 1, HTTP.
- [ ] **Step 2:** Check each with `curl` exactly as configured. Expected: 200 each; monitor 2's
  body contains `image_no`; with a wrong host, monitor 2 fails.
- [ ] **Step 3:** Note any free-tier limit that affects these settings (custom headers, keyword
  monitors, interval). If a setting needs a paid tier, give the free alternative.
- [ ] **Step 4:** Commit `docs: uptime monitor settings`.

### Task 4: The manual (Claude Doc)

**Consumes:** Tasks 1-3.

- [ ] **Step 1:** Create the doc: cover (title, date, "who this is for"), "Developer contact" box
  left blank for the user, then Parts 1-4 exactly as the spec lists them.
- [ ] **Step 2:** Upload the screenshots and place each beside the step or symptom it shows.
- [ ] **Step 3:** Part 2's wait-or-act table and alert-email section; Part 3's who-holds-what
  table from Task 1 and the envelope checklist (items only).
- [ ] **Step 4:** Read the doc back. Check Parts 1-2 for banned words (ssh, SQL, Docker, API,
  PostgREST, Supabase, Funnel, repo, deploy, cron, terminal, command line). Grep the whole doc for
  `@`, `eyJ`, and the passphrase or password values. Expected: none, except where a technician page
  names a service.

### Task 5: Export and hand-off

- [ ] **Step 1:** Export the doc to PDF; save it as
  `D:\backups\rat_oci\RAT-operations-manual-<date>.pdf` and tell the user the path.
- [ ] **Step 2:** Give the user their steps: fill the contact box; check Part 3; create the
  UptimeRobot account and the three monitors from Task 3; fill the envelope; send the PDF to the
  head of RAT and print one copy.
- [ ] **Step 3:** Commit the spec and plan; push `picaloco_web` only when the user says so.
