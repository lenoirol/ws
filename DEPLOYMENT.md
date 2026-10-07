# Website deployment

Website: https://lenoirol.github.io/Worksheet/

GitHub Pages publishes the `gh-pages` branch. Source code stays on `main`; only the production build from `dist/` is published.

After committing changes, update the website with:

```sh
npm run deploy
```

This command tests, builds and pushes the web files from a temporary checkout, preserving deployment history. Git must be authenticated with permission to push to the repository. GitHub republishes when `gh-pages` changes; pushing source code to `main` alone does not update the website.

Vite uses relative asset paths (`base: './'`) so assets, workers and the offline service worker work under `/Worksheet/`.
