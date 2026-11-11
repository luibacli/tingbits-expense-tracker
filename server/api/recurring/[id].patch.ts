import { todayIn } from '../../services/household'
import { updateRecurring } from '../../services/ledger'

export default defineEventHandler(async (event) => {
  const { householdId, household: h } = await requireWritable(event)
  const id = routeId(event)
  const patch = await readValid(event, (raw) => validateRecurring(raw, true))
  return await updateRecurring(householdId, id, patch, todayIn(h.timezone ?? 'UTC'))
})
