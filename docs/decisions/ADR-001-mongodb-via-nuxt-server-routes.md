# ADR-001: Store data in MongoDB through Nuxt server routes

## Status
Accepted

## Context
Version 1 kept everything in the browser's localStorage. Each browser and phone had its own separate data, a partner could not share the ledger, and clearing browser data lost everything. The owner asked to use MongoDB.

## Decision
Data lives in MongoDB, accessed with Mongoose only from Nuxt server routes and services (`server/`). The app stays a client-rendered SPA. No separate backend application.

## Alternatives Considered
- **Keep localStorage + manual backups:** no sharing; data loss risk.
- **Supabase/Firebase:** different database from the one requested; adds a vendor SDK to the client.
- **Separate Express API:** extra deployable with no benefit over Nitro routes.

## Consequences
- One shared ledger per household, available on any device.
- The app now needs a server (no longer a static site). Hosting is Vercel (Node functions) and needs environment variables.
- The database is a dependency: when it is unreachable the API returns 503 and the app runs from its device cache (ADR-004).

## Date
2026-11-09
