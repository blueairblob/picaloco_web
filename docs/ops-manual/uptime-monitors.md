# Uptime monitors (UptimeRobot)

Three monitors, because the website and the server can fail separately: the site's pages come
from Vercel, while the data and photos come from the server (`huey`, via Tailscale Funnel). If
only the site were watched, a dead server would go unnoticed.

**Account:** created by the developer at uptimerobot.com, free plan. **Alert contacts:** the
developer's email and the head of RAT's email, both attached to every monitor.

| # | Friendly name | Type | URL | Interval | Down when |
|---|---|---|---|---|---|
| 1 | RAT site | HTTP(s) | `https://picaloco-web.vercel.app/` | 5 min | not 2xx |
| 2 | RAT server: search data | Keyword | `https://huey.taila2eeb2.ts.net/rest/v1/mobile_catalog_view?select=image_no&limit=1` | 5 min | keyword `image_no` **not present** |
| 3 | RAT server: photos | HTTP(s) | `https://huey.taila2eeb2.ts.net/storage/v1/object/public/picaloco/images/arc00001.webp` | 5 min | not 2xx |

**Monitor 2 needs two custom HTTP headers** (Advanced settings → Custom HTTP headers):

```
apikey: <anon key>          (the site's VITE_SUPABASE_ANON_KEY, from Vercel or .env.local)
Accept-Profile: rat
```

The anon key is public (it is in the site's own code), so it is safe here. Without the headers the
server answers 401 and the monitor would always show down.

**If the free plan doesn't offer custom headers:** skip monitor 2. Monitor 3 still catches the
server being down (the photo request passes through the same Funnel, gateway and database), so
only "server up but search broken" goes unwatched.

## Checked 2026-11-20 (curl, exactly as configured)

| Check | Result |
|---|---|
| Monitor 1 | 200 |
| Monitor 2 with headers | 200, body contains `image_no` |
| Monitor 2 without headers | 401, no keyword (would alert: headers are required) |
| Monitor 2 against a wrong host | connection fails (would alert) |
| Monitor 3 | 200 image/webp, also via the server's public address `176.58.88.82` (the route UptimeRobot takes) |

## What each alert means (for the manual's Part 2)

| Alert | Plain meaning |
|---|---|
| 1 down | The website itself is unreachable. Vercel (the website host) or the internet. |
| 2 down, 3 up | Photos load but searches fail. The database part of the server has a problem. |
| 2 and 3 down | The server is unreachable: switched off, out of space, or the Tailscale link is down. |
| Any "up" email | It recovered by itself. Note the time; nothing else to do. |

Short blips (one down then up within 10 minutes) are normal for a free service and need no action.
