import { regenerateInvite } from '../../services/household'

/** Owner only: issue a new invite code (the old one stops working). */
export default defineEventHandler(async (event) => {
  const { householdId } = await requireOwner(event)
  return { inviteCode: await regenerateInvite(householdId) }
})
