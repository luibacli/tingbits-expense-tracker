import { skipRecurring } from '../../../services/ledger'

/** Body: { from } (the due date being skipped). */
export default defineEventHandler(async (event) => {
  const { householdId } = await requireWritable(event)
  const id = routeId(event)
  const { from } = await readValid(event, (raw) => {
    const r = raw as Record<string, unknown> | null
    return r && isISODate(r.from) ? { ok: true as const, value: { from: r.from } } : { ok: false as const, fields: { from: 'Invalid date.' } }
  })
  return await skipRecurring(householdId, id, from)
})
