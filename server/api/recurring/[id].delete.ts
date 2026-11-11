import { deleteRecurring } from '../../services/ledger'

/** Removes the recurring item only. Entries it already posted are kept. */
export default defineEventHandler(async (event) => {
  const { householdId } = await requireWritable(event)
  await deleteRecurring(householdId, routeId(event))
  return { ok: true }
})
