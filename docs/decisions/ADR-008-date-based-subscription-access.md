# ADR-008: Date-based subscription access, enforced on the server

## Status
Accepted (2026-11-10; owner approved the 30-day no-card trial and read-only after it)

## Context
Bacli charges ₱150 a month per household (`docs/saas-analysis.md`). Payments (PayMongo) are not connected yet: they need the owner's business registration and PayMongo account. The trial and the read-only rule had to work now, and payments must slot in later without a redesign.

## Decision
- A household has two dates: `trialEndsAt` (creation + 30 days) and `paidThrough` (null until paid). **Access lasts until the later of the two.** Status: `trial`, `active` (paid date in the future) or `expired`. The pure rules live in `shared/utils/subscription.ts`, shared by server and client.
- **Payments only ever move `paidThrough` forward** (`extendPaidThrough`). A future PayMongo webhook will call it; until then `scripts/grant-subscription.mjs` does it for payments received by hand (dry run unless `--yes`).
- **Server enforcement:** every route that adds or changes ledger data (entries, recurring items, pay/skip, import) uses `requireWritable`, which answers **402 `SUBSCRIPTION_REQUIRED`** when expired. Reading, export, settings, preferences, sign-in, invite and erase stay available. Automatic recurring items are not posted while expired.
- Households created before billing get a 30-day trial the first time they're seen (`ensureTrial`, set once).
- **Client:** the store computes the state from the dates and the clock (so it also expires offline), refuses changes with an explanation instead of queueing them, and the app shows a read-only banner and a Plan section. A 402 that slips through the outbox is dropped with a message, like any rejected change.

## Alternatives Considered
- **A status field updated by a scheduled job:** needs a cron, and goes wrong if the job is late. Dates need neither.
- **Hiding data after expiry:** against the approved rule (data is safe, viewable, exportable) and bad for trust.
- **Waiting for PayMongo before any of this:** the landing page already promises the trial and the read-only behavior.

## Consequences
- Turning on payments is small: create a checkout, then on webhook call `extendPaidThrough(household, 1)`.
- No proration or cancellation state yet. "Cancel" will mean "don't renew", and access runs to `paidThrough`.
- Members can't pay; only the owner sees the plan action (Proposed rule S4).

## Date
2026-11-10
