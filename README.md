# Want List

Ashton's Pokémon card want list: collections, binders with page scanning, an Explore feed of every
card with live search, and daily TCGplayer prices. Installable on iPhone as a home screen app.

Live at https://ashtonlance.github.io/want-list/

## Stack

- React 19 and TypeScript (strict) on Vite
- TanStack Router (file routes in `src/routes`) and TanStack Query for all server data
- Supabase for sign-in (magic link) and storage: tables `cards`, `discover`, `layouts`, `editors`
  and the `photos` bucket, created by `setup.sql`
- tesseract.js, loaded only on the scan screen, reads card numbers from binder page photos
- GitHub Pages, deployed by GitHub Actions

## Setup

Needs Node 22 or later.

```sh
npm install
npm run dev
```

The dev server opens at http://localhost:5173/want-list/. It talks to the real Supabase project,
whose URL and public anon key are read from `config.js` at build time. Signing in works locally once
`http://localhost:5173/want-list/` is added to the Redirect URLs in Supabase (Authentication, URL
Configuration).

Anyone can read the list. Only the emails in the `editors` table can change it.

## Scripts

| Script                 | What it does                      |
| ---------------------- | --------------------------------- |
| `npm run dev`          | Dev server with hot reload        |
| `npm run build`        | Type check, then build to `dist/` |
| `npm run preview`      | Serve the built `dist/` locally   |
| `npm test`             | Unit tests (Vitest)               |
| `npm run lint`         | ESLint with type-aware rules      |
| `npm run typecheck`    | TypeScript only                   |
| `npm run format`       | Prettier, writing changes         |
| `npm run format:check` | Prettier, checking only           |

`BASE_PATH=/some/path/ npm run build` builds for a different base path than `/want-list/`.

## Layout

```
src/
  main.tsx          app entry: query client, router
  routes/           file routes (the route tree is generated into routeTree.gen.ts)
  app/              shell: top bar, tab bar, sheets opened from the URL, section memory
  data/             typed Supabase document tables, query keys, realtime sync
  features/
    auth/           sign-in, editor check, account sheet
    cards/          card data, prices, quick add, card sheet
    list/           My list: collections, filters, bulk select, collection binder view
    catalog/        catalog.json and prices.json loading, feed order, search
    explore/        Explore: every-card feed, live search, Picks
    binders/        Binders and their pages
    scan/           Binder page scanning (OCR matched against the catalog)
  lib/              small shared helpers (storage, stores, scroll restoration, Supabase client)
  ui/               shared components (sheet, lightbox, toast, images)
  styles/           global CSS, light and dark
public/             manifest and icons for the home screen app
tools/sync.mjs      daily catalog and price sync
```

Sheets (a card, a pick, sign-in, add, options) are search params on the current route, so the back
button and swipe-back close them, and scroll position is restored when you come back to a list.

## Data files

`catalog.json` (every English and Japanese card with its market price) and `prices.json` (price
detail for cards on the list and in Explore) sit at the repo root. `tools/sync.mjs` rebuilds both
from tcgcsv.com every day in `.github/workflows/sync.yml` and commits them to `main`. The build
copies them into `dist/`.

## Deploy

`.github/workflows/pages.yml` lints, tests, builds and publishes `dist/` to GitHub Pages on every
push to `main`, after each successful daily sync, and on demand from the Actions tab. The repo's
Pages source must be set to GitHub Actions (Settings, Pages, Build and deployment).

`404.html` is a copy of `index.html`, so deep links like `/want-list/binders` load the app.
