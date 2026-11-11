import { payRecurring } from '../../../services/ledger'

/** Body: { transactionId, date, from } where `from` is the due date being paid. */
export default defineEventHandler(async (event) => {
  const { householdId, userId } = await requireWritable(event)
  const id = routeId(event)
  const body = await readValid(event, (raw) => {
    const r = raw as Record<string, unknown> | null
    return r && isId(r.transactionId) && isISODate(r.date) && isISODate(r.from)
      ? { ok: true as const, value: { transactionId: r.transactionId, date: r.date, from: r.from } }
      : { ok: false as const, fields: { body: 'Expected transactionId, date and from.' } }
  })
  return await payRecurring(householdId, userId, id, body)
})
