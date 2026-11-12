# UI design

## Direction
Calm, practical, phone-first. A warm paper and ink neutral base with one data hue. The interface should feel like a quick tool you use while queuing to pay, not a dashboard you study. There is no client logo; colors are a neutral foundation, not a brand.

**Signature:** "Safe to spend today" as the hero number on Today, with the **Day Strip**: one bar per day of the budget period under a dashed even-pace line. Tap a day to see its entries. The whole plot is one `role="slider"` control (arrow keys, Home/End, Page Up/Down, Escape for today; a tap picks the nearest day), because 30 bars on a phone are about 9 px wide, below the WCAG 2.2 target size of 24 px. Bars are decoration.

## Tokens (`app/assets/css/main.css`)
| Role | Light | Dark | Tailwind |
|---|---|---|---|
| Page | `#f4f3ee` | `#121211` | `bg-bg` |
| Surface (cards, sheets) | `#fcfcfb` | `#1a1a19` | `bg-surface` |
| Subtle surface | `#ecebe5` | `#252523` | `bg-surface-2` |
| Ink / secondary / muted | `#0b0b0b` / `#52514e` / `#6b6a66` | `#f0efec` / `#c3c2b7` / `#a3a29b` | `text-ink`, `text-ink-2`, `text-muted` |
| Lines | `#e1e0d9` / `#c3c2b7` | `#2c2c2a` / `#383835` | `border-line`, `border-line-strong` |
| Primary action | ink on paper (inverted in dark) | | `bg-primary text-on-primary` |
| Data (charts) | `#2a78d6` | `#3987e5` | `var(--data)` |
| Good / critical text | `#006300` / `#b42828` | `#2fbf2f` / `#f08585` | `text-good`, `text-critical` |

Dark mode is chosen, not inverted: each token has its own dark value. It follows the device, or Settings → Appearance (`data-theme` on `<html>`).

## Typography and spacing
System font stack. Tabular numbers (`.num`) for money in lists. Hero figure `text-5xl` semibold. Spacing in Tailwind's 4 px scale: cards `p-4`/`p-5`, page sections `space-y-5`/`space-y-6`.

## Components (in-house, no library)
`.btn` / `.btn-primary` / `.btn-ghost` / `.btn-danger` / `.icon-btn`, `.field` + `.label`, `.chip` with `aria-pressed`, `.card`, `BaseSheet` (native `<dialog>`, bottom sheet on phones and centered on desktop), `ToastHost` (one toast, optional Undo), `TxList`, `DayStrip`, `CategoryBars`, `TrendBars`, `PeriodNav`, `SyncBadge`.

## Layout
- **Phone:** sticky top bar (name, sync badge, settings), content up to `max-w-3xl`, bottom tab bar with the raised **+** in the thumb zone.
- **Desktop (1024+):** left sidebar with an "Add expense" button and N shortcut hint.
- Sign-in uses its own centered layout.

## Feedback patterns
| State | Pattern |
|---|---|
| Saved | Toast "₱150.00 saved · Undo" (5 s) |
| Validation | Red message under the field, `aria-invalid`, focus moves to the first invalid field |
| Server error | Form: alert box above the fields. Background save: toast "Not saved: …" |
| Offline | Sync badge "Offline, N changes waiting". Everything still works. |
| Saving | Sync badge "Saving…" (only while changes are queued) |
| Loading | "Loading your household…" on first load only (later loads come from the device cache) |
| Can't reach server and no cache | Card with "Try again" |
| Empty | One quiet sentence ("Nothing logged today.") plus the obvious next action |

## Charts
Single series in the data hue. Budget meters use the light data track. Over budget uses the critical color **with** an icon and text. Near the limit uses warning **with** an icon and text. A hover/focus readout row replaces tooltips. Every bar is a button with an `aria-label`.

## Rules
- Touch targets 44 px or more for primary actions. Visible focus ring (`--focus`).
- No em dashes in visible copy. One `.eyebrow` at most (none used).
- Motion level 1: the sheet slides in (200 ms), and `prefers-reduced-motion` removes it.
- Don't add gradients, decorative shadows, nested cards, or new colors outside the tokens.

## Landing page (Direction A "Listahan", ADR-007)
- **Layout:** `marketing` (header with anchors, "Try free" or "Open app", simple footer). Sections: hero + calculator, the problem ("Saan napunta ang sweldo?"), How it works (numbered: real order), One ledger for the whole house, Built for how Filipino families really spend, Pricing, FAQ (`<details>`), closing CTA.
- **Type:** Fraunces 600 (`font-serif`) for headings, the hero number and the price only. Everything else is the system font.
- **Notebook motif:** faint ruled lines (`.ruled`) behind the hero and closing CTA; the red margin line (`--margin`) on the calculator, the ledger example and the pricing card; a red underline under "today". The red is decoration, never status.
- **Calculator:** the signature (see `CREATIVE_DIRECTION.md`). The first render shows a fixed example; real days to payday are counted after load. Fields stack below 420 px.
- **Copy rules:** no testimonials, user numbers or savings claims; example data is labeled "Example entries"; prices as "₱150 / month".

## Name and voice (2026-11-10)
- Full name **Tingbits Expense Tracker** in titles, sign-in and search; **Tingbits** in the app header and on the home-screen icon.
- The landing page's one eyebrow defines the word: "ting·bits (Bisaya) · the broke days before payday". The closing line is "Goodbye, tingbits."
- Frame tingbits as what the app ends, never as who the customer is. Bisaya and Tagalog money words are welcome. New Bisaya phrases need a native speaker's check.
