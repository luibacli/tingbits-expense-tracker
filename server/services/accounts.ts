import { createError } from 'h3'
import { Types } from 'mongoose'
import { HouseholdModel, RecurringModel, TransactionModel, UserModel } from '../models'
import { hashPassword, newInviteCode, verifyPassword } from './auth'

/*
 * Account management (business rules A7 to A10). Every check reads the database, and sessions
 * are re-checked against the database on each request, so a removed account or a role change
 * takes effect on the next request. Entries an account added stay in the household.
 */

const fail = (statusCode: number, code: string, statusMessage: string, fields?: Record<string, string>) =>
  createError({ statusCode, statusMessage, data: { code, ...(fields ? { fields } : {}) } })

async function checkPassword(userId: Types.ObjectId, password: string): Promise<void> {
  const user = await UserModel.findById(userId).select('+passwordHash')
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    throw fail(401, 'BAD_PASSWORD', 'Password is incorrect.', { password: 'That password is not right.' })
  }
}

/** Owner removes another account from the household. The account is deleted; its entries stay. */
export async function removeAccount(householdId: Types.ObjectId, ownerId: Types.ObjectId, accountId: string): Promise<void> {
  if (!Types.ObjectId.isValid(accountId)) throw fail(404, 'NOT_FOUND', 'Account not found.')
  if (String(ownerId) === accountId) throw fail(400, 'VALIDATION', 'Use "Delete my account" to remove yourself.')
  const res = await UserModel.deleteOne({ _id: accountId, household: householdId, role: 'member' })
  if (res.deletedCount !== 1) throw fail(404, 'NOT_FOUND', 'Account not found.')
}

/** Owner hands ownership to another account in the household and becomes a member. */
export async function transferOwnership(householdId: Types.ObjectId, ownerId: Types.ObjectId, accountId: string, password: string): Promise<void> {
  if (!Types.ObjectId.isValid(accountId)) throw fail(404, 'NOT_FOUND', 'Account not found.')
  if (String(ownerId) === accountId) throw fail(400, 'VALIDATION', 'You already own this household.')
  await checkPassword(ownerId, password)
  // Promote first, then step down: if the second write fails the household briefly has two
  // owners, never none.
  const promoted = await UserModel.updateOne({ _id: accountId, household: householdId, role: 'member' }, { $set: { role: 'owner' } })
  if (promoted.matchedCount !== 1) throw fail(404, 'NOT_FOUND', 'Account not found.')
  await UserModel.updateOne({ _id: ownerId }, { $set: { role: 'member' } })
}

/**
 * Delete the signed-in account. A member just leaves. An owner who shares the household must
 * transfer ownership first; an owner who is the only account deletes the whole household.
 */
export async function deleteOwnAccount(userId: Types.ObjectId, password: string): Promise<{ householdDeleted: boolean }> {
  await checkPassword(userId, password)
  const user = await UserModel.findById(userId).lean()
  if (!user) throw fail(404, 'NOT_FOUND', 'Account not found.')
  const householdId = user.household as Types.ObjectId
  if (user.role !== 'owner') {
    await UserModel.deleteOne({ _id: userId })
    return { householdDeleted: false }
  }
  // Retire the invite code first so nobody can join while the household is being removed.
  await HouseholdModel.updateOne({ _id: householdId }, { $set: { inviteCode: newInviteCode() } })
  const others = await UserModel.countDocuments({ household: householdId, _id: { $ne: userId } })
  if (others > 0) {
    throw fail(409, 'OWNER_MUST_TRANSFER', 'Make someone else the owner first, or remove the other accounts.')
  }
  await Promise.all([
    TransactionModel.deleteMany({ household: householdId }),
    RecurringModel.deleteMany({ household: householdId }),
  ])
  await HouseholdModel.deleteOne({ _id: householdId })
  await UserModel.deleteOne({ _id: userId })
  return { householdDeleted: true }
}

/**
 * Change the password and bump the session version, which signs out every other device
 * (their cookies carry the old version). Returns the new version so the caller can keep
 * the current device signed in.
 */
export async function changePassword(userId: Types.ObjectId, current: string, next: string): Promise<number> {
  await checkPassword(userId, current)
  const user = await UserModel.findOneAndUpdate(
    { _id: userId },
    { $set: { passwordHash: await hashPassword(next) }, $inc: { sessionVersion: 1 } },
    { returnDocument: 'after' },
  ).lean()
  return user?.sessionVersion ?? 0
}
