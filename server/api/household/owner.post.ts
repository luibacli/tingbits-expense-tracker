import { transferOwnership } from '../../services/accounts'

/** Owner only: make another account the owner. Body { accountId, password }. */
export default defineEventHandler(async (event) => {
  const { householdId, userId } = await requireOwner(event)
  const body = await readValid(event, validateTransfer)
  rateLimit(event, `password:${userId}`, useRuntimeConfig(event).authRateLimit)
  await transferOwnership(householdId, userId, body.accountId, body.password)
  return { ok: true }
})
