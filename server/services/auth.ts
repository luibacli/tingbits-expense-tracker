import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import { createError } from 'h3'
import type { Types } from 'mongoose'
import type { RegisterBody } from '#shared/utils/validate'
import type { SessionUser } from '#shared/types'
import { defaultCategories } from '#shared/utils/defaults'
import { trialEnd } from '#shared/utils/subscription'
import { HouseholdModel, UserModel, type UserDoc } from '../models'

const scryptAsync = promisify(scrypt) as (pw: string, salt: Buffer, len: number, opts: { N: number, r: number, p: number, maxmem: number }) => Promise<Buffer>
const PARAMS = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16)
  const hash = await scryptAsync(password, salt, 64, PARAMS)
  return `scrypt$${PARAMS.N}$${salt.toString('base64')}$${hash.toString('base64')}`
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algo, n, salt, hash] = stored.split('$')
  if (algo !== 'scrypt' || !n || !salt || !hash) return false
  const expected = Buffer.from(hash, 'base64')
  const actual = await scryptAsync(password, Buffer.from(salt, 'base64'), expected.length, { ...PARAMS, N: Number(n) })
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

// Unambiguous characters only (no 0/O, 1/I/L), so a code read aloud is typed correctly.
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
export function newInviteCode(): string {
  const bytes = randomBytes(8)
  return Array.from(bytes, (b) => CODE_CHARS[b % CODE_CHARS.length]).join('')
}

export function toSessionUser(u: Pick<UserDoc, '_id' | 'name' | 'email' | 'role' | 'prefs'>): SessionUser {
  return {
    id: String(u._id),
    name: u.name,
    email: u.email,
    role: u.role as SessionUser['role'],
    prefs: {
      theme: (u.prefs?.theme ?? 'system') as SessionUser['prefs']['theme'],
      defaultMemberId: u.prefs?.defaultMemberId ?? null,
      defaultMethodId: u.prefs?.defaultMethodId ?? null,
    },
  }
}

/**
 * Create an account. Without an invite code the person becomes the owner of a new household;
 * with one they join that household. Each account also gets a "person" in the household so
 * entries can be tagged with who paid.
 */
export async function registerUser(input: RegisterBody): Promise<{ userId: Types.ObjectId, householdId: Types.ObjectId }> {
  if (await UserModel.exists({ email: input.email })) {
    throw createError({ statusCode: 409, statusMessage: 'An account with this email already exists.', data: { code: 'EMAIL_TAKEN', fields: { email: 'An account with this email already exists. Sign in instead.' } } })
  }
  const personId = `p-${randomBytes(6).toString('hex')}`
  let household
  let role: 'owner' | 'member'
  if (input.inviteCode) {
    household = await HouseholdModel.findOneAndUpdate(
      { inviteCode: input.inviteCode },
      { $push: { members: { id: personId, name: input.name } } },
      { returnDocument: 'after' },
    )
    if (!household) {
      throw createError({ statusCode: 404, statusMessage: 'Invite code not found.', data: { code: 'INVITE_NOT_FOUND', fields: { inviteCode: 'That invite code was not found. Check it with the household owner.' } } })
    }
    role = 'member'
  } else {
    household = await HouseholdModel.create({
      name: input.householdName ?? `${input.name}'s household`,
      inviteCode: newInviteCode(),
      currency: input.currency,
      timezone: input.timezone,
      trialEndsAt: trialEnd(),
      categories: defaultCategories(),
      members: [{ id: personId, name: input.name }],
      methods: [
        { id: 'cash', name: 'Cash' },
        { id: 'card', name: 'Card' },
        { id: 'ewallet', name: 'E-wallet' },
        { id: 'bank', name: 'Bank transfer' },
      ],
    })
    role = 'owner'
  }
  try {
    const user = await UserModel.create({
      email: input.email,
      name: input.name,
      passwordHash: await hashPassword(input.password),
      household: household._id,
      role,
      prefs: { theme: 'system', defaultMemberId: personId, defaultMethodId: 'cash' },
    })
    return { userId: user._id, householdId: household._id }
  } catch (err) {
    // Two sign-ups racing on one email: the unique index decides.
    if ((err as { code?: number }).code === 11000) {
      throw createError({ statusCode: 409, statusMessage: 'An account with this email already exists.', data: { code: 'EMAIL_TAKEN', fields: { email: 'An account with this email already exists. Sign in instead.' } } })
    }
    throw err
  }
}

/** Returns the user when the password matches. Same error for unknown email and wrong password. */
export async function authenticate(email: string, password: string) {
  const user = await UserModel.findOne({ email }).select('+passwordHash')
  // Hash anyway for unknown emails so response time does not reveal which emails exist.
  const ok = user ? await verifyPassword(password, user.passwordHash) : (await hashPassword(password), false)
  if (!user || !ok) {
    throw createError({ statusCode: 401, statusMessage: 'Email or password is incorrect.', data: { code: 'BAD_CREDENTIALS' } })
  }
  return user
}
