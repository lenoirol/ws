# Website deployment

Website: https://phuhuy.live

The site is a static build hosted on GitHub Pages. [.github/workflows/pages.yml](.github/workflows/pages.yml) runs the tests, builds the site and deploys `dist` on every push to `main`. `public/CNAME` keeps the custom domain `phuhuy.live` attached to the site.

## Repository settings

- **Settings → Pages → Source**: GitHub Actions.
- **Settings → Pages → Custom domain**: `phuhuy.live`, then tick **Enforce HTTPS** once the certificate is issued.
- **Settings → Secrets and variables → Actions → Secrets**: `VITE_SUPABASE_URL` (Supabase → Project Settings → API) and `VITE_SUPABASE_ANON_KEY` (the `anon` / publishable key, never `service_role`). Vite reads them at build time, so changing them needs a new deploy.

Without them the app still builds and makes puzzles, but accounts and saved projects are switched off.

## DNS (at the domain registrar)

| Type | Name | Value |
|---|---|---|
| A | `@` | `185.199.108.153` |
| A | `@` | `185.199.109.153` |
| A | `@` | `185.199.110.153` |
| A | `@` | `185.199.111.153` |
| CNAME | `www` | `lenoirol.github.io` |

## Supabase

In Supabase → Authentication → URL Configuration, set the Site URL to `https://phuhuy.live` and add `https://phuhuy.live` and `https://www.phuhuy.live` to the Redirect URLs (keep `http://localhost:5173` for development).

## Notes

Vite uses relative asset paths (`base: './'`), so assets, workers and the offline service worker work from the site root.
