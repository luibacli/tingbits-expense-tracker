# Business rules

**Approved** rules come from the owner's explicit requests. **Proposed** rules were assumed during the build and need the owner's confirmation. Until then they describe current behavior, not settled policy.

## Accounts and access
| # | Rule | Status |
|---|---|---|
| A1 | People sign in with email and password. The first account creates a household; others join it with its invite code. | Approved |
| A2 | Everyone in a household sees and shares the same ledger. Other households can never see it. | Approved |
| A3 | Only the owner sees and renews the invite code. Renewing makes the old code stop working. | Proposed |
| A4 | Any member can add, edit or delete any entry and change budgets, categories, people and methods. | Proposed |
| A5 | Only the owner can erase all entries and recurring items. Settings, people and accounts are kept. | Proposed |
| A6 | Passwords need at least 8 characters. Sessions last 60 days. | Proposed |
| A7 | The owner can remove another account from the household. That person can no longer sign in, and is signed out on their next request. Entries they added stay. | Proposed (built 2026-11-11) |
| A8 | The owner can make another account in the household the owner, after re-entering their password. The former owner becomes a member. A household always has an owner. | Proposed (built 2026-11-11) |
| A9 | Anyone can delete their own account after re-entering their password. A member just leaves (their entries stay). An owner who shares the household must hand it over first. An owner who is the only account deletes the household and all its entries and recurring items, for good. | Proposed (built 2026-11-11) |
| A10 | Anyone can change their password after entering the current one. Other signed-in devices stay signed in. | Proposed (built 2026-11-11) |

## Entries
| # | Rule | Status |
|---|---|---|
| E0 | New households start in Philippine pesos (PHP), whatever the browser's language. The owner can change the currency in setup or Settings. | **Approved** (2026-11-10) |
| E1 | Amounts are positive, stored as whole cents, at most 100 million in major units. | Proposed |
| E2 | An entry needs an amount, a type (expense/income), a category and a date. The note, person and method are optional. | Approved (carried from v1) |
| E3 | Deleting an entry can be undone from the toast for 5 seconds. | Approved (carried from v1) |
| E4 | Entries record which account added them ("Added by"). Automatic recurring entries have no account. | Proposed |

## Budgets
| # | Rule | Status |
|---|---|---|
| B1 | The overall budget is the monthly budget if set, otherwise the sum of category budgets. | Approved (carried from v1) |
| B2 | Safe to spend today = (budget minus spending before today) / days left including today, minus today's spending. Income does not raise it. | Approved (carried from v1) |
| B3 | A budget period starts on the household's chosen day (1 to 28). | Approved (carried from v1) |

## Recurring items
| # | Rule | Status |
|---|---|---|
| R1 | Automatic items post an entry on each due date, catching up missed dates, and never post the same date twice. | Approved (carried from v1) |
| R2 | "Today" for posting is decided in the household's time zone (taken from the creator's phone). | Proposed |
| R3 | Monthly items due on the 29th to 31st fall on the last day of shorter months and return to the original day after. | Proposed |
| R4 | Deleting a recurring item keeps the entries it already posted. | Approved (carried from v1) |

## Import and export
| # | Rule | Status |
|---|---|---|
| I1 | Importing a backup **adds** what is missing. It never overwrites or deletes. Importing the same file twice adds nothing the second time. | Proposed |
| I2 | An import adds missing categories, people and methods. It sets the monthly budget only if the household has none. | Proposed |
| I3 | Data left on a phone by the device-only version can be added to the household once from Settings. | Proposed |
| I4 | Backup files use the same format as the device-only version, so old and new backups are interchangeable. | Proposed |

## Trial and subscription (ADR-008)
| # | Rule | Status |
|---|---|---|
| S1 | One subscription covers one household with unlimited members, ₱150 a month. | Approved (pricing, 2026-11-10) |
| S2 | A new household gets a 30-day free trial; no card is needed. | **Approved** (2026-11-10) |
| S3 | When the trial or paid period ends, the household is read-only: view, export, settings and erase still work; adding or changing entries, recurring items and imports do not; automatic recurring entries stop. Data is never deleted for non-payment. | **Approved** (2026-11-10) |
| S4 | The household owner manages billing; members are told to ask the owner. | Proposed |
| S5 | A payment extends access by one month from the later of today or the current paid-through date. | Proposed |
| S6 | Households created before billing get a full 30-day trial from the first time they are loaded after the change. | Proposed |
