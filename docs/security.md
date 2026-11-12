# Security

## Authentication
- Email + password. Passwords are hashed with Node's `scrypt` (N=16384, r=8, p=1, 16-byte random salt), stored as `scrypt$N$salt$hash`, and compared with `timingSafeEqual`. `passwordHash` is excluded from queries by default (`select: false`).
- Session: h3 `useSession`, an encrypted and sealed cookie `tingbits_session` that holds only the user id. `HttpOnly`, `SameSite=Lax`, `Secure` whenever the request is HTTPS. 60-day lifetime. Key: `NUXT_SESSION_PASSWORD` (32+ characters).
- Every request reloads the user from the database (`requireAuth`), so a deleted account loses access at once.
- Sign-in gives the same message and similar timing for an unknown email and a wrong password.
- Rate limits (in memory, per server instance): sign-in 10 per 15 minutes per IP + email, sign-up 10 per hour per IP, import 20 per hour per household. Configurable with `NUXT_AUTH_RATE_LIMIT`. On serverless hosting each instance counts separately, so this slows guessing but is not a hard cap. A shared store such as Upstash would be needed for that (not added; see follow-ups).

## Authorization
- Every data query includes the caller's household id taken from the server-side user record, never from the client.
- Owner-only actions are checked on the server (`requireOwner`): invite code, erase, remove an account, hand over ownership. Every account change is scoped to the caller's household in the database query itself, so an id from another household matches nothing (404).
- Handing over ownership, changing the password and deleting an account all require the current password, so a phone left signed in cannot be used to take over or erase the household. Ownership is handed over by promoting the new owner before demoting the old one, so a failure in between leaves two owners, never none.
- Client ids are accepted for creates, but a create whose id exists in another household fails with 409 and changes nothing.

## Input handling
- All bodies and queries are validated at the boundary by `shared/utils/validate.ts`. Unknown fields are dropped. Ids must match `[A-Za-z0-9_:-]{1,80}`, which also stops `{ "$ne": … }` operator injection.
- Search text is regex-escaped. Imports go through `normalizeData`, which rebuilds the data field by field.
- No `v-html` anywhere. User text is always rendered as text.

## Cross-site protection
- `SameSite=Lax` cookie, plus: writes must be `application/json` (HTML forms cannot send that), and a present `Origin` header must match the host (`server/middleware/01.api-guard.ts`).

## Headers (`nuxt.config.ts` → `routeRules`)
CSP (`default-src 'self'`, `object-src 'none'`, `frame-ancestors 'none'`, `connect-src 'self'`), `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`, COOP, HSTS. `/api/**` adds `Cache-Control: no-store`.
- `script-src 'unsafe-inline'` remains because Nuxt's SPA shell inlines its config. Accepted for now: there is no user HTML and there are no third-party scripts. A nonce would need SSR.

## Secrets
- `MONGODB_URI` and `NUXT_SESSION_PASSWORD` live in `.env` (git-ignored) or the host's environment, read only through private `runtimeConfig`. Never shipped to the browser.

## Data on the device
- The browser keeps a cache of recent entries and the unsent changes queue in localStorage, so the app works offline. Signing out, deleting the account, or the server ending the session (for example the owner removed this account) clears both and returns to the sign-in screen. Anyone with the unlocked phone can open the app while signed in.

## Security log
`server/utils/securityLog.ts` writes one JSON line per sensitive event to the server log (`"type":"security"`): sign-up, sign-in, failed sign-in, sign-out, account removed, ownership handed over, account deleted, password changed (with `outcome: "denied"` and a fixed code such as `BAD_PASSWORD` for refused attempts), invite renewed, ledger erased, export, import. Only ids and fixed codes are allowed: no emails, names, passwords, tokens or IP addresses (unit-tested). Kept as long as the host keeps logs.

## Threat model
`docs/threat-model.md` (ASVS Level 2 target): assets, entry points, 15 threats with mitigations and tests, accepted risks awaiting the owner.

## Known gaps (follow-ups)
- No password reset or email verification (needs an email provider).
- No database backups confirmed and no restore test yet (`docs/runbook.md` → Backups).
- Changing the password does not sign out other devices (the session holds only the user id). A session version on the user would fix this.
- Rate limiting is per instance (see above).
