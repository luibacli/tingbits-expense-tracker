import { registerUser } from '../../services/auth'

export default defineEventHandler(async (event) => {
  rateLimit(event, 'register', useRuntimeConfig(event).authRateLimit, 60 * 60_000)
  const body = await readValid(event, validateRegister)
  const { userId } = await registerUser(body)
  const session = await appSession(event)
  await session.update({ userId: String(userId) })
  setResponseStatus(event, 201)
  return { ok: true }
})
