# EXCOM Web-App Reference

How EXCOM builds **web applications**: signed-in users, data stored on a server, real business rules. It complements the agency kit (which is written for websites and landing pages) and the project rules template `CLAUDE.md`.

Written from building Bacli Expenses v2 (2026-11). Every pattern here was implemented and tested in that project; file paths point to working examples there.

---

## 1. When this applies
Use this reference when a project has **any** of: user accounts, private data, data shared between users, server-side business rules, or a database. For brochure sites and landing pages, follow the kit's website flow instead.

Before building, the brief must answer: who signs in, what they own, who can see what, what must work offline, and where the data lives. Each answer becomes a line in `docs/business-rules.md` marked **Approved**. Anything assumed is marked **Proposed** until the client confirms.

## 2. Stack
| Layer | Default | Notes |
|---|---|---|
| App framework | Nuxt 4, Vue 3, TypeScript strict | One full-stack app. No separate Express/Nest backend. |
| Styling | **Tailwind CSS 4 only** | Design tokens as CSS variables in `main.css`, exposed to Tailwind with `@theme inline`. |
| Components | In-house, on native elements | No PrimeVue or other component library unless the client already uses one. See §6. |
| Icons | Lucide (`@lucide/vue`) | |
| State | Pinia (`@pinia/nuxt`) | Shared client state only. Never database logic. |
| Server | Nuxt server routes (Nitro) | |
| Database | Chosen per project. MongoDB + Mongoose is an approved option. | Record the choice in an ADR. |
| Auth | Built-in: h3 `useSession` + Node `scrypt` | No auth library needed for email/password. Use OAuth or a provider only when required. |
| Unit tests | Vitest | Server services run against `mongodb-memory-server` (or the chosen DB's in-memory/test container). |
| E2E | Playwright: Chromium, Pixel 7, iPhone 13 (WebKit), Firefox | Against the **production build** with a throwaway database. |

Install nothing else without the dependency checklist in `CLAUDE.md` §18.

## 3. Folder blueprint
```
app/
  assets/css/main.css      tokens + .btn/.field/.chip/.card
  components/              small in-house components (BaseSheet = native <dialog>)
  composables/             useToast, UI-only helpers
  layouts/                 app shell (loading / unreachable / offline states live here)
  middleware/auth.global.ts  route guard (UX only; the server enforces access)
  pages/
  stores/<domain>.ts       Pinia: state, optimistic actions, outbox, cache
  utils/api.ts             toApiFailure(): one place that reads API errors
server/
  middleware/01.api-guard.ts  JSON-only writes, same-origin, DB connect → 503
  api/**                   routes: auth → validate → service → response
  services/**              business logic, plain TS, explicit imports (testable)
  models/index.ts          schemas + hand-written interfaces
  utils/                   session.ts (appSession, requireAuth, requireOwner), validation.ts, rateLimit.ts
shared/
  types/                   domain + API types used by both sides
  utils/                   pure logic + validators used by both sides
tests/unit/ tests/e2e/ scripts/e2e-server.mjs
docs/ (see §10)
```

## 4. Data flow and layering
`Component → Pinia store → $fetch → server route → service → model → database`

- **Routes** do HTTP only: `requireAuth`, `readValid(event, validator)`, call a service, set the status.
- **Services** hold the rules and take the tenant id (household/organization) as their first argument. Every query filters by it.
- **Services must not use Nuxt auto-imports.** Import `createError` from `h3`, models from `../models` and shared code from `#shared/...`. That is what lets Vitest run them directly.
- **Shared validators** (`shared/utils/validate.ts`) return `{ ok, value } | { ok: false, fields }`. The same function powers form hints and the server boundary. Whitelist fields, check id format (stops `$ne`-style operator injection) and cap sizes. No validation library needed.
- **One error shape:** `createError({ statusCode, statusMessage, data: { code, fields? } })`. The client turns any failure into `{ status, code, message, fields }` in one helper. Status 0 means "never reached the server".

## 5. Auth and multi-tenancy (the pattern that worked)
- Accounts belong to a tenant (household, team). The first account creates it and becomes **owner**. Others join with an invite code (unambiguous alphabet, owner can renew it).
- Session cookie: `httpOnly`, `sameSite: 'lax'`, `secure` set **from the request protocol** (`getRequestProtocol(event, { xForwardedProto: true }) === 'https'`). A hard-coded `secure: true` breaks plain-http local runs in Safari.
- `requireAuth` reloads the user from the database on every request. Roles come from the database, never from the client.
- Same error and similar timing for unknown email and wrong password (hash a dummy password).
- **Cross-site protection without tokens:** reject state-changing requests that are not `application/json` (HTML forms cannot send that) or whose `Origin` is another site.
- Rate-limit sign-in and sign-up. Make the limit **configurable** (`runtimeConfig`) so tests can raise it; never switch it off for tests. In-memory limits are per instance on serverless hosts; say so in `docs/security.md`.
- A cheap public `GET /api/auth/session → { signedIn }` lets the client decide signed-in or out without a 401 showing up in the console.

## 6. UI without a component library
- Native first: `<dialog>` with `showModal()` for sheets (gives focus trap, Escape and the top layer for free), `<select>`, `<input type="date">`, `<button aria-pressed>` for chips and segmented controls.
- Every control needs a role, a label, a visible focus ring, a 44 px target for primary actions, and hover, disabled, invalid (`aria-invalid` + `aria-describedby`) and selected states.
- One toast host with optional **Undo** beats confirmation dialogs for reversible actions.
- App-shell states are part of the design: loading (first load only), unreachable (no cache), offline badge, saving.
- Buttons that open sheets: tests must wait for the sheet's entrance animation (`el.getAnimations()`) before clicking inside it.

## 7. Offline-capable data (when the brief needs it)
Use for field and mobile apps. Skip for admin back-offices that are always online.
- **Optimistic store + persisted outbox.** Apply the change locally, push `{method, url, body}` into an outbox in localStorage, and send in order.
  - network error (status 0): keep and retry on `online` / foreground / interval
  - 5xx or 429: keep
  - 401: sign out
  - other 4xx: drop, tell the user, resync
- **Make every write retry-safe:** client-generated ids with idempotent creates. State transitions carry the state they expect (`{ from: '2026-11-09' }`). Server-generated rows use deterministic ids (`<parentId>:<date>`).
- **Cache the last bootstrap** on the device so the app opens instantly and offline. Clear it on sign-out.
- **Three bugs found the hard way:**
  1. Clear "in-flight" promise markers in `.finally()`, never inside the async body (a body that finishes synchronously clears it *before* it is assigned, and the queue stalls forever).
  2. Version local changes and **discard a refresh response that started before the latest change**, or a slow response overwrites newer edits.
  3. On `pagehide` / hidden, **queue only, don't send**. Requests started during unload are cancelled (WebKit logs "access control checks").
- Debounced auto-save needs a flush on `pagehide`, or edits made just before closing are lost.

## 8. Database (MongoDB + Mongoose specifics)
- **Write document interfaces by hand** and use `new Schema<T>()` / `Model<T>`. `InferSchemaType` with `lean<T>()`/`bulkWrite` made `nuxt typecheck` run 10+ minutes and run out of memory; with interfaces it takes about 5 seconds. Don't "fix" this by raising Node's memory.
- Store money as integer minor units. Store calendar dates as `YYYY-MM-DD` strings. Store the tenant's IANA time zone and compute "today" on the server with `Intl.DateTimeFormat('en-CA', { timeZone })`.
- Index by actual query patterns only (`{ tenant: 1, date: -1 }`). Document each index's query in `docs/database.md`.
- Use `returnDocument: 'after'` (the `new: true` option is deprecated in Mongoose 9).
- Ids are global: an import into another tenant must re-key colliding ids (stable `<tenantId>:<id>`), or the data is silently skipped.
- Accept the platform's env var name too (`MONGODB_URI`) as well as Nuxt's (`NUXT_MONGODB_URI`), read at runtime.

## 9. Configuration and security baseline
- Secrets only in private `runtimeConfig`. `.env.example` lists names with generation hints, never values.
- Security headers in `nuxt.config.ts` `routeRules['/**'].headers` (works on any host), plus `Cache-Control: no-store` on `/api/**`.
- Service worker: cache the shell and hashed assets; **never cache `/api/`**.
- **TypeScript:** use Nuxt 4's split configs. Root `tsconfig.json` = `{ "files": [], "references": [app, server, shared, node] }`, and add `@types/node`. With the old single `extends`, server code is checked with browser types and shared code can wrongly use `window`.

## 10. Documentation set
| Doc | Holds | Kit equivalent |
|---|---|---|
| `CLAUDE.md` | How to work (rules), plus a short "This project" section with approved decisions | project `CLAUDE.md` |
| `docs/project-overview.md` | Product, users and roles, modules, terms, workflows, boundaries | `CLIENT_BRIEF.md` (business part) |
| `docs/business-rules.md` | Rules with **Approved / Proposed** status | (new) |
| `docs/architecture.md` | Layers, data flow, deployment | `TECHNICAL_SPECIFICATION.md` |
| `docs/database.md` · `docs/api.md` · `docs/security.md` | Schemas and indexes · endpoints and errors · auth model and gaps | `TECHNICAL_SPECIFICATION.md` (split) |
| `docs/ui-design.md` | Tokens, components, feedback patterns | `DESIGN_SPECIFICATION.md` |
| `docs/development.md` | Env vars, real commands, deploy, troubleshooting | `LAUNCH_HANDOVER.md` (dev part) |
| `docs/decisions/ADR-NNN-*.md` | Significant decisions | (new) |
| `docs/PROJECT_STATUS.md` · `docs/realization.md` | Verified / not verified · lessons | same |

## 11. Verification checklist (definition of done for web apps)
- [ ] `typecheck` passes in under a minute (if not, look for type inference blow-ups).
- [ ] Vitest: shared rules (dates, money, validation) + every service, with tenant-isolation tests (another tenant cannot read, update, delete or claim an id).
- [ ] Playwright on the production build in 4 browsers, with a throwaway database. Each test signs up its own tenant.
- [ ] Journeys: sign-up, in and out; signed-out redirect + API 401; create/edit/delete/undo **verified from a fresh device** (clear localStorage, reload); second user joins and sees shared data; another tenant sees nothing; offline queue then sync; settings survive an immediate reload; import/export; bad input rejected.
- [ ] No console errors on any screen; no CSP violations; headers present; cross-site form post rejected.
- [ ] Screenshots at 390, 768 and 1440, light and dark, including empty, error and offline states.
- [ ] Never run tests against the client's real database. Confirm the real database connects with a read-only call.
- [ ] `docs/` and ADRs updated; Proposed rules listed for the client.
