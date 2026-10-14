# Website deployment

Website: https://phuhuynguyen.pages.dev

The site is a static build hosted on Cloudflare Pages, connected to the `main` branch of this repository. Every push to `main` triggers a new build and deploy.

## Pages settings

| Setting | Value |
|---|---|
| Build command | `npm run build` |
| Build output directory | `dist` |
| Root directory | (empty) |

## Environment variables

Set these in the Pages project under **Settings → Variables and secrets** (Production). Vite reads them at build time, so changing them requires a new build:

| Name | Value |
|---|---|
| `VITE_SUPABASE_URL` | Project URL from Supabase → Project Settings → API |
| `VITE_SUPABASE_ANON_KEY` | The `anon` / publishable key (never the `service_role` key) |

Without them the app still builds and makes puzzles, but accounts and saved projects are switched off.

## Supabase

In Supabase → Authentication → URL Configuration, set the Site URL to the address above and add it to the Redirect URLs.

## Notes

Vite uses relative asset paths (`base: './'`), so assets, workers and the offline service worker work from the site root.
