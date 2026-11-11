import { authenticate } from '../../services/auth'

export default defineEventHandler(async (event) => {
  const body = await readValid(event, validateLogin)
  rateLimit(event, `login:${body.email}`, useRuntimeConfig(event).authRateLimit)
  const user = await authenticate(body.email, body.password)
  const session = await appSession(event)
  await session.update({ userId: String(user._id) })
  return { ok: true }
})
