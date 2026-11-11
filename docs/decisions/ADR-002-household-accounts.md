# ADR-002: Household accounts with email + password and invite codes

## Status
Accepted

## Context
Server-side data must not be reachable by anyone who finds the URL. The owner chose household accounts over a shared passcode or no login.

## Decision
- Email + password accounts. Passwords hashed with Node `scrypt`. Sessions in an encrypted cookie from h3's built-in `useSession`.
- The first account creates a household (owner). Others join with an 8-character invite code (member).
- Every query is scoped to the household of the signed-in account.
- No authentication library was added: Node crypto plus h3 sessions cover it.

## Alternatives Considered
- **nuxt-auth-utils:** good, but adds a module for features h3 already has.
- **OAuth (Google):** needs app registration and consent screens. Can be added later.
- **Single shared passcode:** no per-person tracking; weak.

## Consequences
- "Added by" per entry is possible.
- No password reset yet (needs an email service). No account removal yet (business-rules A7).

## Date
2026-11-09
