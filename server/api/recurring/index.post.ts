import { todayIn } from '../../services/household'
import { createRecurring } from '../../services/ledger'

export default defineEventHandler(async (event) => {
  const { householdId, household: h } = await requireWritable(event)
  const body = await readValid(event, (raw) => validateRecurring(raw)) as RecurringBody
  setResponseStatus(event, 201)
  return await createRecurring(householdId, body, todayIn(h.timezone ?? 'UTC'))
})
