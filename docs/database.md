# Database

MongoDB through Mongoose. Models are in `server/models/index.ts`, with hand-written TypeScript interfaces (ADR-005). Amounts are integer cents. Dates are local calendar dates stored as `YYYY-MM-DD` strings: they sort correctly, range-query cleanly, and never shift with time zones.

## Collections
| Collection | Key fields | Notes |
|---|---|---|
| `households` | name, inviteCode (unique), currency, monthlyBudget, periodStartDay, timezone, setupDone, categories[], members[], methods[], **trialEndsAt**, **paidThrough** (ADR-008) | Small document. Categories, people and methods are embedded arrays edited as a whole (last write wins). |
| `users` | email (unique, lowercase), name, passwordHash (`select: false`), household → households, role, prefs{theme, defaultMemberId, defaultMethodId} | Index on `household` (list accounts of a household). |
| `transactions` | _id (client string), household, type, amount, categoryId, note, date, memberId, methodId, recurringId, createdBy → users | Index `{ household: 1, date: -1 }`: every read is one household, a date range, newest first. |
| `recurrings` | _id (client string), household, type, amount, categoryId, note, memberId, methodId, frequency, nextDate, auto, active | Index on `household`. |

## Relationships
`users.household` and `transactions.household` / `recurrings.household` reference `households._id`. `categoryId`, `memberId` and `methodId` refer to ids inside the household's embedded arrays (not enforced by the database; the UI shows "Uncategorized" for a missing category).

## Ids
- Entry and recurring ids are generated on the client (UUID) so offline creates can be retried without duplicates.
- Automatic recurring entries use `<recurringId>:<date>`, so two devices catching up at once cannot double-post.
- Imported entries whose id already exists in another household get `<householdId>:<id>`.

## Query patterns
| Query | Index used |
|---|---|
| Entries of a household from a date (bootstrap, older periods) | `{household, date}` |
| Note search, case-insensitive regex, limit 200 | `{household, date}` narrows to one household, then the regex scans its entries. Fine at household scale; revisit with a text index if a household passes about 50k entries. |
| Due automatic recurring items | `household` |

## Lifecycle
- Removing an account or a member deleting their own account deletes only the `users` document; their entries and their "person" stay. A sole owner deleting their account deletes the household, its `transactions` and `recurring`, and the user (A9).
- Entries live until deleted. "Erase all entries" (owner) deletes the household's transactions and recurring items. The household, people and accounts stay.
- No soft delete, no audit log (Proposed: acceptable for a household app).
- Backups: the user exports JSON from Settings. Database-level backups depend on the MongoDB host (Atlas snapshots), which is not configured by this project.
