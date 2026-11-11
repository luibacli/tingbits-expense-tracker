import { deleteTransaction } from '../../services/ledger'

export default defineEventHandler(async (event) => {
  const { householdId } = await requireWritable(event)
  await deleteTransaction(householdId, routeId(event))
  return { ok: true }
})
