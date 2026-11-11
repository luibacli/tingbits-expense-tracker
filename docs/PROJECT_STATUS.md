# Project status

**Date:** 2026-11-09 · **Version:** 2.0.0 · **Stage:** Implementation done, waiting for owner acceptance and deployment approval

## v2.0 (this milestone): MongoDB, household accounts, offline outbox
- Data moved from the browser to MongoDB through Nuxt server routes + Mongoose (ADR-001).
- Household accounts: email/password, invite code to join, "Added by" on entries, owner/member roles (ADR-002).
- Offline-first: on-device cache plus a persisted outbox. Edits never wait for the network (ADR-004).
- Data from v1 (device-only) can be added to the household from Settings. Backups are interchangeable between versions.
- All-time search and older periods load from the server on demand.
- Project rules: the owner's CLAUDE.md template, revised for Tailwind without PrimeVue (`CLAUDE.md`, ADR-003). Full `docs/` set and ADRs written.

## Verified
- `npm run typecheck`: passes (about 5 s, after ADR-005).
- `npm run test:unit`: 25/25 (date and budget math, validators, accounts, household isolation, idempotent creates, recurring catch-up, mark-paid retry, import merge and cross-household import) against in-memory MongoDB.
- `npm run test:e2e`: 84/84 (21 journeys × Chromium, Pixel 7, iPhone 13 WebKit, Firefox): sign-up/in/out, redirects and 401s, add/edit/delete/undo persisted on the server, validation, one-tap add, server search, manual and automatic recurring, partner join and shared ledger with "Added by", household isolation, offline queue then sync, settings saved across an immediate reload, v1 data import, backup into another household, bad file rejected, no console errors, no em dashes, security headers and no CSP violations, cross-site form posts blocked, reduced motion.
- Visual check at 390×844: sign-in with errors, household settings with invite code, offline badge.
- Dev server on port 3001 connects to the real `MONGODB_URI` (`/api/auth/session` returned 200). No test data was written to it.

## SaaS landing page (2026-11-10)
- Analysis: `docs/saas-analysis.md` (problem, audience, reference audit of 6 sites, positioning, statement, ₱150 pricing, unit economics, SaaS scope). Creative direction A "Listahan" approved, built at `/`. The app moved to `/app` (ADR-007).
- Verified: type check; production build prerenders `/`; e2e 112/112 (28 journeys × 4 browsers), including 7 landing tests (no-JS render, indexability split, structured data, calculator, CTA, Open app, voice/console/CSP). Screenshots at 390 (full page), 768 and 1440 dark: no overflow, no console errors.

### Launch blockers: the landing page promises things that don't exist yet
Do not make `/` public (deploy to a public URL or link it) until these are built or the copy is changed:
| Claim on the page | Needs |
|---|---|
| ~~"30-day free trial", no card~~ | **Done** (ADR-008) |
| ~~"What happens after the free trial?": read-only, data kept~~ | **Done** (ADR-008) |
| "₱150 / month", "Pay by card or Maya after" | S4 PayMongo billing (owner: business registration + PayMongo account). Until then, `scripts/grant-subscription.mjs` for manual payments |
| "Cancel anytime", "Yes, from Settings" | S4 billing management in Settings |
| Footer has no Terms/Privacy yet | S2 legal pages (owner's legal details) |
| Commercial use | Vercel **Pro** (Hobby is non-commercial) |

## Git and account management (2026-11-11)
- The project is now a Git repository (`main`, first commit `eed2c6f`). `.env` is ignored; the staged files were scanned for connection strings and keys before the commit.
- Account management (rules A7 to A10, saas-analysis S6): the owner removes an account or hands over ownership; anyone changes their password or deletes their account (sole owner: household and all data). Settings → Household and Your account. The server re-checks every request, so a removed person is sent to sign-in on their next load.
- Fixed along the way: when the server ended a session while the app was open, the store cleared the device but the app stayed on screen, empty. The layout now returns to sign-in (also used by Sign out and account deletion).
- Verified: type check; unit 43/43 (9 new: removal, cross-household attempts, transfer with a wrong password, member leave, owner blocked, sole-owner delete touching no other household, password change, validators); e2e 180/180 (45 journeys × 4 browsers, 6 new); screenshots at 390 px and desktop in light and dark.
- Not done: other devices stay signed in after a password change (`security.md` → Known gaps).

## Motion audit and Level 1 enhancements (2026-11-11)
- Audit found: no tap feedback on phones; the core "safe to spend" change was silent; landing bars animated `height` (kit violation) and never changed; toasts popped in. Added tap feedback, the settling-number signature, clip-path bars and meters (also Day Strip, trends, categories), and a toast entrance. Rejected scroll reveals, page transitions, parallax and libraries. Details: `CREATIVE_DIRECTION.md` → Motion direction; results: `QA_REPORT.md`.
- Verified: type check; unit 34/34; e2e 156/156 (39 journeys × 4 browsers, including 3 motion QA tests); screenshots.

## Pesos by default (2026-11-10)
- New households start in PHP (rule E0); the browser-language currency guess was removed. Verified: unit 34/34, e2e 144/144 (including a US-English browser signing up and seeing ₱).

## Renamed to Tingbits Expense Tracker (2026-11-10)
- Every visible name (app header "Tingbits", page titles, manifest, sign-in, plan "Tingbits Family", messages) and the landing story: definition eyebrow, "Tingbits napud." line, FAQ "What does tingbits mean?", closing "Goodbye, tingbits." Research and risks: `saas-analysis.md` §0.
- Internal names were renamed too, since no real accounts existed: cookie `tingbits_session`, storage `tingbits:*`, service-worker cache `tingbits-v4`, package name. The v1 device key `bacli-expenses:v1` is still read so old phones can import their data. The database name in `MONGODB_URI` is unchanged (your choice).
- Verified: type check; unit 33/33; e2e 140/140 (35 journeys × 4 browsers, including the new name test); screenshots of the hero at 1440 and 390 px and of the closing section.
- Not checked: trademark (IPOPHL), domain and social handles for "Tingbits".

## Trial and subscription (2026-11-10, ADR-008)
- 30-day trial on sign-up, back-filled for older households; read-only after it, enforced by the server with 402; automatic bills paused while read-only; banner and Plan section in Settings; manual activation script.
- Verified: type check; unit 33/33; e2e 136/136 (34 journeys × 4 browsers), including trial start, read-only view/export/refusal (UI and API), no automatic posting while expired, manual activation by script (dry run and apply), back-fill, member vs owner messages. Screenshots of the read-only home and Plan section at 390 px.

## Deployment preparation (2026-11-10)
- `vercel.json` (region `hkg1`), `.vercelignore` (no `.env` upload), `engines`, and the test-database download disabled at install (ADR-006).
- Verified: on a clean copy without `.env`, `npm ci` takes 6.5 s with no binary download, and `NITRO_PRESET=vercel npm run build` succeeds with headers in the Vercel config. Unit tests 25/25 and type check still pass.
- Local production build runs on port 3001 against the real Atlas database (`bacli_expense_dev`, 0 accounts on 2026-11-10).

## Not verified
- Sign-up and use against the real database: the owner should create the first account.
- Deployment to Vercel (not done; needs approval) and Atlas network access from Vercel.
- Tablet 768×1024 screenshots; desktop screenshots of the new screens; Lighthouse.
- Real-phone install and offline use over HTTPS.

## Open decisions for the owner
- Confirm or change the **Proposed** rules in `business-rules.md` (A3 to A10, E1, E4, R2, R3, I1 to I4).
- Password reset / email verification (needs an email provider), shared rate-limit store.
