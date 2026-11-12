import { authenticate } from '../../services/auth'

export default defineEventHandler(async (event) => {
  const body = await readValid(event, validateLogin)
  rateLimit(event, `login:${body.email}`, useRuntimeConfig(event).authRateLimit)
  let user
  try {
    user = await authenticate(body.email, body.password)
  } catch (err) {
    securityLog('auth.login_failed', { outcome: 'denied', code: errorCode(err) })
    throw err
  }
  securityLog('auth.login', { userId: user._id, householdId: user.household })
  const session = await appSession(event)
  await session.update({ userId: String(user._id), v: user.sessionVersion ?? 0 })
  return { ok: true }
})
