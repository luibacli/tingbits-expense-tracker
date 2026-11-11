import { patchHousehold } from '../../services/household'

export default defineEventHandler(async (event) => {
  const { householdId } = await requireAuth(event)
  const body = await readValid(event, validateHouseholdPatch)
  await patchHousehold(householdId, body)
  return { ok: true }
})
