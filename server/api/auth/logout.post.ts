export default defineEventHandler(async (event) => {
  const session = await appSession(event)
  if (session.data.userId) securityLog('auth.logout', { userId: session.data.userId })
  await session.clear()
  return { ok: true }
})
