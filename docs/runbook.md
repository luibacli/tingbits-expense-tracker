# Runbook: Tingbits Expense Tracker

For whoever is looking after production. No secret values here; it says where they live.

## Overview
- Production URL: https://tingbits.vercel.app (first deployed 2026-11-12; custom domain `tingbits.app` recommended, not bought yet).
- Hosting: Vercel, functions in `hkg1` (Hong Kong). Commercial use needs the Pro plan.
- Database: MongoDB Atlas, AWS `ap-east-1` (Hong Kong). Database name is part of `MONGODB_URI` (currently `bacli_expense_dev`). **Tier and backups: not recorded yet; owner to confirm (see Backups).**
- Secrets: `MONGODB_URI`, `NUXT_SESSION_PASSWORD` in Vercel → Project → Settings → Environment Variables, and in the local `.env` (never committed).
- Health check: `GET /api/health` returns `200 {"status":"ok"}` only when the app and the database are reachable; otherwise 503.

## Deploy
1. Merge to `main` through a pull request with CI green (`.github/workflows/ci.yml`).
2. Write release notes (`docs/releases/`), get the owner's written approval.
3. Vercel deploys `main` automatically once the Git integration is connected, or `vercel --prod` from the project.
4. Smoke test within 15 minutes: `/` loads, `/api/health` is 200, sign in, add and delete one entry on a test household, no new errors in Vercel → Logs.

## Roll back
- Code: Vercel → Deployments → previous production deployment → Promote to Production (instant).
- Data: Tingbits has no schema migrations yet. Before any future migration, take a snapshot or export first and write the reverse step in the release notes.

## Backups (decision needed before real users)
Atlas free tier (M0) has **no automatic backups**. Options, in order of preference:
1. A paid Atlas tier with cloud backups (continuous or scheduled snapshots), restore from Atlas → Backup.
2. On a free tier: a scheduled `mongodump` of the database to private storage, with retention matching the privacy notice.
Per household, owners can always download their own JSON backup in Settings, but that is not a disaster-recovery plan.

**Restore test** (before launch, then every six months): restore the latest backup into a scratch cluster or database, point a local build at it (`node --env-file=<scratch env> .output/server/index.mjs`), sign in with a test account, check entries. Record the date here. Last tested: never.

## Rotate a secret
- `NUXT_SESSION_PASSWORD`: generate 32+ random characters, update in Vercel (and `.env`), redeploy. **Everyone is signed out** (sessions sealed with the old key stop working). Data is untouched.
- Database password: Atlas → Database Access → edit user → new password; update `MONGODB_URI` in Vercel and `.env`; redeploy. Brief 503s until the redeploy finishes.
- Rotate both when a person with access leaves or a leak is suspected.

## Monitoring (decision needed)
- Uptime: point an uptime checker at `https://<domain>/api/health` every 5 minutes, alerting the owner by email or SMS. Tool not chosen yet (free tiers exist; check terms).
- Errors: Vercel → Logs. Search `[db]` for database problems and `"type":"security"` for the security log.
- Atlas: enable the default alerts for storage and connections, sent to the owner.

## Common problems
| Symptom | Likely cause | Fix |
|---|---|---|
| `/api/health` 503 "The database is not configured" or `/api/auth/session` 500 "Server is not configured" | `MONGODB_URI` or `NUXT_SESSION_PASSWORD` missing in Vercel for this environment, or added without redeploying | Add both for Production, then Redeploy (variables apply only to new deployments) |
| App says "Cannot reach the database"; `/api/health` 503 | Taking about 8 s: Atlas Network Access is blocking the host. Failing fast: wrong `MONGODB_URI` or password. Also: cluster paused | Atlas → Network Access must allow `0.0.0.0/0` for Vercel; resume the cluster; check the variable |
| Locally: `querySrv ECONNREFUSED` after changing networks | The Node process kept the old network's DNS | Restart the server |
| Everyone signed out at once | `NUXT_SESSION_PASSWORD` changed | Expected after rotation |
| A household cannot add entries (402) | Trial or paid period ended | `scripts/grant-subscription.mjs` after payment (`docs/development.md`) |
| Many `auth.login_failed` lines | Password guessing | Check the security log; consider a shared rate limit (`docs/threat-model.md` A1) |

## Incidents
Severities and steps follow the EXCOM kit (`standards/DEVOPS_RELEASE.md`): SEV1 down, data loss or exposure; SEV2 major feature broken; SEV3 minor. Roll back first, investigate second. A personal-data breach likely to cause harm must be reported to the National Privacy Commission and affected people within 72 hours of knowledge: tell the owner immediately. Write a report for SEV1 and SEV2.

## Contacts
- Owner and on-call: (owner to fill)
- Vercel account owner: (owner to fill)
- Atlas project owner: (owner to fill)
