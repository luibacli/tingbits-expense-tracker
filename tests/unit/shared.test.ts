import { describe, expect, it } from 'vitest'
import { addMonths, nextOccurrence, periodFor } from '#shared/utils/dates'
import { parseAmount } from '#shared/utils/money'
import { dailyPace } from '#shared/utils/stats'
import { normalizeData, validateRecurring, validateRegister, validateTx } from '#shared/utils/validate'
import type { Transaction } from '#shared/types'

const tx = (date: string, amount: number, type: 'expense' | 'income' = 'expense'): Transaction => ({
  id: date + amount, type, amount, categoryId: 'food', note: '', date, memberId: null, methodId: null, recurringId: null, createdAt: 0,
})

describe('budget periods', () => {
  it('calendar month when the period starts on day 1', () => {
    expect(periodFor('2026-02-14', 1)).toEqual({ start: '2026-02-01', end: '2026-02-28', days: 28 })
  })
  it('payday cycle starting on the 15th', () => {
    expect(periodFor('2026-11-09', 15)).toEqual({ start: '2026-10-15', end: '2026-11-14', days: 31 })
    expect(periodFor('2026-11-15', 15).start).toBe('2026-11-15')
  })
  it('moves whole periods with an offset, across a year boundary', () => {
    expect(periodFor('2026-01-10', 1, -1)).toEqual({ start: '2025-12-01', end: '2025-12-31', days: 31 })
  })
  it('monthly recurrence keeps the 31st where it can', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28')
    expect(nextOccurrence('2026-02-28', 'monthly', 31)).toBe('2026-03-31')
  })
})

describe('amount input', () => {
  it('adds up a receipt and ignores separators', () => {
    expect(parseAmount('120+45.50')).toBe(16550)
    expect(parseAmount('1,250')).toBe(125000)
  })
  it('rejects zero, negatives and junk', () => {
    expect(parseAmount('0')).toBeNull()
    expect(parseAmount('10-20')).toBeNull()
    expect(parseAmount('abc')).toBeNull()
  })
})

describe('safe to spend today', () => {
  const p = periodFor('2026-11-10', 1) // 30 days
  it('spreads the remaining budget over the remaining days, counting today', () => {
    const pace = dailyPace([tx('2026-11-01', 900000)], p, 3000000, '2026-11-10')
    // 30,000 - 9,000 spent before today = 21,000 over 21 days = 1,000 a day
    expect(pace.dailyAllowance).toBe(100000)
    expect(pace.leftToday).toBe(100000)
  })
  it('spending today lowers only today', () => {
    const pace = dailyPace([tx('2026-11-10', 150000)], p, 3000000, '2026-11-10')
    expect(pace.leftToday).toBe(Math.floor(3000000 / 21) - 150000)
  })
  it('ignores income and other periods', () => {
    const pace = dailyPace([tx('2026-11-02', 500000, 'income'), tx('2026-10-30', 999999)], p, 3000000, '2026-11-10')
    expect(pace.spent).toBe(0)
  })
})

describe('server-boundary validation', () => {
  it('accepts a valid entry and trims the note', () => {
    const r = validateTx({ id: 'a1', type: 'expense', amount: 1500, categoryId: 'food', date: '2026-11-09', note: '  Lunch ', memberId: null, methodId: 'cash' })
    expect(r).toEqual({ ok: true, value: expect.objectContaining({ note: 'Lunch', amount: 1500 }) })
  })
  it('rejects bad amounts, dates and injected operators', () => {
    const r = validateTx({ id: 'a1', type: 'expense', amount: -5, categoryId: { $ne: null }, date: '2026-13-45' })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(Object.keys(r.fields).sort()).toEqual(['amount', 'categoryId', 'date'])
  })
  it('partial updates check only the fields sent', () => {
    expect(validateTx({ amount: 2000 }, true)).toEqual({ ok: true, value: { amount: 2000 } })
  })
  it('recurring items need a name and a frequency', () => {
    const r = validateRecurring({ id: 'r1', type: 'expense', amount: 100, categoryId: 'bills', nextDate: '2026-11-01', note: '', frequency: 'daily' })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.fields).toMatchObject({ note: expect.any(String), frequency: expect.any(String) })
  })
  it('new households default to pesos when no currency is sent', () => {
    expect(validateRegister({ name: 'A', email: 'a@example.com', password: 'longenough' })).toMatchObject({ ok: true, value: { currency: 'PHP' } })
    expect(validateRegister({ name: 'A', email: 'a@example.com', password: 'longenough', currency: 'USD' })).toMatchObject({ ok: true, value: { currency: 'USD' } })
  })
  it('registration normalises email and requires 8+ character passwords', () => {
    expect(validateRegister({ name: 'A', email: ' Me@Example.COM ', password: 'short' }).ok).toBe(false)
    const ok = validateRegister({ name: 'A', email: ' Me@Example.COM ', password: 'longenough', inviteCode: 'abcd2345' })
    expect(ok).toMatchObject({ ok: true, value: { email: 'me@example.com', inviteCode: 'ABCD2345' } })
  })
  it('backup import drops invalid rows instead of failing', () => {
    const d = normalizeData({ version: 1, transactions: [{ id: 'x', type: 'expense', amount: 100, categoryId: 'food', date: '2026-11-01' }, { id: 'bad' }] })
    expect(d?.transactions).toHaveLength(1)
    expect(normalizeData({ version: 2 })).toBeNull()
  })
})
