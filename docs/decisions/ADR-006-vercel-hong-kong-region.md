# ADR-006: Host on Vercel, functions in Hong Kong next to the database

## Status
Accepted (deployment itself still needs the owner's go-ahead)

## Context
The app needs a Node server for its API (ADR-001). The MongoDB Atlas cluster runs in AWS `ap-east-1` (Hong Kong), read from the cluster's own `hello` tags on 2026-11-10. Vercel runs functions in `iad1` (Washington, USA) by default. A Bootstrap request makes several database round trips, and each would cross the Pacific (about 200 ms each).

## Decision
- Deploy to Vercel. Nitro detects Vercel and outputs Vercel functions (build verified with `NITRO_PRESET=vercel`).
- `vercel.json` pins functions to `hkg1` (Hong Kong), the same city as the database and close to users in the Philippines.
- Secrets are set in Vercel's environment settings, never uploaded: `.vercelignore` excludes `.env*`.
- `mongodb-memory-server` (test-only) has its install-time binary download disabled (`package.json` → `config.mongodbMemoryServer.disablePostinstall`), so deploy installs stay fast. Tests download the binary on first use.

## Alternatives Considered
- **Default region (iad1):** simplest, but slow for every request.
- **Moving the database to the US:** wrong direction; users are in Asia.
- **Cloudflare Pages:** would need Workers-compatible database access (Mongoose needs Node sockets).
- **A VPS or Render:** more to maintain for a household app.

## Consequences
- Low latency between the API and the database.
- Vercel Hobby is for non-commercial use: fine for this personal household app. A commercial version would need Vercel Pro.
- Atlas must accept connections from Vercel, which has no fixed IPs on Hobby, so Network Access needs `0.0.0.0/0` plus a strong database user password.
- Rate limits are per function instance (see `docs/security.md`).

## Date
2026-11-10
