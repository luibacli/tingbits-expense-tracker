import { eraseLedger } from '../../services/household'

/** Owner only: delete all entries and recurring items. Requires { confirm: "ERASE" }. */
export default defineEventHandler(async (event) => {
  const { householdId, userId } = await requireOwner(event)
  const body = await readBody(event).catch(() => null) as { confirm?: unknown } | null
  if (body?.confirm !== 'ERASE') {
    throw createError({ statusCode: 400, statusMessage: 'Confirmation missing.', data: { code: 'VALIDATION', fields: { confirm: 'Type ERASE to confirm.' } } })
  }
  const res = await eraseLedger(householdId)
  securityLog('household.ledger_erased', { userId, householdId })
  return res
})
