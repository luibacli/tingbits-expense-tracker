import { changePassword } from '../../services/accounts'

/** Change the signed-in account's password and sign out other devices. Body { current, next }. */
export default defineEventHandler(async (event) => {
  const { userId } = await requireAuth(event)
  const body = await readValid(event, validatePasswordChange)
  rateLimit(event, `password:${userId}`, useRuntimeConfig(event).authRateLimit)
  let version: number
  try {
    version = await changePassword(userId, body.current, body.next)
  } catch (err) {
    securityLog('account.password_changed', { userId, outcome: 'denied', code: errorCode(err) })
    throw err
  }
  securityLog('account.password_changed', { userId })
  // Keep this device signed in; every other device is signed out on its next request.
  await (await appSession(event)).update({ userId: String(userId), v: version })
  return { ok: true }
})
