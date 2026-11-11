import { removeAccount } from '../../../services/accounts'

/** Owner only: remove another account from the household. Its entries stay. */
export default defineEventHandler(async (event) => {
  const { householdId, userId } = await requireOwner(event)
  await removeAccount(householdId, userId, getRouterParam(event, 'id') ?? '')
  return { ok: true }
})
