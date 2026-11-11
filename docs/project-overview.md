# Project overview

## Purpose
Tingbits Expense Tracker helps a household see, every day, how much it can still spend without breaking the month, and makes logging a purchase take a few seconds on a phone.

## Problem
Spending is spread across people, cash, cards and e-wallets. Traditional trackers are slow to log into and only show totals after the fact. Households want a shared ledger and one number to act on today.

## Users and roles
| Role | Who | Can |
|---|---|---|
| Owner | The person who created the household | Everything a member can, plus see and renew the invite code and erase all entries |
| Member | Anyone who joined with the invite code | Log, edit and delete any household entry; manage recurring items, budgets, categories, people, methods; import and export |

Accounts (people who sign in) are different from **people** (labels for "who paid"). Every account gets a person when it is created. More people can be added without accounts, for example a child.

## Core modules
- **Today:** the "safe to spend today" figure, bills due, one-tap repeats, the Day Strip chart, and today's entries.
- **History:** entries by budget period, with search across all time and filters.
- **Insights:** totals, comparison with the same point last period, categories against budgets, 6-period trend, who paid, how paid, biggest items.
- **Plan:** monthly and per-category budgets, recurring bills and income.
- **Settings:** household and invite, currency, budget period start, theme, people, categories, payment methods, backup/import/export, sign out.

## Domain terms
- **Entry:** one expense or income (amount, category, date, note, person, method).
- **Budget period:** a month starting on the household's chosen day (1 to 28), for example payday.
- **Safe to spend today:** (budget minus spending before today) divided by days left in the period, including today, minus today's spending.
- **Recurring item:** an entry that repeats weekly, monthly or yearly. *Automatic* items post themselves when due. *Reminder* items appear under "Bills due" until marked paid or skipped.
- **Invite code:** 8-character code that lets a new account join a household.

## Major workflows
1. Create a household, then optionally set currency, budget, people and period start.
2. Log an entry: amount (sums like `120+45` allowed), category, optional note, date, person and method.
3. A partner joins with the invite code, and both see the same ledger.
4. Bills: automatic items post on the due date. Reminders are marked paid or skipped.
5. Offline: entries made with no signal are queued on the phone and sent when it reconnects.
6. Move data: back up to JSON, import a backup (merged, never overwritten), or import data left by the earlier device-only version.

## Boundaries
- No bank connections, receipt scanning, multi-currency conversion or push notifications.
- One household per account.
- Not a commercial product. Personal use by the owner's household.

## Assumptions and constraints
- Phones are the main device. Signal is unreliable at times.
- The household trusts its members (any member can change any entry).
- Data volume: a few thousand entries a year per household.
