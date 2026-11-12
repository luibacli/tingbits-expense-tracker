/**
 * Uptime check for monitoring. Public, no data. The API guard connects to the database first,
 * so this answers 200 only when the app and the database are both reachable (503 otherwise).
 */
export default defineEventHandler(() => ({ status: 'ok' }))
