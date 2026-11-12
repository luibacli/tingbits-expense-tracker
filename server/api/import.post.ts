import { importBackup } from '../services/ledger'

/** Merge a backup (or the data saved on a device by the earlier offline-only version) into the household. */
export default defineEventHandler(async (event) => {
  const { householdId, userId, household } = await requireWritable(event)
  rateLimit(event, `import:${householdId}`, 20, 60 * 60_000)
  const raw = await readBody(event).catch(() => null)
  const data = normalizeData(raw)
  if (!data) throw createError({ statusCode: 400, statusMessage: 'That file is not a Tingbits backup.', data: { code: 'VALIDATION' } })
  const res = await importBackup(household, userId, data)
  securityLog('data.imported', { userId, householdId })
  return res
})
