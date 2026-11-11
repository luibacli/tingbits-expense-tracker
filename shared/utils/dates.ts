import type { Frequency, ISODate, Period } from '#shared/types'

const pad = (n: number) => String(n).padStart(2, '0')

export function toISODate(d: Date): ISODate {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Parse `YYYY-MM-DD` as a local date at noon (noon avoids DST edge cases). */
export function parseISODate(s: ISODate): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y!, (m ?? 1) - 1, d ?? 1, 12)
}

export function todayISO(): ISODate {
  return toISODate(new Date())
}

export function addDays(s: ISODate, n: number): ISODate {
  const d = parseISODate(s)
  d.setDate(d.getDate() + n)
  return toISODate(d)
}

/** Add months, clamping the day (Jan 31 + 1 month = Feb 28/29). */
export function addMonths(s: ISODate, n: number, preferredDay?: number): ISODate {
  const d = parseISODate(s)
  const day = preferredDay ?? d.getDate()
  const target = new Date(d.getFullYear(), d.getMonth() + n, 1, 12)
  const last = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate()
  target.setDate(Math.min(day, last))
  return toISODate(target)
}

export function daysBetween(a: ISODate, b: ISODate): number {
  return Math.round((parseISODate(b).getTime() - parseISODate(a).getTime()) / 86_400_000)
}

/**
 * The budget period containing `date`, for periods that start on `startDay` (1-28).
 * `offset` moves whole periods back (-1) or forward (+1).
 */
export function periodFor(date: ISODate, startDay: number, offset = 0): Period {
  const d = parseISODate(date)
  let y = d.getFullYear()
  let m = d.getMonth()
  if (d.getDate() < startDay) m -= 1
  m += offset
  const startDate = new Date(y, m, startDay, 12)
  y = startDate.getFullYear()
  m = startDate.getMonth()
  const start = toISODate(startDate)
  const end = addDays(toISODate(new Date(y, m + 1, startDay, 12)), -1)
  return { start, end, days: daysBetween(start, end) + 1 }
}

export function inPeriod(date: ISODate, p: Period): boolean {
  return date >= p.start && date <= p.end
}

export function nextOccurrence(date: ISODate, freq: Frequency, anchorDay?: number): ISODate {
  if (freq === 'weekly') return addDays(date, 7)
  if (freq === 'yearly') return addMonths(date, 12, anchorDay)
  return addMonths(date, 1, anchorDay)
}

const fmtCache = new Map<string, Intl.DateTimeFormat>()
function fmt(opts: Intl.DateTimeFormatOptions) {
  const key = JSON.stringify(opts)
  let f = fmtCache.get(key)
  if (!f) {
    f = new Intl.DateTimeFormat(undefined, opts)
    fmtCache.set(key, f)
  }
  return f
}

export function formatDay(s: ISODate, today = todayISO()): string {
  if (s === today) return 'Today'
  if (s === addDays(today, -1)) return 'Yesterday'
  const sameYear = s.slice(0, 4) === today.slice(0, 4)
  return fmt({ weekday: 'short', month: 'short', day: 'numeric', ...(sameYear ? {} : { year: 'numeric' }) }).format(parseISODate(s))
}

export function formatShortDate(s: ISODate): string {
  return fmt({ month: 'short', day: 'numeric' }).format(parseISODate(s))
}

export function formatPeriod(p: Period): string {
  const s = parseISODate(p.start)
  if (s.getDate() === 1) return fmt({ month: 'long', year: 'numeric' }).format(s)
  return `${formatShortDate(p.start)} to ${formatShortDate(p.end)}`
}

export function formatPeriodShort(p: Period): string {
  const s = parseISODate(p.start)
  if (s.getDate() === 1) return fmt({ month: 'short' }).format(s)
  return formatShortDate(p.start)
}
