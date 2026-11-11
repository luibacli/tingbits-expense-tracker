# Tingbits Expense Tracker

A fast expense tracker for everyday household spending. One shared ledger for the whole household, stored in MongoDB, that still works offline and installs to your phone's home screen.

## What it does

- **Safe to spend today.** Set a monthly budget and the home screen tells you how much you can spend today and still finish the month on budget. Overspend one day and the next days adjust.
- **Logging in about 3 seconds.** Tap **+**, type the amount, pick a category, save. Things you log often turn into **one-tap adds** on the home screen. The note field autocompletes and picks the category for you. Type `120+45+80` to add up a receipt.
- **Household accounts.** Create a household, invite your partner with a code, and share one ledger. Each entry shows who added it, and Insights shows who paid.
- **Recurring bills and income.** Rent and subscriptions post themselves. For bills that change, like electricity, you get a "Bills due" reminder with **Mark paid**.
- **Budgets.** Set an overall budget, per-category budgets, or both. You get a warning near the limit and an alert when you go over.
- **Pay-cycle months.** Your budget month can start on payday (for example the 15th) instead of the 1st.
- **Insights.** Category breakdown, a 6-month trend, how this month compares with the same point last month, daily average, who paid, payment methods and your biggest items.
- **History.** Search every entry by note, category or amount, and filter by type, category or person.
- **Undo** after every add, delete and mark-paid.
- **Backup, import and CSV export** (CSV opens in Excel or Google Sheets). Imports merge and never overwrite.
- Dark mode, any currency, and keyboard shortcuts on desktop: `N` add expense, `I` add income, `/` search.

## Run it

```bash
npm install
cp .env.example .env     # add MONGODB_URI and NUXT_SESSION_PASSWORD
npm run dev              # http://localhost:3000
```

`/` is the public landing page; the app lives at `/app`. Open `/login`, choose **New** to create your household, then share the invite code from **Settings** with your partner. They choose **Join**.

## How data is stored

Everything is saved in your MongoDB database and shared by everyone in the household. Each phone also keeps a copy of recent entries plus any changes made without signal, so the app opens instantly and works offline. Waiting changes are sent automatically when the phone reconnects.

Entries from the earlier offline-only version can be added from **Settings > Your data**.

## Check it

```bash
npm run typecheck
npm run test:unit       # Vitest, in-memory MongoDB
npm run test:e2e        # build + Playwright in 4 browsers, in-memory MongoDB
```

## Deploy

See `docs/development.md` (Vercel + MongoDB Atlas).

## Documentation

`CLAUDE.md` holds the engineering rules. `docs/` holds the product, rules, architecture, database, API, security and UI docs, plus ADRs in `docs/decisions/`. `docs/PROJECT_STATUS.md` says what is verified.
