import type { Cents } from '#shared/types'

export const CURRENCIES = [
  'PHP', 'USD', 'EUR', 'GBP', 'JPY', 'SGD', 'AUD', 'CAD', 'NZD', 'HKD', 'KRW', 'CNY', 'INR',
  'IDR', 'MYR', 'THB', 'VND', 'AED', 'SAR', 'QAR', 'KWD', 'CHF', 'SEK', 'NOK', 'DKK', 'MXN', 'BRL', 'ZAR',
] as const

/** New households start in pesos: the product is for Filipino families and priced in PHP. Changeable in setup and Settings. */
export const DEFAULT_CURRENCY = 'PHP'

const formatters = new Map<string, Intl.NumberFormat>()
function formatter(currency: string, compact: boolean) {
  const key = `${currency}|${compact}`
  let f = formatters.get(key)
  if (!f) {
    try {
      f = new Intl.NumberFormat(undefined, compact
        ? { style: 'currency', currency, notation: 'compact', maximumFractionDigits: 1 }
        : { style: 'currency', currency })
    } catch {
      f = new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    }
    formatters.set(key, f)
  }
  return f
}

export function formatMoney(cents: Cents, currency: string, opts: { compact?: boolean, sign?: boolean } = {}): string {
  const value = cents / 100
  const f = formatter(currency, !!opts.compact && Math.abs(value) >= 10_000)
  const text = f.format(Math.abs(value))
  if (value < 0) return `−${text}`
  if (opts.sign && value > 0) return `+${text}`
  return text
}

export function currencySymbol(currency: string): string {
  try {
    const part = new Intl.NumberFormat(undefined, { style: 'currency', currency, currencyDisplay: 'narrowSymbol' })
      .formatToParts(0).find((p) => p.type === 'currency')
    return part?.value ?? currency
  } catch {
    return currency
  }
}

/**
 * Parse what someone typed into an amount field. Accepts thousands separators and simple
 * sums, so "120+45.50" adds up a receipt. Returns cents, or null when it isn't a valid positive amount.
 */
export function parseAmount(input: string): Cents | null {
  const s = input.replace(/[\s,]/g, '').replace(/[^\d.+\-]/g, '')
  if (!s || !/^[+\-]?\d*\.?\d*([+\-]\d*\.?\d*)*$/.test(s)) return null
  const terms = s.match(/[+\-]?[^+\-]+/g)
  if (!terms) return null
  let total = 0
  for (const t of terms) {
    const n = Number(t)
    if (!Number.isFinite(n)) return null
    total += Math.round(n * 100)
  }
  return total > 0 ? total : null
}

/** Cents to a plain editable string, e.g. 12050 -> "120.50", 12000 -> "120". */
export function centsToInput(cents: Cents): string {
  const v = cents / 100
  return Number.isInteger(v) ? String(v) : v.toFixed(2)
}
