import type { AppData, Cents, ISODate, Period, Transaction } from '#shared/types'
import { addDays, daysBetween, inPeriod } from './dates'

export function txInPeriod(txs: Transaction[], p: Period): Transaction[] {
  return txs.filter((t) => inPeriod(t.date, p))
}

export function sumBy(txs: Transaction[], type: 'expense' | 'income'): Cents {
  let s = 0
  for (const t of txs) if (t.type === type) s += t.amount
  return s
}

/** The overall budget: the explicit monthly budget, else the sum of category budgets, else null. */
export function effectiveBudget(data: AppData): Cents | null {
  if (data.settings.monthlyBudget) return data.settings.monthlyBudget
  const sum = data.categories.reduce((s, c) => s + (c.kind === 'expense' && !c.archived && c.budget ? c.budget : 0), 0)
  return sum > 0 ? sum : null
}

export interface DailyPace {
  budget: Cents
  spent: Cents
  remaining: Cents
  /** What can be spent per day for the rest of the period, including today, computed from the start of today. */
  dailyAllowance: Cents
  spentToday: Cents
  /** Allowance left for today (negative when over). */
  leftToday: Cents
  daysLeft: number
  projected: Cents
}

/**
 * The home screen's "safe to spend today" number. Spreads what is left of the budget,
 * as of this morning, evenly over the remaining days. Spending today lowers today's figure only;
 * tomorrow it is recomputed, so one big day is absorbed by the days after it.
 */
export function dailyPace(txs: Transaction[], p: Period, budget: Cents, today: ISODate): DailyPace {
  let spentBefore = 0, spentToday = 0
  for (const t of txs) {
    if (t.type !== 'expense' || !inPeriod(t.date, p)) continue
    if (t.date < today) spentBefore += t.amount
    else if (t.date === today) spentToday += t.amount
  }
  const spent = spentBefore + spentToday
  const daysLeft = Math.max(1, daysBetween(today, p.end) + 1)
  const dailyAllowance = Math.max(0, Math.floor((budget - spentBefore) / daysLeft))
  const elapsed = Math.max(1, daysBetween(p.start, today) + 1)
  return {
    budget,
    spent,
    remaining: budget - spent,
    dailyAllowance,
    spentToday,
    leftToday: dailyAllowance - spentToday,
    daysLeft,
    projected: Math.round((spent / elapsed) * p.days),
  }
}

/** Expense totals per day across the period, in order. */
export function dailyTotals(txs: Transaction[], p: Period): Array<{ date: ISODate, total: Cents }> {
  const map = new Map<string, number>()
  for (const t of txs) if (t.type === 'expense' && inPeriod(t.date, p)) map.set(t.date, (map.get(t.date) ?? 0) + t.amount)
  const out: Array<{ date: ISODate, total: Cents }> = []
  for (let d = p.start; d <= p.end; d = addDays(d, 1)) out.push({ date: d, total: map.get(d) ?? 0 })
  return out
}

export function totalsByKey(txs: Transaction[], key: (t: Transaction) => string | null, type: 'expense' | 'income' = 'expense') {
  const map = new Map<string, number>()
  for (const t of txs) {
    if (t.type !== type) continue
    const k = key(t) ?? ''
    map.set(k, (map.get(k) ?? 0) + t.amount)
  }
  return [...map.entries()].map(([id, total]) => ({ id, total })).sort((a, b) => b.total - a.total)
}

export interface Suggestion {
  note: string
  categoryId: string
  amount: Cents
  type: 'expense' | 'income'
  count: number
  last: ISODate
}

/** Things you log often (same note + category), most frequent in the last 90 days first. */
export function frequentEntries(txs: Transaction[], today: ISODate, limit = 8): Suggestion[] {
  const since = addDays(today, -90)
  const map = new Map<string, Suggestion>()
  for (const t of txs) {
    if (t.date < since || !t.note.trim() || t.recurringId) continue
    const key = `${t.type}|${t.categoryId}|${t.note.trim().toLowerCase()}`
    const s = map.get(key)
    if (!s) map.set(key, { note: t.note.trim(), categoryId: t.categoryId, amount: t.amount, type: t.type, count: 1, last: t.date })
    else {
      s.count++
      if (t.date >= s.last) { s.last = t.date; s.amount = t.amount }
    }
  }
  return [...map.values()]
    .filter((s) => s.count >= 2)
    .sort((a, b) => b.count - a.count || (a.last < b.last ? 1 : -1))
    .slice(0, limit)
}

/** Notes matching what is being typed, for autocomplete. Most recent first, unique by note. */
export function noteMatches(txs: Transaction[], query: string, limit = 5): Suggestion[] {
  const q = query.trim().toLowerCase()
  if (q.length < 1) return []
  const seen = new Map<string, Suggestion>()
  const sorted = [...txs].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.createdAt - a.createdAt))
  for (const t of sorted) {
    const n = t.note.trim()
    const key = n.toLowerCase()
    if (!n || !key.includes(q)) continue
    const s = seen.get(key)
    if (s) s.count++
    else seen.set(key, { note: n, categoryId: t.categoryId, amount: t.amount, type: t.type, count: 1, last: t.date })
  }
  return [...seen.values()]
    .sort((a, b) => Number(b.note.toLowerCase().startsWith(q)) - Number(a.note.toLowerCase().startsWith(q)) || b.count - a.count)
    .slice(0, limit)
}

export function toCSV(data: AppData): string {
  const cats = new Map(data.categories.map((c) => [c.id, c.name]))
  const mem = new Map(data.members.map((m) => [m.id, m.name]))
  const met = new Map(data.methods.map((m) => [m.id, m.name]))
  const esc = (v: string) => {
    // Neutralise spreadsheet formula injection, then quote.
    const safe = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v
    return `"${safe.replace(/"/g, '""')}"`
  }
  const rows = [['Date', 'Type', 'Amount', 'Currency', 'Category', 'Note', 'Paid by', 'Method', 'Recurring']]
  const sorted = [...data.transactions].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.createdAt - b.createdAt))
  for (const t of sorted) {
    rows.push([
      t.date, t.type, (t.amount / 100).toFixed(2), data.settings.currency,
      cats.get(t.categoryId) ?? '', t.note, mem.get(t.memberId ?? '') ?? '', met.get(t.methodId ?? '') ?? '',
      t.recurringId ? 'yes' : '',
    ])
  }
  return rows.map((r) => r.map((c, i) => (i === 2 ? c : esc(c))).join(',')).join('\r\n')
}
