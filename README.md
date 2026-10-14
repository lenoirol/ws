# WS by Phu Huy Nguyen

A small web app for making printable word puzzles for the classroom: **word search**, **word scramble** and **crossword**. Paste a word list, pick a style, and you get a clean worksheet plus an answer key.

Live site: https://phuhuynguyen.pages.dev

## What it does

- **Word search**: grids from 5×5 to 100×100, with the directions you allow (from across-and-down only to all eight).
- **Word scramble**: each word is scrambled on its own and never comes out unchanged. You can keep the first letter and show starter letters.
- **Crossword**: numbered grid with Across/Down clues. With no clues it prints a word bank instead.
- **Combined sheets**: any two puzzles from the same word list, in one PDF, with the answer keys at the end.
- **Clues**: write `word | clue`, or paste two columns from a spreadsheet.
- **Copies**: up to 50 different puzzles at once, one per student. The same words and seed always give the same sheet.
- **Page setup**: title, name line and footer; A4, Letter or A3; portrait or landscape.
- **Output**: PNG (150/300/600 DPI), vector PDF, direct print, or the share sheet on phones.

Puzzles are generated in your browser and the words you type are never uploaded.

## Running it locally

You need Node.js and npm.

```sh
npm install
npm run dev        # http://localhost:5173
```

Other commands:

```sh
npm test           # unit tests
npm run typecheck
npm run build      # type-check + production build in dist/
```

The puzzle maker works with no backend. To try accounts and saved projects, copy `.env.example` to `.env`, fill in the Supabase URL and anon key, or run Supabase locally in Docker (`npm run db:start`). Details are in [supabase/README.md](supabase/README.md).

## Project layout

```
src/core     puzzle generation (word search, scramble, crossword), no UI
src/layout   turns a puzzle into page drawing operations
src/render   draws those operations to canvas / SVG
src/export   PNG, PDF, print and share
src/ui       React app, panels and admin console
src/account  Supabase client, projects, session log
supabase     database migrations and setup notes
dev          preview page used while tuning the layout
```

More: [SPEC.md](SPEC.md) is the original design spec, [DEPLOYMENT.md](DEPLOYMENT.md) covers publishing on Cloudflare Pages, and `reference/NOTES.md` has the measurements taken from the sample PDFs.
