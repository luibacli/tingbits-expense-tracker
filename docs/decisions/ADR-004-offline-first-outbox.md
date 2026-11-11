# ADR-004: Offline-first client with an outbox

## Status
Accepted

## Context
The app is used on phones in places with poor signal. Version 1 worked fully offline. Moving data to a server must not make logging an expense depend on the network.

## Decision
- The Pinia store applies every change locally first and queues a request in an **outbox** persisted to localStorage. Requests are sent in order. Network failures keep the request for later; server rejections drop it and resync.
- Creates use client-generated ids and are idempotent. Pay and skip carry the due date they apply to. Automatic recurring entries use deterministic ids. So every request is safe to retry.
- The last bootstrap is cached on the device, so the app opens instantly and offline.
- Conflicts: last write wins (acceptable for a household).

## Alternatives Considered
- **Online-only:** simpler, but logging fails exactly when people are out shopping.
- **Full sync engine/CRDT (for example RxDB):** far more complexity than a household ledger needs.

## Consequences
- The UI never waits on the network to log an entry.
- Two people editing the same entry at the same moment: the later save wins.
- Lessons found in testing: guard against a stale refresh overwriting newer local edits, never start requests during page unload (queue only), and clear in-flight markers in `.finally()`.

## Date
2026-11-09
