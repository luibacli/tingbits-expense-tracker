import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { authenticate, registerUser } from '../../server/services/auth'
import { createRecurring, createTransaction, deleteTransaction, exportAll, importBackup, listTransactions, payRecurring, postDueRecurring, updateTransaction } from '../../server/services/ledger'
import { HouseholdModel, TransactionModel } from '../../server/models'
import { getHouseholdDoc } from '../../server/services/household'
import { assertWritable, ensureTrial, extendPaidThrough, stateOf } from '../../server/services/subscription'

let mongo: MongoMemoryServer

beforeAll(async () => {
  mongo = await MongoMemoryServer.create()
  await mongoose.connect(mongo.getUri())
  await Promise.all(Object.values(mongoose.models).map((m) => m.syncIndexes()))
})
afterAll(async () => {
  await mongoose.disconnect()
  await mongo.stop()
})
beforeEach(async () => {
  await mongoose.connection.db!.dropDatabase()
  await Promise.all(Object.values(mongoose.models).map((m) => m.syncIndexes()))
})

const owner = (email = 'owner@example.com') => registerUser({ name: 'Luigi', email, password: 'password123', householdName: 'Home', inviteCode: null, currency: 'PHP', timezone: 'Asia/Manila' })
const entry = (id: string, date = '2026-11-09', amount = 15000) => ({ id, type: 'expense' as const, amount, categoryId: 'food', note: 'Lunch', date, memberId: null, methodId: null })

describe('accounts', () => {
  it('first account owns a new household; an invite code joins it', async () => {
    const a = await owner()
    const h = await HouseholdModel.findById(a.householdId).lean()
    const b = await registerUser({ name: 'Partner', email: 'partner@example.com', password: 'password123', householdName: null, inviteCode: h!.inviteCode, currency: 'USD', timezone: 'UTC' })
    expect(String(b.householdId)).toBe(String(a.householdId))
    const after = await HouseholdModel.findById(a.householdId).lean()
    expect(after!.members.map((m) => m.name)).toEqual(['Luigi', 'Partner'])
  })
  it('rejects a duplicate email and a wrong invite code', async () => {
    await owner()
    await expect(owner()).rejects.toMatchObject({ statusCode: 409 })
    await expect(registerUser({ name: 'X', email: 'x@example.com', password: 'password123', householdName: null, inviteCode: 'NOPE2345', currency: 'PHP', timezone: 'UTC' })).rejects.toMatchObject({ statusCode: 404 })
  })
  it('signs in with the right password only, with the same error for unknown emails', async () => {
    await owner()
    await expect(authenticate('owner@example.com', 'password123')).resolves.toBeTruthy()
    const wrong = await authenticate('owner@example.com', 'nope').catch((e) => e)
    const unknown = await authenticate('nobody@example.com', 'nope').catch((e) => e)
    expect(wrong.statusCode).toBe(401)
    expect(unknown.statusMessage).toBe(wrong.statusMessage)
  })
})

describe('entries', () => {
  it('a create retried with the same id is stored once', async () => {
    const { householdId, userId } = await owner()
    await createTransaction(householdId, userId, entry('t1'))
    await createTransaction(householdId, userId, entry('t1'))
    expect(await TransactionModel.countDocuments()).toBe(1)
  })
  it('households cannot read, change or delete each other’s entries', async () => {
    const a = await owner('a@example.com')
    const b = await owner('b@example.com')
    await createTransaction(a.householdId, a.userId, entry('secret'))
    expect(await listTransactions(b.householdId, '2000-01-01')).toEqual([])
    await expect(updateTransaction(b.householdId, 'secret', { amount: 1 })).rejects.toMatchObject({ statusCode: 404 })
    await deleteTransaction(b.householdId, 'secret')
    await expect(createTransaction(b.householdId, b.userId, entry('secret'))).rejects.toMatchObject({ statusCode: 409 })
    expect(await TransactionModel.findById('secret').lean()).toMatchObject({ amount: 15000 })
  })
  it('lists a date range newest first', async () => {
    const { householdId, userId } = await owner()
    for (const d of ['2026-10-01', '2026-11-01', '2026-11-05']) await createTransaction(householdId, userId, entry(d, d))
    const list = await listTransactions(householdId, '2026-10-15')
    expect(list.map((t) => t.date)).toEqual(['2026-11-05', '2026-11-01'])
  })
})

