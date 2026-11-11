import { toSessionUser } from '../services/auth'
import { getHouseholdDoc, todayIn, toClientHousehold } from '../services/household'
import { listRecurring, listTransactions, postDueRecurring } from '../services/ledger'
import { ensureTrial, stateOf } from '../services/subscription'

/**
 * Everything the app needs to start: account, household, recurring items and entries since `from`
 * (default: about 13 months back, enough for the trend chart and comparisons).
 * Due automatic recurring items are posted first.
 */
export default defineEventHandler(async (event) => {
  const { user, householdId } = await requireAuth(event)
  const household = await ensureTrial(await getHouseholdDoc(householdId))
  const today = todayIn(household.timezone ?? 'UTC')
  const q = getQuery(event)
  const earliest = addDays(today, -366 * 10)
  let from = isISODate(q.from) ? q.from : addDays(today, -400)
  if (from < earliest) from = earliest

  // A read-only household gets no new automatic entries until it subscribes again.
  const posted = stateOf(household).canWrite ? await postDueRecurring(householdId, today) : 0
  const [client, recurring, transactions] = await Promise.all([
    toClientHousehold(household, user.role as 'owner' | 'member'),
    listRecurring(householdId),
    listTransactions(householdId, from),
  ])
  return { user: toSessionUser(user), household: client, recurring, transactions, from, posted, today }
})
