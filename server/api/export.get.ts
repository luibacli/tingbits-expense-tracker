import { getHouseholdDoc, todayIn } from '../services/household'
import { exportAll } from '../services/ledger'

export default defineEventHandler(async (event) => {
  const { householdId } = await requireAuth(event)
  const h = await getHouseholdDoc(householdId)
  const data = await exportAll(h)
  const format = getQuery(event).format === 'csv' ? 'csv' : 'json'
  const day = todayIn(h.timezone ?? 'UTC')
  setResponseHeader(event, 'Cache-Control', 'no-store')
  if (format === 'csv') {
    setResponseHeader(event, 'Content-Type', 'text/csv; charset=utf-8')
    setResponseHeader(event, 'Content-Disposition', `attachment; filename="expenses-${day}.csv"`)
    return `﻿${toCSV(data)}`
  }
  setResponseHeader(event, 'Content-Type', 'application/json; charset=utf-8')
  setResponseHeader(event, 'Content-Disposition', `attachment; filename="expenses-backup-${day}.json"`)
  return JSON.stringify(data, null, 2)
})
