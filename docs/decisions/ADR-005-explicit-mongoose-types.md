# ADR-005: Hand-written document interfaces instead of Mongoose InferSchemaType

## Status
Accepted

## Context
With `InferSchemaType` plus generic `Model<T>`, `.lean<T>()` and `bulkWrite`, `nuxt typecheck` ran for over 10 minutes and ran out of memory. After the change it takes about 5 seconds.

## Decision
Each schema gets a hand-written TypeScript interface (`server/models/index.ts`) passed as `new Schema<T>()`, and models are typed `Model<T>`.

## Alternatives Considered
- **Raise Node's memory limit:** hides the problem; still slow.
- **Skip type-checking the server:** loses safety where it matters most.

## Consequences
- Interfaces must be kept in step with schemas by hand (a comment says so).
- Fast, reliable type checks.

## Date
2026-11-09
