# ADR-007: Public landing page at `/`, the app under `/app`

## Status
Accepted (2026-11-10, owner approved Direction A and asked to build)

## Context
Bacli is becoming a SaaS (`docs/saas-analysis.md`). Visitors need a public page that explains the product, ranks in search and loads fast on phones. The app was a client-only SPA at `/` (ADR-001) whose screens hold private data.

## Decision
- **Hybrid rendering:** global `ssr: true`. `/` is server-rendered and **prerendered** to static HTML. `/app`, `/app/**` and `/login` keep `ssr: false` (rendered in the browser) and send `X-Robots-Tag: noindex`. `robots.txt` disallows `/app`, `/login` and `/api/`.
- **Routes:** the app moved from `/`, `/history`, ... to `/app`, `/app/history`, `/app/insights`, `/app/plan`, `/app/settings`. The manifest `start_url` and shortcuts point to `/app`.
- The auth middleware ignores public routes and never runs on the server.
- The landing page's "Open app" check uses `GET /api/auth/session`, which no longer connects to the database (cookie only).
- Fonts: Fraunces 600 self-hosted with `@fontsource/fraunces` (OFL-1.1) and preloaded. The CSP stays `'self'`-only (no Google Fonts).
- The service worker caches two entry pages: `/` (landing) and `/app` (the app shell for every `/app/*` screen).

## Alternatives Considered
- **Keep the SPA and render the landing page in the browser:** worse for search and first load; content invisible without JavaScript.
- **A separate marketing site** (another repo or host): two deployments, duplicated tokens and fonts.
- **Server-render the app too:** no benefit for private screens, and hydration risk with the device cache.

## Consequences
- Old bookmarks to `/history` and similar now 404 (no installs exist yet).
- Landing-page components must be SSR-safe: no `window` or `localStorage` during render, and no locale-dependent formatting (prices use `en-PH` explicitly).
- Tests cover: no-JS render, indexability split, structured data, calculator, CTA flow, "Open app", CSP and console.

## Date
2026-11-10