describe('recurring', () => {
  it('auto items catch up missed months exactly once, even if run twice', async () => {
    const { householdId } = await owner()
    await createRecurring(householdId, { id: 'rent', type: 'expense', amount: 1200000, categoryId: 'home', note: 'Rent', memberId: null, methodId: null, frequency: 'monthly', nextDate: '2026-09-05', auto: true }, '2026-11-09')
    expect(await postDueRecurring(householdId, '2026-11-09')).toBe(0)
    const posted = await TransactionModel.find({ recurringId: 'rent' }).sort({ date: 1 }).lean()
    expect(posted.map((t) => t.date)).toEqual(['2026-09-05', '2026-10-05', '2026-11-05'])
  })
  it('mark paid is safe to retry and advances the due date once', async () => {
    const { householdId, userId } = await owner()
    await createRecurring(householdId, { id: 'power', type: 'expense', amount: 300000, categoryId: 'bills', note: 'Meralco', memberId: null, methodId: null, frequency: 'monthly', nextDate: '2026-11-09', auto: false }, '2026-11-09')
    const body = { transactionId: 'pay1', date: '2026-11-09', from: '2026-11-09' }
    await payRecurring(householdId, userId, 'power', body)
    const again = await payRecurring(householdId, userId, 'power', body)
    expect(again.recurring.nextDate).toBe('2026-12-09')
    expect(await TransactionModel.countDocuments({ recurringId: 'power' })).toBe(1)
  })
})

describe('backup import', () => {
  it('a backup restored into another household gets its own copies, still idempotent', async () => {
    const a = await owner('a@example.com')
    const b = await owner('b@example.com')
    await createTransaction(a.householdId, a.userId, entry('shared-id'))
    const backup = await exportAll(await getHouseholdDoc(a.householdId))
    const first = await importBackup(await getHouseholdDoc(b.householdId), b.userId, backup)
    const second = await importBackup(await getHouseholdDoc(b.householdId), b.userId, backup)
    expect(first.entries).toBe(1)
    expect(second.entries).toBe(0)
    expect(await listTransactions(b.householdId, '2000-01-01')).toHaveLength(1)
    expect(await listTransactions(a.householdId, '2000-01-01')).toHaveLength(1)
  })

  it('merges without overwriting and is idempotent', async () => {
    const { householdId, userId } = await owner()
    await createTransaction(householdId, userId, entry('keep', '2026-11-01', 999))
    const backup = {
      version: 1 as const,
      transactions: [{ ...entry('keep', '2026-11-01', 1), recurringId: null, createdAt: 0 }, { ...entry('new1'), recurringId: null, createdAt: 0 }],
      categories: [{ id: 'pets', name: 'Pets', emoji: '🐶', kind: 'expense' as const, budget: null, archived: false }],
      members: [{ id: 'me', name: 'Me' }], methods: [], recurring: [],
      settings: { currency: 'PHP', monthlyBudget: 3000000, periodStartDay: 1, theme: 'system' as const, defaultMemberId: null, defaultMethodId: null, setupDone: true },
    }
    const first = await importBackup(await getHouseholdDoc(householdId), userId, backup)
    const second = await importBackup(await getHouseholdDoc(householdId), userId, backup)
    expect(first).toMatchObject({ entries: 1, skipped: 1 })
    expect(second).toMatchObject({ entries: 0 })
    expect((await TransactionModel.findById('keep').lean())!.amount).toBe(999)
    const h = await getHouseholdDoc(householdId)
    expect(h.categories.filter((c) => c.id === 'pets')).toHaveLength(1)
    expect(h.monthlyBudget).toBe(3000000)
    expect((await exportAll(h)).transactions).toHaveLength(2)
  })
})

describe('subscription', () => {
  it('sign-up starts a 30-day trial; an old household gets one on first read, only once', async () => {
    const { householdId } = await owner()
    const h = await getHouseholdDoc(householdId)
    expect(stateOf(h)).toMatchObject({ status: 'trial', daysLeft: 30 })
    await HouseholdModel.updateOne({ _id: householdId }, { $unset: { trialEndsAt: '' } })
    const first = await ensureTrial(await getHouseholdDoc(householdId))
    const second = await ensureTrial(await getHouseholdDoc(householdId), new Date(Date.now() + 86_400_000))
    expect(second.trialEndsAt!.getTime()).toBe(first.trialEndsAt!.getTime())
  })
  it('expired households are refused with 402; paying extends from the later date', async () => {
    const { householdId } = await owner()
    await HouseholdModel.updateOne({ _id: householdId }, { $set: { trialEndsAt: new Date(Date.now() - 1000) } })
    const h = await getHouseholdDoc(householdId)
    expect(() => assertWritable(h)).toThrowError(expect.objectContaining({ statusCode: 402 }))
    const until = await extendPaidThrough(householdId, 1)
    const again = await extendPaidThrough(householdId, 1)
    expect(again.getTime()).toBeGreaterThan(until.getTime())
    expect(() => assertWritable(h)).toThrow()
    expect(() => assertWritable({ ...h, paidThrough: again })).not.toThrow()
  })
})
