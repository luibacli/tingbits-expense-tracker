import { listTransactions, searchTransactions } from '../../services/ledger'

/** `?from=YYYY-MM-DD&to=YYYY-MM-DD` for a date range, or `?q=text` to search notes across all time. */
export default defineEventHandler(async (event) => {
  const { householdId } = await requireAuth(event)
  const query = getQuery(event)
  if (typeof query.q === 'string' && query.q.trim()) return await searchTransactions(householdId, query.q.trim())
  if (!isISODate(query.from) || (query.to !== undefined && !isISODate(query.to))) {
    throw createError({ statusCode: 400, statusMessage: 'Provide from (and optionally to) as YYYY-MM-DD, or q.', data: { code: 'VALIDATION' } })
  }
  return await listTransactions(householdId, query.from, query.to as string | undefined)
})
