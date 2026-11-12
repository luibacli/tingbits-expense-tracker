import { transferOwnership } from '../../services/accounts'

/** Owner only: make another account the owner. Body { accountId, password }. */
export default defineEventHandler(async (event) => {
  const { householdId, userId } = await requireOwner(event)
  const body = await readValid(event, validateTransfer)
  rateLimit(event, `password:${userId}`, useRuntimeConfig(event).authRateLimit)
  try {
    await transferOwnership(householdId, userId, body.accountId, body.password)
  } catch (err) {
    securityLog('account.ownership_transferred', { userId, householdId, targetId: body.accountId, outcome: 'denied', code: errorCode(err) })
    throw err
  }
  securityLog('account.ownership_transferred', { userId, householdId, targetId: body.accountId })
  return { ok: true }
})
