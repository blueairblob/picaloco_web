# Ops manual — fact sheet

Source for the RAT operations manual (`docs/superpowers/specs/2026-11-20-ops-manual-design.md`).
**No secrets in this file.** "Envelope item" names what goes in the sealed envelope, never its value.
Checked 2026-11-20. Items marked *(to confirm)* need the developer's check before printing.

## Addresses

| What | Address |
|---|---|
| Public site (what volunteers open) | https://picaloco-web.vercel.app |
| Admin pages | https://picaloco-web.vercel.app/admin (Data Fixes `/admin/fixes`, Model check `/admin/model-check`; admin-only People pages `/admin/volunteers`, `/admin/approvals`, `/admin/changes`) |
| Server (public, via Tailscale Funnel) | https://huey.taila2eeb2.ts.net |
| Data health check (technician) | `GET <server>/rest/v1/mobile_catalog_view?select=image_no&limit=1` with headers `apikey: <anon key>` and `Accept-Profile: rat` → a JSON row |
| Photo address pattern | `<server>/storage/v1/object/public/picaloco/images/<image_no>.webp` (spaces removed) |

The anon key is public (it is in the site's own code). It still isn't printed here; the technician
reads it from the site's settings (Vercel `VITE_SUPABASE_ANON_KEY`).

## Sample photos (checked live 2026-11-20)

| Photo number | Description | Search row | Photo file |
|---|---|---|---|
| `arc00001` | Ex GWR City class 4-4-0 number 3717 City of Truro being installed in Swindon Railway Museum | found | HTTP 200, image/webp |
| `aj041` | One of the class T2000 gas turbine units stands in Paris St Lazare station | found | HTTP 200, image/webp |

A photo number that doesn't exist returns no search row and HTTP 400 for the photo.

## Services (who holds what)

| Service | What it does, in plain words | Whose account | Cost | If it lapses | Envelope item |
|---|---|---|---|---|---|
| Oracle Cloud (Always Free) | The rented computer ("the server", `huey`) that holds the archive data, the photos and the admin logins | Developer's Oracle account | Free tier | Everything stops: site has no data or photos; on-server backups lost too (PC and Drive copies remain) | Oracle Cloud login + second-step backup codes |
| Server login (`huey`) | How a technician gets into the server to repair it | Developer (ssh key on the developer's PC) | — | No repairs possible without it | Server access: how to get in (ssh key or Oracle console access) |
| Supabase (self-hosted on the server) | The database and photo store software running on the server | On the server; admin login for its dashboard (Studio) | Free (open source) | — (part of the server) | Supabase dashboard login |
| Tailscale (Funnel) | Makes the server reachable from the internet | Developer's Tailscale account | Free personal plan *(to confirm)* | Site loads but shows "can't reach the server"; no photos | Tailscale login + second-step backup codes |
| Vercel | Hosts the public website pages | Developer's Vercel account (linked to GitHub blueairblob) *(to confirm)* | Free Hobby plan *(to confirm)* | Site address stops working entirely | Vercel login (or "sign in with GitHub") |
| GitHub (blueairblob) | Stores the code and the technical manual (`DEVOPS.md`); site updates come from here | Developer's GitHub account | Free | Code still exists on the developer's PC; no updates to the site | GitHub login + second-step backup codes |
| Google Drive (blueairblob) | Holds encrypted copies of the nightly database backups (folder "RAT backups") | Developer's Google account | Free 15 GB | Off-site backup copies lost; server and PC copies remain | Google login + second-step backup codes |
| Backup passphrase | Unlocks the encrypted Drive backups | Developer's KeePass + a file on the developer's PC | — | Drive backups can't be opened | The backup passphrase (from KeePass) |
| KeePass | The developer's password safe | Developer's PC | Free | All stored logins lost unless the `.kdbx` file is copied elsewhere | KeePass master password + where the `.kdbx` copy is kept |
| Developer's PC | Pulls a daily copy of the backups (task "RAT backup pull") and pushes the encrypted copy to Drive | Developer | — | Daily off-site copies stop; server keeps 14 days | — |
| UptimeRobot | Checks the site every 5 minutes and emails when it stops answering | To be created by the developer | Free plan | No automatic warnings | UptimeRobot login |
| Site admin and AI volunteer logins | Admins use Data Fixes, Model check and People; AI volunteers use only Data fixes and Model check | Accounts on the server | — | — | Admin account list (names only) and how to reset a password (volunteers: an admin resets them on the Volunteers page) |
| picaloco_agent registration keys | Let RAT's FileMaker computer send updates to the server | Stored on the server; issued by the developer | — | FileMaker updates stop reaching the site | How to issue a new key (`DEVOPS.md` §11) |

## Irreplaceable data (must never be rebuilt)

- Data Fixes reviews: `rat.data_fix_value` rows not `extracted`, and `rat.data_fix_history`.
- Model check answers: `rat.model_answer`, and withdrawals of them: `rat.model_answer_withdrawal`.
- Trainee work held for approval: `rat.pending_fix_review`, `rat.pending_model_answer`.
- Restore these from a backup only; never re-create them from FileMaker.

## Who sees what (Part 1, step 4)

Navigation is a sidebar on the left (Search the archive, Archive workflow, People), opened and closed with the sidebar button in the header or Ctrl/Cmd+B; it remembers whether it was open, and on a phone it slides over the page. Settings (text size and theme) and the account (email and Sign out, or Sign in) sit at its foot. After signing in:
- Admins see Data Fixes, then Model check, plus People: Volunteers (add, reset password, training on/off, remove access), Approvals (held trainee work) and Changes (list of changes, with undo).
- AI volunteers see only Data fixes and Model check. A new volunteer must set their own password at first sign-in. While "in training" is on, their saves wait on Approvals.
- Migration status (`/admin`) needs no sign-in; the FileMaker GUI's "Open Admin Dashboard" links to it.

## Backups

| Copy | Where | Kept | Encrypted |
|---|---|---|---|
| Nightly database dump | Server, `~/backups/rat/db` | 14 days | No |
| Weekly photo store archive | Server, `~/backups/rat/storage` | 4 weeks | No |
| Daily pull of the database dumps | Developer's PC, `D:\backups\rat_oci\db` | 60 days | No |
| Encrypted database dumps | Google Drive, "RAT backups" | 30 days | Yes (gpg AES-256) |

Technical detail: `DEVOPS.md` §10.
