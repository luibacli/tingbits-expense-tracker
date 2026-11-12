import { deleteOwnAccount } from '../../services/accounts'

/**
 * Delete the signed-in account. Body { password, confirm: "DELETE" }.
 * An owner who is the only account also deletes the household and all its data.
 */
export default defineEventHandler(async (event) => {
  const { userId, householdId } = await requireAuth(event)
  const body = await readValid(event, validateDeleteAccount)
  rateLimit(event, `password:${userId}`, useRuntimeConfig(event).authRateLimit)
  let res
  try {
    res = await deleteOwnAccount(userId, body.password)
  } catch (err) {
    securityLog('account.deleted', { userId, householdId, outcome: 'denied', code: errorCode(err) })
    throw err
  }
  securityLog('account.deleted', { userId, householdId, code: res.householdDeleted ? 'HOUSEHOLD_DELETED' : 'ACCOUNT_ONLY' })
  await (await appSession(event)).clear()
  return res
})
