# RAT operations manual and automatic site check — design

Status: draft for the user's approval (2026-11-20).

## Why

RAT (Restoration and Archive Trust) is not technical, and the developer may not always be
available to support the system. The manual must let RAT notice when something is wrong, report it
to the right person, and, when the developer can't be reached, get a technician going.

## Who reads it (the user's answers)

1. **Volunteers:** check the site is up and report problems. They fix nothing.
2. **The head of RAT (the client):** receives every report and is the person ultimately
   responsible. When the developer can't be reached, they **open the sealed envelope and give it to
   a technician**.

## Goals

- A volunteer with no technical knowledge can tell "working" from "broken" from screenshots, and
  send a useful report.
- The head of RAT can decide "wait a day" or "get help now", find and brief a technician, and knows
  what the envelope is for.
- A technician who has never seen the system can start from the brief, the envelope and the
  existing `DEVOPS.md`.
- Someone is told automatically when the site or the server goes down, even if no volunteer looks.

## Non-goals

- Teaching anyone to fix things. No commands, ssh, SQL or Docker in the volunteer or head parts.
- Replacing `DEVOPS.md`: it stays the technician's manual; the new manual points to it.
- Moving accounts into RAT's name.
- A help page inside the website (it would vanish exactly when needed; maybe later, on top).

## Anti-goals (failure even if it "works")

- **Any secret written in the manual** (passwords, keys, backup codes, the backup passphrase).
  The manual lists only *what* goes in the envelope; the user fills the envelope by hand.
- A volunteer "fixing" something and losing irreplaceable work: the Data Fixes reviews and Model
  check answers. The manual says plainly what never to touch.
- A manual that only exists on the site or on the developer's PC.
- Jargon a volunteer has to look up.

## Approaches (the user picked A, with the automatic check)

- **A. An editable document that is also printed (chosen).** A Claude Doc, plain English with
  screenshots, exports to PDF or Word. One printed copy kept with the envelope; the head of RAT
  gets the link to the live version. The developer updates it there.
- B. A Help page on the website. Always current, but down when the site is down. Not now.
- C. A Word or PDF file in the repo. Hard for non-technical readers to find; edits need git.

**Automatic check:** a free uptime service (UptimeRobot or similar) checks every few minutes and
emails when something stops answering. The manual explains what that email means.

## The manual's contents

**Part 1 — Volunteers: is it working?**
- What the system is, in three sentences (the public archive site, the admin pages, the server
  behind them).
- The check, step by step with screenshots: open the site; search a known photo number; the
  photo shows; (admins) log in to Data Fixes and Model check.
- What broken looks like, each with a screenshot and one plain-language likely cause: blank page;
  "can't reach the server"; grey placeholders instead of photos; search finds nothing; login fails.
- How to report: what to note (date and time, page address, screenshot, what was clicked) and a
  fill-in report to copy and send to the head of RAT.
- Never do: listed plainly (for example, don't delete or re-enter records to make a problem go
  away; don't share admin logins).

**Part 2 — The head of RAT: what to do with a report**
- Wait or act: a short table (for example, one photo missing → note it, no rush; whole site down
  for more than a few hours → contact the developer; developer unreachable for N days → envelope).
- What the automatic-check emails mean and what to do with each.
- How to find and brief a technician: the skills needed (named in plain words), a one-page brief
  of what the system is, and where its technical manual and code are.
- The envelope: what it is, where it is kept, when to open it, and that it goes only to the
  technician.

**Part 3 — Who holds what (one page)**
- Every service the system depends on, whose account it is on, what breaks if it lapses, and
  whether it costs money.
- The envelope checklist (no values): each account's login, its second-step backup codes, the
  KeePass master password, the backup passphrase, the server login.

**Part 4 — For the technician (one page)**
- System map in plain words, the irreplaceable data and the rule never to rebuild it, where the
  backups are (server, developer's PC, encrypted Google Drive), and pointers to `DEVOPS.md` and the
  repos.

## The automatic check

Three monitors, because the website can be up while the server is down:
1. The public site's home page (Vercel).
2. The server's data API (the `curl` health check in `DEVOPS.md` §3: a keyword check on one row of
   `mobile_catalog_view`). The anon key it needs is already public in the site.
3. One known photo from Storage.

Alerts go by email. The user creates the account (it is an outside service); the builder supplies
the exact monitor settings and writes the manual's "what this email means" section to match.

## Constraints

- No secrets in the manual, the doc, the repo, or chat.
- Screenshots come from the live site; admin screenshots must not show reviewer details or the
  developer's email.
- Plain English, short sentences; British spelling (the client is UK).
- Every fact about services and accounts is checked against `DEVOPS.md` and the user, not guessed.

## Settled after the builder check

- **Alerts go to both the developer and the head of RAT** (the user's answer). Part 2 explains
  each alert email in plain words, so the head can act on one without the developer.
- **The server runs on Oracle Cloud's Always Free tier, on the developer's Oracle account** (the
  user's answer). Part 3 says so, and notes the risk: if that account lapses or is closed, the
  server and its on-server backups go with it; the PC and Google Drive copies remain. The Oracle
  login goes on the envelope checklist.

- **The developer is the user.** The manual has a "Developer contact" box the user fills in
  (builder's call: no personal details are written by the builder).
- **Where the manual lives (builder's call):** the live Claude Doc is in the developer's account,
  so it would go with the developer. After each update the developer exports a PDF and gives it
  to the head of RAT (email plus a printed copy kept with the envelope). The PDF is the copy that
  must outlive the developer; the manual's cover shows its date.
- **Screenshots:** the builder uses the existing admin test login from `picaloco_web/.env.local`,
  read only inside scripts and never printed. Sample photo numbers for the volunteer check are
  the builder's choice (well-known photos with images that are present).
- **Monitor targets:** the server's public Funnel address and the anon key are already public
  (the site's own code uses both), so they may appear in the monitor settings and the
  technician page. They don't appear in the volunteer part.
- **Account facts for Part 3** are gathered from `DEVOPS.md`, the repos and the user in a first
  step, then checked by the user before the manual is printed.

## Left to the builder

Exact wording, screenshot choice, the doc's layout, the wait-or-act thresholds (proposed, the user
checks them), and the uptime check interval.
