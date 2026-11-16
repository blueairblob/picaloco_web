# User menu (top right) — short design

Status: approved by the user 2026-11-16 ("Menu design OK").

## Why

On the live site there is no visible way to reach Data Fixes: the only route is a small grey
"Migration status" footer link, then a link on that page. Volunteers (many elderly) need an obvious,
conventional place for preferences and for signing in.

## What

A **Menu** button at the top right of the header, replacing the theme toggle there. It opens a
drop-down:

```
RAT Photo Archive                         [☰ Menu ▾]
                                           Theme: System / Light / Dark / Bespoke
                                           Text size: Normal / Large
                                           ─────────────
                                           Sign in (admin)
   when signed in as admin, instead:       <email>
                                           Data fixes
                                           Migration status
                                           Sign out
```

- **Theme:** the four existing themes, chosen directly (no cycling). Same storage key as today.
- **Text size:** Normal / Large, remembered per browser (localStorage, like the theme). Large scales
  the root font size by 1.125 on every page, on top of the review pages' own window scaling.
- **Sign in (admin):** goes to `/admin/fixes`, which already shows the sign-in form.
- **Signed in, not an admin:** shows the email and Sign out only.
- The footer "Migration status" link is removed (the menu replaces it).
- The email + Sign out bar that `RequireAdmin` draws above admin pages is removed; the menu carries
  both. This also gives that height back to the review photo.

## Approaches

1. **Drop-down menu in the header (chosen).** Conventional, one place for everything.
2. A separate Settings page plus a Sign in link: an extra page to visit for two settings.
3. Keep the theme toggle and add a Sign in link: doesn't give text size a home.

## Constraints / builder's calls

- Keyboard and screen-reader usable: button with `aria-expanded`, Escape and click-outside close it,
  items reachable by Tab. Touch targets at least 44px (existing `min-h-11` convention).
- Opening the menu must not trigger review-page keys (review keys already ignore events while focus is
  in a control; the menu items are buttons/links).
- Large text may make the review page scroll on small windows; accepted.
