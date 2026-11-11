# Architecture

## Overview
```
Phone/browser                                   Server (Nuxt / Nitro)                       Database
───────────────────────────────────────         ─────────────────────────────────────────   ─────────
Pages + components (Tailwind)                   server/middleware/01.api-guard.ts           MongoDB
   │                                              JSON-only writes, same-origin, DB connect   households
Pinia store app/stores/ledger.ts                server/api/**  (HTTP, validation, auth)     users
   │  optimistic update                            │                                        transactions
   │  outbox (localStorage) ──── $fetch ────────▶  server/services/** (business logic) ──▶  recurrings
   │  cache  (localStorage)  ◀── bootstrap ─────   server/models (Mongoose schemas)
shared/  types, dates, money, budget math, validators  (used by both sides)
```

- **Rendering (ADR-007):**
  - `/` is the public landing page: server-rendered and prerendered, indexable.
  - `/app/**` and `/login` are rendered in the browser only (private data) and marked `noindex`.
- **API:** Nuxt server routes. Routes do HTTP work only: they authenticate, validate with `shared/utils/validate.ts`, then call a service.
- **Services** (`server/services/`) are plain TypeScript with explicit imports and no Nuxt auto-imports, so Vitest runs them directly against an in-memory MongoDB.
- **Shared code** (`shared/`) holds the domain types and pure functions. The same validator runs in forms and at the server boundary.

## Data flow for a change
1. A component calls a store action (for example `addTransaction`).
2. The store updates local state at once (the UI never waits for the network) and pushes a request into the **outbox**, which is persisted to localStorage.
3. The outbox sends requests one at a time, in order:
   - success: removed
   - no network: kept, and the "Offline, N changes waiting" badge shows
   - 5xx or 429: kept and retried later
   - 401: signed out
   - other 4xx: dropped, the user is told, and the store reloads from the server
4. Retries are safe. Entry and recurring ids are created on the client, creates are idempotent, and pay/skip carry the due date they apply to (ADR-004).

## Reading data
- `GET /api/bootstrap` returns the account, household, recurring items and about 13 months of entries, and posts due automatic recurring items first.
- The last bootstrap is cached on the device, so the app opens instantly and offline.
- It refreshes when the app returns to the foreground, comes back online, and every 60 seconds while visible. This is how a partner's entries appear.
- A refresh that started before the latest local change is discarded, so a slow response cannot overwrite newer edits.
- Older periods (`ensureFrom`) and all-time search (`search`) load on demand.

## Deployment
Vercel functions in `hkg1`, next to the Atlas cluster in `ap-east-1` (ADR-006). Nitro auto-detects Vercel. Locally, `nuxt build` makes a Node server in `.output/` (`node --env-file=.env .output/server/index.mjs`). Needs `MONGODB_URI` and `NUXT_SESSION_PASSWORD` in the host's environment. Security headers come from `routeRules` in `nuxt.config.ts`, so they apply on any host. See `development.md`.

## Offline support
- `public/sw.js` caches the app shell and build assets and never caches `/api/`.
- User data offline is the store's cache plus the outbox.
