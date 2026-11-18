# CLAUDE.md

## 0. This project

**Tingbits Expense Tracker** (short: **Tingbits**): a household expense tracker for everyday spending, used mostly on phones. *Tingbits* is Bisaya slang for the broke days before payday; the product exists to end them (`docs/saas-analysis.md` §0). Renamed from "Bacli Expenses" on 2026-11-10.

Built from the EXCOM Agency Kit v3.0.0 (`../excom-agency-kit-v2/agency-kit/CLAUDE.md`). This is a solo, owner-run product, so the kit's agency process (client gates, change requests, per-diff review agents, per-fix paperwork) does not apply. **Where this file and the kit differ, this file wins.**
**Kit profiles: SaaS = Landing (`/`) + Web App (`/app`) + Payments.** Each page follows its own profile's motion ceiling and performance budget.

Approved decisions (details and reasons in `docs/decisions/`):

- Data lives in MongoDB (`MONGODB_URI` in `.env`), accessed only through Nuxt server routes. (ADR-001)
- Household accounts: email + password. The first person creates a household; others join with an invite code. One shared ledger per household. (ADR-002)
- Tailwind CSS 4 is the only styling tool. No component library, no second CSS tool, no CSS-in-JS. (ADR-003)
- Works with bad signal: last data cached on the device, offline changes queued and sent later. (ADR-004)
- Mongoose types are hand-written interfaces in `server/models`; never `InferSchemaType` (type check slows down). (ADR-005)
- Hosting: Vercel, functions in `hkg1` next to the Atlas cluster (`ap-east-1`). Merging a PR to `main` deploys to production (Vercel Git integration); the owner's merge is the go-ahead. Claude never merges or runs `vercel --prod` without being asked. (ADR-006)
- SaaS: public landing at `/` (prerendered, indexable), the app under `/app` (client-only, noindex). Direction A "Listahan". ₱150/month per household. (ADR-007, `docs/CREATIVE_DIRECTION.md`)
- Trial and subscription: 30-day no-card trial, then read-only (server returns 402) until paid; access is date-based (`trialEndsAt`, `paidThrough`). (ADR-008)
- Motion: Level 1 (functional feedback). One signature moment: the safe-to-spend figure settles on its new value. Only transform/opacity/clip-path animate; no motion libraries.
- Signature idea: "Safe to spend today" (what is left of the budget this morning, spread over the remaining days), shown with the Day Strip chart.

## 1. Where things are

| Read this | Before |
|---|---|
| `docs/project-overview.md`, `docs/business-rules.md` | any domain or business-logic work |
| `docs/architecture.md` | structural changes |
| `docs/ui-design.md` | significant UI work |
| `docs/api.md`, `docs/database.md`, `docs/security.md` | endpoint, data or auth work |
| `docs/development.md` | running, testing, deploying |
| `docs/runbook.md`, `docs/threat-model.md` | anything touching production or operations |
| `docs/PROJECT_STATUS.md` | "what's next" or "what's verified" questions |

Business rules marked **Proposed** in `docs/business-rules.md` are not confirmed; never treat them as approved and never invent new ones.

## 2. Stack

Nuxt 4, Vue 3 (`<script setup>`, Composition API), strict TypeScript, Tailwind CSS 4, Lucide (`@lucide/vue`), Pinia, Nitro server routes on Node, MongoDB with Mongoose, Vitest, Playwright. Check `package.json` before assuming a dependency or script exists. Add a dependency only when the existing stack cannot do the job, and say why.

## 3. Architecture

Flow: component → composable / Pinia → `/api` route → service → model → MongoDB. Skip layers that add nothing.

- `app/`: pages, components, composables, the Pinia store (`app/stores/ledger.ts`). Stores call the API through one request helper, never the database.
- `shared/`: domain types (`shared/types/`) and pure functions both sides use (dates, money, budget math, validation in `shared/utils/`). Write them once; never copy them.
- `server/api/`: HTTP concerns only. `server/services/`: business logic and the DB connection (`db.ts`). `server/models/`: Mongoose schemas. `server/utils/`: session, validation, rate limit, security log.
- No separate backend (Express, Fastify, Nest).

## 4. Rules that protect data (never relax these)

**Validation.** Every route validates input on the server with the shared validators: `readValid(event, validateX)` for bodies, `checkValid` for other input, `routeId(event)` for `:id` params (`server/utils/validation.ts`, validators in `shared/utils/validate.ts`). Client validation is UX only.

**Authorization.** Every query is scoped to the signed-in user's household; owner-only actions are checked on the server. Never trust IDs, roles, household ownership or amounts sent by the client. Never pass raw client objects into Mongoose filters.

**Auth.** Passwords hashed with Node `scrypt`; sessions are sealed cookies via h3 `useSession` with a session version (a password change signs out other devices). Details in `docs/security.md`. Don't add another auth system.

