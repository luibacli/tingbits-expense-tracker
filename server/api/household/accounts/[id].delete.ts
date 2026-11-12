import { removeAccount } from '../../../services/accounts'

/** Owner only: remove another account from the household. Its entries stay. */
export default defineEventHandler(async (event) => {
  const { householdId, userId } = await requireOwner(event)
  const targetId = getRouterParam(event, 'id') ?? ''
  await removeAccount(householdId, userId, targetId)
  securityLog('account.removed', { userId, householdId, targetId })
  return { ok: true }
})
