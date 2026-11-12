import { regenerateInvite } from '../../services/household'

/** Owner only: issue a new invite code (the old one stops working). */
export default defineEventHandler(async (event) => {
  const { householdId, userId } = await requireOwner(event)
  const inviteCode = await regenerateInvite(householdId)
  securityLog('household.invite_renewed', { userId, householdId })
  return { inviteCode }
})
