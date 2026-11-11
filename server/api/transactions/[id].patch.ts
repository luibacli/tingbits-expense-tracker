import { updateTransaction } from '../../services/ledger'

export default defineEventHandler(async (event) => {
  const { householdId } = await requireWritable(event)
  const id = routeId(event)
  const patch = await readValid(event, (raw) => validateTx(raw, true))
  return await updateTransaction(householdId, id, patch)
})
