# Creative direction: Tingbits Expense Tracker landing page

## Project and version
- Client: Tingbits Expense Tracker (owner-led SaaS)
- Date: 2026-11-10
- Prepared by: Claude (EXCOM kit 2.2.0)
- Approval status: **Direction A "Listahan" approved by the owner on 2026-11-10**, and built at `/` (`app/pages/index.vue`, `app/layouts/marketing.vue`, `app/components/SafeToSpendCalculator.vue`).

## Strategic foundation
- Business positioning: the shared family money tracker that tells you every morning how much you can safely spend today. ₱150/month for the whole household. (`saas-analysis.md` §4)
- Primary audience: the family money manager in a Filipino household; also couples, families receiving remittances, and young earners.
- Primary conversion goal: **Start 30-day free trial** (creates a household).
- Desired visitor response: "That's exactly our problem before payday. And it's only ₱150 for all of us."

## Reference audit
See `saas-analysis.md` §3 (YNAB, Monarch, Goodbudget, Honeydue, Money Lover, Spendee). In short, borrow the emotional opening, a no-card trial, the "together" message and real product views. Avoid dashboard heroes, green money clichés, flying banknotes, stock photos, user-count claims and cookie walls.

## Signature idea (shared by both directions)
- **The idea:** a live **"Safe to spend today" calculator** in the hero. Visitors type their budget, what they've spent and their next payday (15th / 30th), and see their own daily number plus the days to payday drawn as bars. It is the app's core feature, demonstrated with the visitor's own numbers.
- **What it explains:** the whole product in five seconds, with no screenshots needed.
- **Reduced motion / no JS / mobile:** no JS shows a worked example (₱30,000 budget, ₱18,400 spent, 9 days to payday = ₱1,288 a day). Reduced motion removes the bar animation. On mobile it sits under the headline, full width.
- **Mock-ups:** `docs/mockups/direction-a-listahan.html`, `docs/mockups/direction-b-sobre.html`.

## Direction A: "Listahan" (the household notebook, upgraded)
- **Thesis:** many Filipino families already track money in a *listahan*, a ruled notebook. Tingbits is that notebook, shared and doing the math for you.
- **Personality:** calm, trustworthy, warm, grown-up.
- **Typography:** Fraunces (warm serif) for headlines and the big number; system sans for everything else. Matches the app's ink-on-paper UI, so landing page to app feels continuous.
- **Color roles:** paper `#f4f3ee`, ink `#0b0b0b`, notebook margin red `#c2412d` (sparingly: underlines and the margin rule), ink blue `#2a78d6` for numbers and bars (the app's data hue).
- **Layout:** a notebook motif (faint ruled lines behind the hero, a red margin line); generous whitespace; text-led sections; one product view.
- **Imagery:** no stock photos. The live calculator and real app screens only.
- **Motion (Level 1):** bars rise once when the number updates; nothing else moves.
- **Risk:** quieter. It needs strong copy to stand out.

## Direction B: "Sobre" (the payday envelopes)
- **Thesis:** on payday, many families split the sweldo into *sobre*: one for kuryente, one for pagkain, one for tuition. Tingbits is the set of envelopes that everyone can see and that refills every payday.
- **Personality:** friendly, bold, proud, a little playful.
- **Typography:** Bricolage Grotesque (characterful grotesque) for headlines; system sans for body.
- **Color roles:** cream `#fbf6ec`, kraft envelope `#d8b98a`, deep ink `#1d1b16`, stamp red `#c2410c` for the CTA and "postmark" accents, data blue `#2a78d6` for numbers.
- **Layout:** envelopes as the recurring shape (category budgets, pricing "envelope"); bolder sizes; more color blocks.
- **Imagery:** CSS envelopes and stamps, no photos.
- **Motion (Level 2):** envelopes "fill" on scroll once; reduced motion shows them filled.
- **Risk:** more distinctive but less like the app (the app stays paper and ink); the envelope metaphor suggests strict per-category budgets, which are optional in the app.

## Recommendation
**Direction A (Listahan).** It continues straight into the app's look (no jump after sign-up), carries trust for a money product, and the calculator does the persuading. Take one thing from B: **Filipino money words** (sweldo, kinsenas, sobre) in the copy, which both mock-ups already use.

## Content rules (both)
- No testimonials, user counts, savings figures, awards or regulator wording. None exist yet.
- No em dashes; at most one eyebrow label.
- Prices: ₱150/month for the household; trial terms marked as the owner's decision until approved.

## Motion direction (decided 2026-11-11 after a motion audit)
- **Motion thesis:** steady, like a running tally. Numbers settle; nothing performs.
- **Motion personality:** calm, precise, reassuring.
- **Project ceiling:** Level 1 (functional feedback). A money app for families on mid-range Android phones should feel trustworthy and fast, not showy. No signature page above the ceiling.
- **Signature moment (one):** the **safe-to-spend figure settles** on its new value (about 450 ms, ease-out) after an entry, while today's Day Strip bar grows and the budget meter fills. Purpose: *Feedback* ("my entry counted") and *Explain* ("this is what it did to today").
- **Landing calculator:** the bars show today's allowance against an even pace (budget ÷ 30) and fill left to right (25 ms stagger) as the visitor types. Purpose: *Explain* (money spread over the days to payday).
- **Other motion:** tap feedback (scale 0.97, 100 ms) on buttons, chips and the + button; list rows darken on press; toasts slide in (150 ms); the entry sheet slides in (200 ms, existing).
- **Tokens:** `--ease-out: cubic-bezier(0.2, 0.7, 0.2, 1)`, `--dur-press: 100ms`, `--dur-settle: 450ms` (`main.css`).
- **What never moves:** prices, legal text, form fields, navigation, the landing headline (the LCP element), empty states.
- **Rejected:** scroll-in reveals, page transitions, parallax, count-ups on page load, animation libraries. They serve no purpose here and cost speed.
- **Reduced motion:** every transition and animation collapses (global rule); numbers show their final value at once.
- **Mobile:** same (already minimal); only transform, opacity and clip-path animate, so there is no layout work.
- **Performance budget:** 0 KB of motion libraries (CSS plus a small `useTweenedNumber` helper); CLS stays under 0.1.
- **Accessibility:** a settling number is `aria-hidden`, with an `sr-only` final value beside it, so screen readers never hear the in-between numbers.
