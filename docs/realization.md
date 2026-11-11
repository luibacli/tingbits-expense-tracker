# Realization: Bacli Expenses (v1 to v2)

Lessons at a project milestone. They feed kit improvements and change nothing in the approved scope.

- Date: 2026-11-09
- Kit version used: 2.1.0 (plus the owner's web-app CLAUDE.md, revised: Tailwind only, no PrimeVue)
- Milestone / outcome: v1 (device-only static PWA) became v2 (MongoDB, household accounts, offline outbox). Type check, 25 unit tests and 84 end-to-end tests pass. Waiting for owner acceptance and deployment approval.

## 1. Verdict on the kit
The kit carried the **website** half well: the Nuxt starter, security headers, 4-browser Playwright, voice rules and the anti-generic signature-idea test all paid off directly ("Safe to spend today" + the Day Strip came from that test). It fell short as soon as the project became a **web application**:

- The kit has no guidance for accounts, tenancy, a database, server validation, error formats or offline data. The starter's `/app` page only says "add these after the requirements are documented".
- The kit's doc set (`CLIENT_BRIEF`, `TECHNICAL_SPECIFICATION`, ...) and the owner's web-app CLAUDE.md doc set (`project-overview`, `business-rules`, `architecture`, `database`, `api`, `security`, ADRs) overlap but use different names. We had to decide the mapping ourselves.
- The starter assumes static output: `vercel.json` is the source of headers, `serve-static.mjs`, `_headers` for Cloudflare. A server app had to move headers into `routeRules` and delete those scripts.
- The starter's single `tsconfig.json` `extends` checks server code with browser types. Nuxt 4's split configs (`references`) are needed as soon as `server/` has real code.

## 2. What worked (keep doing)
| What | Why it worked |
|---|---|
| Shared validators in `shared/utils/validate.ts` | One function for form hints and the server boundary; also blocked operator injection by checking id format |
| Services with no Nuxt auto-imports | Vitest runs them directly against `mongodb-memory-server`; found the cross-household import bug in seconds |
| Throwaway database for every test run (`scripts/e2e-server.mjs`) | Full journeys on the production build in 4 browsers without touching the client's database |
| Each e2e test signs up its own tenant | Tests run in parallel and never share data |
| Asking the one real decision up front (sign-in model) | Everything else had a sensible default; the owner answered once and the build didn't stall |
| Approved vs **Proposed** business rules | Assumptions are visible to the client instead of hiding in code |
| Built-in auth (h3 `useSession` + `scrypt`) | No auth dependency; small, auditable code |
| Verifying "persisted" by clearing localStorage and reloading | Proves the data came from the server, not from the device cache |

## 3. What we realized about making the app better
- **Offline is a design decision, not an add-on.** For a phone app used in shops and on jeepneys, an optimistic store with a persisted outbox kept the v1 "it just works" feel after adding a server.
- **Retry-safe writes are what make offline possible:** client ids, idempotent creates, transitions that carry their expected state (`from`), deterministic ids for server-generated rows.
- **Async edge cases only showed up under real browsers.** Three real bugs were found by the e2e suite, not by reading the code:
  1. An in-flight marker cleared inside an async body that ran synchronously stalled every save.
  2. A stale refresh could overwrite a newer edit.
  3. Debounced settings were lost when the page closed within 600 ms, and sending during unload is cancelled (WebKit logs "access control checks").
- **WebKit refuses `Secure` cookies on plain http.** Set `secure` from the request protocol.
- **Global ids plus imports:** restoring a backup into a different tenant silently skipped everything until colliding ids were re-keyed.
- **Type-check performance is a real risk.** Mongoose `InferSchemaType` made `nuxt typecheck` run 10+ minutes and run out of memory. Hand-written interfaces brought it to about 5 seconds. Raising the memory limit was the wrong first move.
- **Don't weaken security for tests:** the sign-up rate limit broke the suite; making it configurable kept it on everywhere.

## 4. What we realized about selling the work
- "Works offline" and "shared between phones" are the features a household understands. Lead with them, not with the stack.
- Moving from device-only to a server changes the promise: hosting is no longer "no monthly fees" by default (database plus server functions). Price and state who owns the Atlas and Vercel accounts.
- Assumed rules (who can delete, who can invite) need client sign-off. The Proposed list is a ready-made agenda for that call.

## 5. Recommended kit improvements
| # | Priority | Improvement | Where in the kit | Problem it prevents |
|---|---|---|---|---|
| 1 | P1 | Add a web-app standard (this project's `docs/web-app.md`) | `agency-kit/standards/WEB_APP.md` | Every web app re-inventing auth, tenancy, validation, errors and offline |
| 2 | P1 | Add the revised web-app CLAUDE.md as a template (Tailwind only, no PrimeVue, kit-aligned) | `agency-kit/templates/CLAUDE_WEB_APP.md` | Rules drifting between projects; the PrimeVue/Tailwind conflict |
| 3 | P1 | Map the web-app doc set to the kit doc set, add `business-rules.md` with Approved/Proposed and ADRs | `CLAUDE.md` → Project documentation; `templates/` | Two naming schemes; assumptions hidden in code |
| 4 | P1 | Web-app gates: decide sign-in model, tenancy, data location and offline need at discovery | `OPERATING_MODEL.md`, `prompts/01-business-discovery.md` | Building a static app and then rebuilding its data layer |
| 5 | P2 | Testing rules for web apps: throwaway DB, tenant-per-test, verify persistence from a fresh device, never test against the client DB, configurable (not disabled) limits | `standards/ENGINEERING_STANDARDS.md` | Flaky shared-state tests; touching production data; weakened security |
| 6 | P2 | Security baseline for apps: JSON-only + Origin check, cookie `secure` from protocol, per-instance rate-limit caveat, tenant scoping in every query | `standards/SECURITY_PRIVACY.md` | CSRF gaps; Safari sign-in failures; cross-tenant leaks |
| 7 | P2 | MongoDB/Mongoose and Atlas cost notes as an approved backend option | `TECHNOLOGY_AND_COST_POLICY.md` | Unpriced database costs; type-check blow-ups |
| 8 | P2 | Starter: Nuxt 4 split `tsconfig` references + `@types/node` | `nuxt-starter/tsconfig.json`, `package.json` | Server code type-checked as browser code |
| 9 | P3 | Starter: optional web-app add-on (auth utils, api-guard middleware, outbox store) as a copyable folder | `nuxt-starter/` or `agency-kit/web-app/` | Re-typing the same 400 lines per project |

**Applied in EXCOM Agency Kit 2.2.0 (2026-11-09):** items 1 to 8. Item 8 was verified on a clean starter copy (`npm ci`, type check, build). Item 9 is not done yet. A backup of kit 2.1.0 was kept before editing because the kit is not under git.

## 6. Follow-ups for this project
- Owner: confirm the Proposed rules; create the first account against the real database; approve the Vercel deployment and Atlas network access.
- Build next (if approved): password reset (email provider), remove a member or transfer ownership, shared rate-limit store.
- Visual QA still missing at 768 px and desktop for the new screens, and Lighthouse.
