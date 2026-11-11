import { createTransaction } from '../../services/ledger'

export default defineEventHandler(async (event) => {
  const { householdId, userId } = await requireWritable(event)
  const body = await readValid(event, (raw) => validateTx(raw)) as TxBody
  setResponseStatus(event, 201)
  return await createTransaction(householdId, userId, body)
})
