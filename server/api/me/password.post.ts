import { changePassword } from '../../services/accounts'

/** Change the signed-in account's password. Body { current, next }. */
export default defineEventHandler(async (event) => {
  const { userId } = await requireAuth(event)
  const body = await readValid(event, validatePasswordChange)
  rateLimit(event, `password:${userId}`, useRuntimeConfig(event).authRateLimit)
  await changePassword(userId, body.current, body.next)
  return { ok: true }
})
