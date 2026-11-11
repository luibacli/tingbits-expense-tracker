# API

All endpoints are under `/api`, take and return JSON, and need a signed-in session (encrypted `tingbits_session` cookie) unless marked **public**.

## Conventions
- **Success:** the resource or a small object. `201` for creates.
- **Errors:** h3 error JSON. The client reads `statusMessage` (safe to show) and `data.code`, plus `data.fields` for per-field messages:
  ```json
  { "statusCode": 400, "statusMessage": "Some fields are invalid.", "data": { "code": "VALIDATION", "fields": { "amount": "Enter an amount above zero." } } }
  ```
- **Codes:** `VALIDATION` 400 · `UNAUTHENTICATED` 401 · `BAD_CREDENTIALS` 401 · `SUBSCRIPTION_REQUIRED` 402 · `FORBIDDEN` 403 · `NOT_FOUND` 404 · `EMAIL_TAKEN` / `ID_CONFLICT` 409 · `UNSUPPORTED_MEDIA_TYPE` 415 · `RATE_LIMITED` 429 · `CONFIG` 500 · `DB_UNAVAILABLE` 503.
- **Writes** (POST/PATCH/DELETE with a body) must be `application/json`, and when the browser sends `Origin` it must be this site. Otherwise 415 or 403.
- **Read-only households (ADR-008):** `POST/PATCH/DELETE /api/transactions*`, `POST/PATCH/DELETE /api/recurring*` (including pay/skip) and `POST /api/import` answer **402 `SUBSCRIPTION_REQUIRED`** once the trial or paid period has ended. Everything else keeps working.
- **Scope:** every query is limited to the caller's household. Ids from another household behave as not found.
- **Retries:** creates with an existing id return the existing resource. Deletes of missing ids succeed.

## Auth
| Method | Path | Body | Returns | Notes |
|---|---|---|---|---|
| GET | `/api/auth/session` | | `{ signedIn }` | **public**, always 200, reads the cookie only (no database connection; called by the landing page) |
| POST | `/api/auth/register` | `{ name, email, password, householdName?, inviteCode?, currency, timezone }` | `201 { ok }` + session cookie | **public**. Without `inviteCode` creates a household (owner); with it, joins (member). 409 `EMAIL_TAKEN`, 404 `INVITE_NOT_FOUND`. Rate-limited per IP. |
| POST | `/api/auth/login` | `{ email, password }` | `{ ok }` + session cookie | **public**. Same 401 for unknown email and wrong password. Rate-limited per IP + email. |
| POST | `/api/auth/logout` | | `{ ok }` | clears the cookie |

## App data
| Method | Path | Body / query | Returns |
|---|---|---|---|
| GET | `/api/bootstrap` | `?from=YYYY-MM-DD` (default today minus 400 days) | `Bootstrap` (`shared/types`): user, household (including `subscription`: status, dates, daysLeft, canWrite), recurring, transactions since `from`, `posted`, `today`. Posts due automatic recurring items first, unless the household is read-only. |
| PATCH | `/api/me/prefs` | `{ theme, defaultMemberId, defaultMethodId }` | `{ ok }` |
| PATCH | `/api/household` | `{ name, categories[], members[], methods[], settings{ currency, monthlyBudget, periodStartDay, setupDone, timezone? } }` | `{ ok }`. Replaces these fields (last write wins). |
| POST | `/api/household/invite` | | `{ inviteCode }` **owner only** |
| DELETE | `/api/household/ledger` | `{ confirm: "ERASE" }` | `{ transactions, recurring }` deleted counts. **Owner only.** |

## Entries
| Method | Path | Body / query | Returns |
|---|---|---|---|
| GET | `/api/transactions` | `?from=…&to=…` (date range) or `?q=text` (note search, all time, max 200) | `Transaction[]` newest first |
| POST | `/api/transactions` | `{ id, type, amount, categoryId, note, date, memberId, methodId }` | `201 Transaction` (idempotent by `id`) |
| PATCH | `/api/transactions/:id` | any subset of the fields above except `id` | `Transaction` |
| DELETE | `/api/transactions/:id` | | `{ ok }` |

## Recurring
| Method | Path | Body | Returns |
|---|---|---|---|
| POST | `/api/recurring` | `{ id, type, amount, categoryId, note, memberId, methodId, frequency, nextDate, auto, active? }` | `201 { recurring, posted }` (posts anything already due) |
| PATCH | `/api/recurring/:id` | any subset | `{ recurring, posted }` |
| DELETE | `/api/recurring/:id` | | `{ ok }`. Posted entries are kept. |
| POST | `/api/recurring/:id/pay` | `{ transactionId, date, from }` | `{ recurring, transaction }`. Idempotent: advances only if `nextDate === from`. |
| POST | `/api/recurring/:id/skip` | `{ from }` | `Recurring` (same rule) |

## Backup
| Method | Path | Returns |
|---|---|---|
| GET | `/api/export` | JSON backup download (version 1 format) |
| GET | `/api/export?format=csv` | CSV download (formula injection neutralised) |
| POST | `/api/import` | Body: a version 1 backup. Returns `{ entries, skipped, recurring }`. Merges, never overwrites. Max 20 per hour per household. |
