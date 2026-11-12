# Threat Model: Tingbits Expense Tracker

- Date / version: 2026-11-12, app 1.0.0 before public launch. Update when auth, data or payments change.
- Security target: OWASP ASVS Level 2 (EXCOM kit 3.0.0, Web App profile).
- Prepared by: Claude; to be reviewed by paladin and the owner.

## 1. Assets
| Asset | Class | Why it matters |
|---|---|---|
| Household ledgers (entries, notes, amounts, recurring bills) | Personal (family finances) | Private family spending; notes may name people and places |
| Account emails and names | Personal | Identify people; used to sign in |
| Password hashes | Secret | Offline cracking if leaked |
| Session cookie and `NUXT_SESSION_PASSWORD` | Secret | Forging a session means full access to a household |
| `MONGODB_URI` (database user and password) | Secret | Direct access to every household |
| Invite codes | Secret (short-lived) | Joining a household grants full read and write |
| Subscription dates (`trialEndsAt`, `paidThrough`) | Internal | Free access if tampered with |

## 2. Entry points
Public landing page; `/login` (sign in, create, join); every `/api/*` route; `/api/health`; the backup import (JSON upload); the offline outbox replaying queued writes; `scripts/grant-subscription.mjs` (production database access from a developer machine); Vercel and Atlas dashboards.

## 3. Trust boundaries
Browser ↔ Nuxt server (everything from the browser is untrusted, including queued offline writes); server ↔ MongoDB Atlas; household ↔ household; owner ↔ member; developer machine ↔ production database (scripts).

## 4. Threats and mitigations (STRIDE)
| # | Threat | Where | Likelihood | Impact | Mitigation in place | Test that proves it | Status |
|---|---|---|---|---|---|---|---|
| T1 | Read or change another household's data by guessing or replaying ids (elevation, disclosure) | All data routes | Medium | High | Every query scoped by the household id from the server-side user; client ids validated by format; cross-household create returns 409 | `tests/unit/services.test.ts` isolation tests; e2e "a different household cannot see the data"; `accounts.test.ts` cross-household account attempts | Mitigated |
| T2 | Password guessing (spoofing) | `/api/auth/login` | High | High | scrypt hashes; same error and timing for unknown email; rate limit per IP + email | Unit tests; rate limit configurable, on in tests | **Partial:** the limit is per server instance on Vercel (see A1) |
| T3 | Session forgery or theft | Cookie | Low | High | Sealed `HttpOnly` cookie, `SameSite=Lax`, `Secure` over HTTPS, secret of 32+ characters, CSP with no third-party scripts, no `v-html` | Header and CSP e2e tests | Mitigated |
| T4 | Cross-site request forgery | Write routes | Medium | Medium | JSON-only writes + Origin check + `SameSite=Lax` | e2e "cross-site form posts to the API are blocked" | Mitigated |
| T5 | Taking over a household from a phone left signed in | Settings | Medium | High | Ownership transfer, password change and account deletion require the current password | `accounts.spec.ts` wrong-password paths | Mitigated |
| T6 | Invite code leaked or guessed (spoofing) | `/api/auth/register` | Medium | High | 8 characters from a 31-letter alphabet (about 8.5 × 10^11 codes), owner can renew, sign-up rate limit; the owner sees who joined and can remove them | `accounts.spec.ts` removal | Mitigated; owner should renew a code after sharing it widely |
| T7 | Malicious backup file (tampering, denial of service) | `/api/import` | Low | Medium | 20 MB client check, `normalizeData` rebuilds every field, ids validated, colliding ids re-keyed, 20 imports per hour | Unit and e2e import tests | Mitigated; server body size relies on the host limit |
| T8 | NoSQL operator injection (`$ne`, `$gt`) | Query parameters, ids | Low | High | Validators whitelist fields and check id formats; search text regex-escaped | Validator unit tests | Mitigated |
| T9 | Using the app without paying (tampering) | Subscription | Medium | Low | Access computed on the server from stored dates; writes return 402 when expired | `subscription.spec.ts`, `subscription.test.ts` | Mitigated |
| T10 | Secret leak through the repository or logs (disclosure) | Git, logs | Medium | High | `.env` ignored; repository scanned before the first commit; security log holds ids only; errors never include stack traces | `securityLog.test.ts` | **Partial:** no automatic secret scanning in CI (see A2) |
| T11 | Database lost or corrupted (denial of service, data loss) | Atlas | Low | High | None yet beyond the tier's defaults | None | **Open:** backups and a restore test needed before real users (`docs/runbook.md`) |
| T12 | A sensitive action cannot be traced afterwards (repudiation) | Account and data actions | Medium | Medium | Security log of sign-ins, failed sign-ins, account and ownership changes, exports, imports, erase | `securityLog.test.ts` | Mitigated (kept as long as the host keeps logs) |
| T13 | Data left on a shared phone (disclosure) | localStorage cache and outbox | Medium | Medium | Cleared on sign-out, account deletion and session end | `accounts.spec.ts` (cache cleared after deletion) | Mitigated; documented in `security.md` |
| T14 | Production database reached from a developer machine | `scripts/grant-subscription.mjs` | Low | High | Dry run by default, explicit `--yes`, one email at a time | Manual | Mitigated; keep the Atlas user for scripts separate when a second person gets access |
| T15 | Vulnerable dependency (all) | Supply chain | Medium | Varies | `npm audit --audit-level=high` in CI; versions pinned by the lockfile | CI | Mitigated (12 low or moderate findings accepted, none high) |

## 5. Accepted risks
| Risk | Why accepted | Accepted by | Review date |
|---|---|---|---|
| A1: rate limits are per Vercel instance | A shared store (for example Upstash) adds cost and a service; scrypt plus per-instance limits still slow guessing a lot at current scale | Pending the owner | Before 1,000 households or at the first sign of abuse |
| A2: no secret scanning in CI | Small team, `.env` ignored, guard hook available | Pending the owner | When a second developer joins |
| A3: other devices stay signed in after a password change | Needs a session version on the user; small change | Pending the owner | Before launch (recommended) |
