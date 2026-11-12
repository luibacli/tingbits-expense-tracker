# Development

## Requirements
- Node.js 22.12+ (developed on 24) and npm.
- A MongoDB connection string. MongoDB Atlas free tier works.

## Setup
```bash
npm install
cp .env.example .env     # then fill in both values
npm run dev              # http://localhost:3000  (or: npm run dev -- --port 3001)
```

## Environment variables
| Name | Required | Purpose |
|---|---|---|
| `MONGODB_URI` (or `NUXT_MONGODB_URI`) | yes | MongoDB connection string, including the database name |
| `NUXT_SESSION_PASSWORD` | yes | 32+ random characters for the session cookie. Generate: `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"` |
| `NUXT_AUTH_RATE_LIMIT` | no | Sign-in/sign-up attempts per window (default 10) |

If the database is unreachable the API answers 503 `DB_UNAVAILABLE`, and the app keeps working from its device cache.

## Commands (from `package.json`)
| Command | Does |
|---|---|
| `npm run dev` | Dev server with hot reload |
| `npm run typecheck` | `nuxt typecheck` (app, server and shared tsconfigs) |
| `npm run test:unit` | Vitest: shared logic and server services against an in-memory MongoDB |
| `npm run test:e2e` | `nuxt build`, then Playwright in Chromium, Pixel 7, iPhone 13 (WebKit) and Firefox against an in-memory MongoDB (`scripts/e2e-server.mjs`) |
| `npm test` | Unit, then end-to-end |
| `npx playwright test tests/e2e/visual.spec.ts` | Visual regression against approved baselines (macOS renders; skipped in CI). Update baselines only from an approved design: add `--update-snapshots` |
| `npm run build` | Production build to `.output/` |
| `npm run preview` | Serve the production build locally |

No lint command is configured. First Playwright run: `npx playwright install`. Tests never use the database in `.env`. `tests/e2e/quality.spec.ts` runs axe (WCAG 2.2 AA rules) on every screen in light and dark.

## CI
`.github/workflows/ci.yml` runs on pushes to `main` and on pull requests: `npm ci`, `npm audit --audit-level=high`, typecheck, unit tests, then the production build and the end-to-end suite in 4 browsers, all against throwaway in-memory databases. No secrets are needed. Work on short branches (`feat/…`, `fix/…`, `chore/…`) and merge by pull request.

## Activating a household by hand (until online payments exist)
When someone pays you directly (for example by GCash transfer), extend their household by whole months:
```bash
node --env-file=.env scripts/grant-subscription.mjs owner@example.com 1          # dry run: shows the change
node --env-file=.env scripts/grant-subscription.mjs owner@example.com 1 --yes    # applies it
```
It extends from the later of today or the current paid-through date (ADR-008). Use the production `MONGODB_URI` for live customers.

## Deploying to Vercel
Decisions and reasons: ADR-006. Prepared and verified 2026-11-10: the Vercel-format build passes, a clean install has no 100 MB test-database download, and `.env` is not in the upload.

**What is configured in the repo**
- `vercel.json`: functions in `hkg1` (Hong Kong), the same region as the Atlas cluster (AWS `ap-east-1`).
- `.vercelignore`: never uploads `.env*`, `node_modules` or build output.
- `package.json`: `engines.node >= 22.12`; `mongodb-memory-server` install-time download disabled.
- Security headers come from `nuxt.config.ts` `routeRules` and appear in Vercel's output config.

**Before the first deploy (owner)**
1. **Atlas → Security → Network Access:** add `0.0.0.0/0` (Vercel has no fixed IPs). Keep a strong password on the database user.
2. **Choose the production database.** The current `MONGODB_URI` points at `bacli_expense_dev`. Either keep it (entries made during local testing carry over) or use a new database name in the production URI (for example `/bacli_expense?…`). Collections and indexes are created automatically.
3. Use a **new** `NUXT_SESSION_PASSWORD` for production, not the local one.

**Deploy with the Vercel CLI** (no Git repository needed):
```bash
npx vercel@65 login
npx vercel@65 link                      # create/link the project (framework: Nuxt, detected)
# Session secret, generated and piped in, never printed:
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))" | npx vercel@65 env add NUXT_SESSION_PASSWORD production
npx vercel@65 env add MONGODB_URI production   # paste the production connection string when asked
# Optional: add both variables to "preview" too, so preview deploys can reach the database.
npx vercel@65 deploy                    # preview URL: test sign-up, add, offline, invite
npx vercel@65 deploy --prod             # production
```
Later, to deploy from GitHub: push the project and import it in Vercel. Same variables, and `vercel.json` still applies.

**After deploying**
- Open the URL on your phone, sign up, and use **Add to Home Screen**. Offline mode needs HTTPS, which Vercel provides.
- Check Vercel → Project → Logs for `[db] connection failed` if the app says it can't reach the database (usually Atlas Network Access).
- The Hobby plan is for non-commercial use, which fits this personal app.

## Troubleshooting
- **503 "Cannot reach the database":** check `MONGODB_URI`, the Atlas IP allow-list, and that the cluster is running.
- **500 "Server is not configured":** `NUXT_SESSION_PASSWORD` is missing or shorter than 32 characters.
- **Type check slow or out of memory:** do not use Mongoose `InferSchemaType`. Keep the hand-written interfaces in `server/models` (ADR-005).
- **Signed in on desktop but not in Safari on plain http:** expected only if the cookie were `Secure`. It is set from the request protocol, so local http works.