**Secrets and errors.** Secrets only in private `runtimeConfig`, never `public`, never committed (`.env` is git-ignored). Never return stack traces, raw DB errors, password hashes or tokens. Errors use `createError({ statusCode, statusMessage, data: { code, fields? } })`; status codes: 400 validation, 401 auth, 402 subscription expired, 403 forbidden, 404, 409/422 business rule, 500, 503 database unreachable. On the client a network failure is not an error: the change is queued and the offline badge shows.

**Personal data.** Collect only what the feature needs. No personal data in URLs or log text. Changing what is collected or who can see it needs the owner's approval and an updated privacy notice (`docs/privacy-notice-draft.md`).

**MongoDB.** Load transactions by date range; paginate or limit anything that can grow. Add indexes only for real query patterns. No aggregation pipelines unless needed.

## 5. UI

Phone first (390 px), sidebar from 1024 px, light and dark. No component library; use native elements plus the in-house pieces:

| Need | Use |
|---|---|
| Buttons | `<button>` with `.btn`, `.btn-primary`, `.btn-ghost`, `.btn-danger`, `.icon-btn` |
| Inputs, selects | native `<input>` / `<select>` with `.field` and a visible `<label class="label">` |
| Toggle chips | `<button class="chip" :aria-pressed>` |
| Dialog / bottom sheet | `BaseSheet.vue` (native `<dialog>`) |
| Toast with undo | `useToast()` + `ToastHost.vue` |
| Entry lists | `TxList.vue` |
| Charts | `DayStrip.vue`, `CategoryBars.vue`, `TrendBars.vue` (plain HTML, no chart library) |

- Colors come from tokens in `app/assets/css/main.css` (`bg-surface`, `text-ink-2`, `border-line`, `text-critical`…), never raw hex. One data hue (blue); status colors only for their meaning, always with an icon and text.
- Every interactive control: native element or correct ARIA role and keyboard behavior, a label, a visible `:focus-visible` ring, 44×44 px targets for primary actions, and hover/focus/disabled/invalid (`aria-invalid` + `aria-describedby`)/selected states.
- Handle loading, empty, error, offline and success states. Tabular numbers for money.
- No em dashes in visible copy (EXCOM voice rule). No gradients, blobs or decorative motion.
- Make a new shared component only when the same markup is needed in two places. For a major new screen, propose the layout before building it.

## 6. How to work

The loop: **understand → build → verify → PR (CI + Vercel preview) → owner merges (deploys) → smoke test.**

- **Small change:** just do it, verify, report. No plan, no paperwork.
- **Medium or large change:** first state the approach, files affected, data/API impact and how it will be verified. Wait for the owner's yes.
- **Investigate first:** read the relevant code and docs, reuse existing helpers and patterns. Existing conventions beat personal preference.
- **Stay in scope:** fix what was asked. Mention unrelated problems in the summary instead of fixing them.
- **Owner decisions are asked, never assumed:** business rules, prices, legal or privacy wording, data retention, who sees what. Offer a recommended default.
- **Agents:** do the work directly. Use the paladin agent only for diffs touching auth, roles, data access, payments, imports/exports or personal data.

## 7. Verify

- `npm run typecheck`, `npm run test:unit`, and for anything user-facing `npm run test:e2e -- --project=mobile-chrome --project=mobile-safari`. There is no linter.
- Add or update tests for business logic (money math, household isolation, subscription access). Never change a test to make wrong code pass.
- Unit and e2e tests use an in-memory MongoDB, never the real database.
- UI changes: look at the rendered page at 390 px and desktop, light and dark. Also check tablet (768×1024) when the change touches layout or breakpoints (a new screen, a sheet, a chart, navigation) and before a minor or major release. Visual baselines are macOS renders; run `tests/e2e/visual.spec.ts` locally before merging UI changes.
- Report only what actually ran, with real results, and say what was not checked.

## 8. Git, production and destructive actions

- Branches `feat/…`, `fix/…`, `chore/…`, `docs/…` from `main`; changes reach `main` only through a PR with green CI. Never push directly to `main` (it deploys untested).
- Commit, push and open PRs only when the owner asks. Commit only the files that belong to the change. Never commit `.env`.
- Ask first before: force push, `git reset --hard`, deleting branches or files you didn't create, discarding uncommitted work, anything against the production database, changing Vercel/Atlas settings or production env vars, buying anything.
- On the real database: prefer read-only checks; test records only with the owner's approval, clearly labelled, deleted afterwards and confirmed gone.

## 9. Docs

Update docs in the same change when business rules, data model, API, auth, permissions, personal data or deployment change: the matching file in `docs/` (see §1), plus an ADR in `docs/decisions/` for a significant architectural decision (Status, Context, Decision, Alternatives, Consequences, Date). Update `docs/PROJECT_STATUS.md` at milestones, not for every fix. Release notes (`docs/releases/`) only for minor and major versions. Never document behavior that doesn't exist; mark unconfirmed items **Proposed**.

## 10. Summary at the end of a task

Keep it short: what changed and why, key files, checks actually run (and what wasn't), docs updated, open issues and decisions needed, assumptions made.
