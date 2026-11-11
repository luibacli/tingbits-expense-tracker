import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { authenticate, registerUser } from '../../server/services/auth'
import { changePassword, deleteOwnAccount, removeAccount, transferOwnership } from '../../server/services/accounts'
import { createTransaction } from '../../server/services/ledger'
import { HouseholdModel, RecurringModel, TransactionModel, UserModel } from '../../server/models'
import { validateDeleteAccount, validatePasswordChange, validateTransfer } from '../../shared/utils/validate'

let mongo: MongoMemoryServer
beforeAll(async () => {
  mongo = await MongoMemoryServer.create()
  await mongoose.connect(mongo.getUri())
})
afterAll(async () => {
  await mongoose.disconnect()
  await mongo.stop()
})
beforeEach(async () => {
  await mongoose.connection.db!.dropDatabase()
  await Promise.all(Object.values(mongoose.models).map((m) => m.syncIndexes()))
})

const PW = 'password123'
const reg = (email: string, inviteCode: string | null = null) =>
  registerUser({ name: email.split('@')[0]!, email, password: PW, householdName: 'Home', inviteCode, currency: 'PHP', timezone: 'Asia/Manila' })

async function family() {
  const owner = await reg('owner@example.com')
  const h = await HouseholdModel.findById(owner.householdId).lean()
  const member = await reg('member@example.com', h!.inviteCode)
  return { owner, member, householdId: owner.householdId }
}
const roleOf = async (id: mongoose.Types.ObjectId) => (await UserModel.findById(id).lean())?.role
const entry = (id: string) => ({ id, type: 'expense' as const, amount: 15000, categoryId: 'food', note: '', date: '2026-11-09', memberId: null, methodId: null })

describe('remove account', () => {
  it('deletes the member account and keeps the entries they added', async () => {
    const { owner, member, householdId } = await family()
    await createTransaction(householdId, member.userId, entry('t1'))
    await removeAccount(householdId, owner.userId, String(member.userId))
    expect(await UserModel.exists({ _id: member.userId })).toBeNull()
    expect(await TransactionModel.countDocuments({ household: householdId })).toBe(1)
    await expect(authenticate('member@example.com', PW)).rejects.toMatchObject({ statusCode: 401 })
  })
  it('cannot remove yourself, an account in another household, or a bad id', async () => {
    const { owner, householdId } = await family()
    const stranger = await reg('stranger@example.com')
    await expect(removeAccount(householdId, owner.userId, String(owner.userId))).rejects.toMatchObject({ statusCode: 400 })
    await expect(removeAccount(householdId, owner.userId, String(stranger.userId))).rejects.toMatchObject({ statusCode: 404 })
    await expect(removeAccount(householdId, owner.userId, 'nope')).rejects.toMatchObject({ statusCode: 404 })
    expect(await UserModel.exists({ _id: stranger.userId })).not.toBeNull()
  })
})

describe('transfer ownership', () => {
  it('swaps roles after the password is checked', async () => {
    const { owner, member, householdId } = await family()
    await expect(transferOwnership(householdId, owner.userId, String(member.userId), 'wrong-password')).rejects.toMatchObject({ statusCode: 401 })
    expect(await roleOf(member.userId)).toBe('member')
    await transferOwnership(householdId, owner.userId, String(member.userId), PW)
    expect(await roleOf(member.userId)).toBe('owner')
    expect(await roleOf(owner.userId)).toBe('member')
  })
  it('cannot hand the household to an account in another household', async () => {
    const { owner, householdId } = await family()
    const stranger = await reg('stranger@example.com')
    await expect(transferOwnership(householdId, owner.userId, String(stranger.userId), PW)).rejects.toMatchObject({ statusCode: 404 })
    expect(await roleOf(owner.userId)).toBe('owner')
    expect(await roleOf(stranger.userId)).toBe('owner')
  })
})

describe('delete own account', () => {
  it('a member leaves; the household and its entries stay', async () => {
    const { member, householdId } = await family()
    await createTransaction(householdId, member.userId, entry('t1'))
    await expect(deleteOwnAccount(member.userId, 'wrong-password')).rejects.toMatchObject({ statusCode: 401 })
    expect(await deleteOwnAccount(member.userId, PW)).toEqual({ householdDeleted: false })
    expect(await HouseholdModel.exists({ _id: householdId })).not.toBeNull()
    expect(await TransactionModel.countDocuments({ household: householdId })).toBe(1)
  })
  it('an owner who shares the household must transfer first, and the invite code is retired', async () => {
    const { owner, householdId } = await family()
    const before = (await HouseholdModel.findById(householdId).lean())!.inviteCode
    await expect(deleteOwnAccount(owner.userId, PW)).rejects.toMatchObject({ statusCode: 409, data: { code: 'OWNER_MUST_TRANSFER' } })
    expect(await UserModel.exists({ _id: owner.userId })).not.toBeNull()
    expect((await HouseholdModel.findById(householdId).lean())!.inviteCode).not.toBe(before)
  })
  it('a sole owner deletes the household and all its data, and nothing else', async () => {
    const { owner, member, householdId } = await family()
    const other = await reg('other@example.com')
    await createTransaction(other.householdId, other.userId, entry('o1'))
    await createTransaction(householdId, owner.userId, entry('t1'))
    await RecurringModel.create({ _id: 'r1', household: householdId, type: 'expense', amount: 100, categoryId: 'food', note: 'Rent', frequency: 'monthly', nextDate: '2026-12-01' })
    expect(await RecurringModel.countDocuments({ household: householdId })).toBe(1)
    await removeAccount(householdId, owner.userId, String(member.userId))
    expect(await deleteOwnAccount(owner.userId, PW)).toEqual({ householdDeleted: true })
    expect(await HouseholdModel.exists({ _id: householdId })).toBeNull()
    expect(await TransactionModel.countDocuments({ household: householdId })).toBe(0)
    expect(await RecurringModel.countDocuments({ household: householdId })).toBe(0)
    expect(await UserModel.countDocuments({})).toBe(1)
    expect(await TransactionModel.countDocuments({ household: other.householdId })).toBe(1)
  })
})

describe('change password', () => {
  it('needs the current password; the new one works afterwards', async () => {
    const { member } = await family()
    await expect(changePassword(member.userId, 'wrong-password', 'new-password-1')).rejects.toMatchObject({ statusCode: 401 })
    await changePassword(member.userId, PW, 'new-password-1')
    await expect(authenticate('member@example.com', PW)).rejects.toMatchObject({ statusCode: 401 })
    await expect(authenticate('member@example.com', 'new-password-1')).resolves.toBeTruthy()
  })
})

describe('account validators', () => {
  it('check ids, passwords and the DELETE confirmation', () => {
    expect(validateTransfer({ accountId: 'x', password: 'p' }).ok).toBe(false)
    expect(validateTransfer({ accountId: 'a'.repeat(24), password: 'p' }).ok).toBe(true)
    expect(validateDeleteAccount({ password: 'p' }).ok).toBe(false)
    expect(validateDeleteAccount({ password: 'p', confirm: 'DELETE' }).ok).toBe(true)
    expect(validatePasswordChange({ current: 'p', next: 'short' }).ok).toBe(false)
    expect(validatePasswordChange({ current: 'p', next: 'long-enough' }).ok).toBe(true)
  })
})
