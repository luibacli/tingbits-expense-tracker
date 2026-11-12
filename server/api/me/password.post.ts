import { changePassword } from '../../services/accounts'

/** Change the signed-in account's password. Body { current, next }. */
export default defineEventHandler(async (event) => {
  const { userId } = await requireAuth(event)
  const body = await readValid(event, validatePasswordChange)
  rateLimit(event, `password:${userId}`, useRuntimeConfig(event).authRateLimit)
  try {
    await changePassword(userId, body.current, body.next)
  } catch (err) {
    securityLog('account.password_changed', { userId, outcome: 'denied', code: errorCode(err) })
    throw err
  }
  securityLog('account.password_changed', { userId })
  return { ok: true }
})
