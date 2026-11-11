import { deleteOwnAccount } from '../../services/accounts'

/**
 * Delete the signed-in account. Body { password, confirm: "DELETE" }.
 * An owner who is the only account also deletes the household and all its data.
 */
export default defineEventHandler(async (event) => {
  const { userId } = await requireAuth(event)
  const body = await readValid(event, validateDeleteAccount)
  rateLimit(event, `password:${userId}`, useRuntimeConfig(event).authRateLimit)
  const res = await deleteOwnAccount(userId, body.password)
  await (await appSession(event)).clear()
  return res
})
