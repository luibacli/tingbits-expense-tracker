import type { H3Event } from 'h3'
import { Types } from 'mongoose'
import { UserModel } from '../models'
import { getHouseholdDoc } from '../services/household'
import { assertWritable, ensureTrial } from '../services/subscription'

/** `v` is the account's session version when the cookie was issued (see UserDoc.sessionVersion). */
interface SessionData { userId?: string, v?: number }

const SIXTY_DAYS = 60 * 24 * 60 * 60

/** Encrypted, http-only session cookie (h3 built-in). Holds only the user id. */
export function appSession(event: H3Event) {
  const { sessionPassword } = useRuntimeConfig(event)
  if (!sessionPassword || sessionPassword.length < 32) {
    throw createError({ statusCode: 500, statusMessage: 'Server is not configured.', data: { code: 'CONFIG' } })
  }
  return useSession<SessionData>(event, {
    name: 'tingbits_session',
    password: sessionPassword,
    maxAge: SIXTY_DAYS,
    // Secure whenever the request came over HTTPS (always in production behind Vercel). Plain-HTTP local
    // runs cannot use Secure cookies in Safari, so they get a non-Secure cookie on their own origin.
    cookie: { httpOnly: true, sameSite: 'lax', secure: getRequestProtocol(event, { xForwardedProto: true }) === 'https', path: '/' },
  })
}

/**
 * The signed-in account and its household, loaded fresh from the database on every request,
 * so a removed account, a changed role or a changed password takes effect immediately.
 */
export async function requireAuth(event: H3Event) {
  const session = await appSession(event)
  const id = session.data.userId
  const found = id && Types.ObjectId.isValid(id) ? await UserModel.findById(id).lean() : null
  // A cookie issued before the password changed no longer counts (missing versions are 0).
  const user = found && (found.sessionVersion ?? 0) === (session.data.v ?? 0) ? found : null
  if (!user) {
    if (id) await session.clear()
    throw createError({ statusCode: 401, statusMessage: 'Please sign in.', data: { code: 'UNAUTHENTICATED' } })
  }
  return { user, householdId: user.household as Types.ObjectId, userId: user._id as Types.ObjectId }
}

export async function requireOwner(event: H3Event) {
  const auth = await requireAuth(event)
  if (auth.user.role !== 'owner') {
    throw createError({ statusCode: 403, statusMessage: 'Only the household owner can do this.', data: { code: 'FORBIDDEN' } })
  }
  return auth
}

/**
 * For routes that add or change ledger data: signed in, and the household's trial or
 * subscription is active. Otherwise 402 SUBSCRIPTION_REQUIRED (read-only, business rule S3).
 */
export async function requireWritable(event: H3Event) {
  const auth = await requireAuth(event)
  const household = await ensureTrial(await getHouseholdDoc(auth.householdId))
  assertWritable(household)
  return { ...auth, household }
}
