# Uptime monitors (UptimeRobot)

Three monitors, because the website and the server can fail separately: the site's pages come
from Vercel, while the data and photos come from the server (`huey`, via Tailscale Funnel). If
only the site were watched, a dead server would go unnoticed. All three work on the free plan: none
needs custom headers.

**Account:** created by the developer at uptimerobot.com, free plan. **Alert contacts:** the
developer's email and the head of RAT's email, both attached to every monitor.

| # | Friendly name | Type | URL | Interval | Down when |
|---|---|---|---|---|---|
| 1 | RAT site | HTTP(s) | `https://picaloco-web.vercel.app/` | 5 min | not 2xx |
| 2 | RAT server: search data | Keyword | `https://picaloco-web.vercel.app/api/health` | 5 min | keyword `"ok":true` **not present** |
| 3 | RAT server: photos | HTTP(s) | `https://huey.taila2eeb2.ts.net/storage/v1/object/public/picaloco/images/arc00001.webp` | 5 min | not 2xx |

**Monitor 2 watches the site's own health page**, `/api/health` (`api/health.ts`, logic and tests
in `lib/health.ts`). The server needs two headers (`apikey`, `Accept-Profile: rat`) that
UptimeRobot only sends on a paid plan, so the health page sends them instead: it asks the server
for one search row and answers

- `200 {"ok":true,"image_no":"…"}` when a row comes back;
- `503 {"ok":false,"reason":"…"}` otherwise: server unreachable, no answer within 10 s, an error
  status from the server, or no row. The reason says which.

It uses only the URL and anon key the site already ships (Vercel `VITE_SUPABASE_URL`,
`VITE_SUPABASE_ANON_KEY`); no secret is involved, and the answer never contains the key. It runs
on Vercel, so if Vercel itself is down monitor 2 goes down with monitor 1.

## Checked 2026-11-20 (curl, exactly as configured)

| Check | Result |
|---|---|
| Monitor 1 | 200 |
| Monitor 2: `api/health.ts` run against the live server (2026-11-21) | 200 `{"ok":true,"image_no":"gd790551"}`; HEAD 200 |
| Monitor 2 with the server address changed to a host that doesn't exist | 503 `{"ok":false,"reason":"server unreachable"}` (would alert) |
| Monitor 2 failure cases (no row, error status, not JSON, timeout, not configured) | `lib/health.test.ts`, each 503 |
| Monitor 3 | 200 image/webp, also via the server's public address `176.58.88.82` (the route UptimeRobot takes) |

## What each alert means (for the manual's Part 2)

| Alert | Plain meaning |
|---|---|
| 1 down (2 usually down too) | The website itself is unreachable. Vercel (the website host) or the internet. |
| 2 down, 1 and 3 up | Photos load but searches fail. The database part of the server has a problem. |
| 2 and 3 down | The server is unreachable: switched off, out of space, or the Tailscale link is down. |
| Any "up" email | It recovered by itself. Note the time; nothing else to do. |

Short blips (one down then up within 10 minutes) are normal for a free service and need no action.
