// Applies to /api only.
// 1) Cross-site request protection: state-changing requests must be JSON (a plain HTML form
//    cannot send that) and, when the browser sends an Origin, it must be this site.
// 2) Connects to MongoDB once; if the database is unreachable the API answers 503.
import { connectDB } from '../services/db'

const SAFE = new Set(['GET', 'HEAD', 'OPTIONS'])

export default defineEventHandler(async (event) => {
  if (!event.path.startsWith('/api/')) return

  if (!SAFE.has(event.method)) {
    const origin = getRequestHeader(event, 'origin')
    let sameSite = true
    if (origin) { try { sameSite = new URL(origin).host === getRequestHost(event, { xForwardedHost: true }) } catch { sameSite = false } }
    if (!sameSite) {
      throw createError({ statusCode: 403, statusMessage: 'Cross-site request blocked.', data: { code: 'FORBIDDEN' } })
    }
    const type = getRequestHeader(event, 'content-type') ?? ''
    const hasBody = Number(getRequestHeader(event, 'content-length') ?? 0) > 0 || !!getRequestHeader(event, 'transfer-encoding')
    if (hasBody && !type.includes('application/json')) {
      throw createError({ statusCode: 415, statusMessage: 'Send JSON.', data: { code: 'UNSUPPORTED_MEDIA_TYPE' } })
    }
  }

  // The session check only reads the cookie; the public landing page calls it, so it must not wake the database.
  if (event.method === 'GET' && event.path.split('?')[0] === '/api/auth/session') return

  // MONGODB_URI is accepted as well as Nuxt's NUXT_MONGODB_URI, read at runtime.
  const mongodbUri = useRuntimeConfig(event).mongodbUri || process.env.MONGODB_URI
  if (!mongodbUri) {
    console.error('[db] MONGODB_URI is not set')
    throw createError({ statusCode: 503, statusMessage: 'The database is not configured.', data: { code: 'DB_UNAVAILABLE' } })
  }
  try {
    await connectDB(mongodbUri)
  } catch (err) {
    console.error('[db] connection failed:', (err as Error).message)
    throw createError({ statusCode: 503, statusMessage: 'Cannot reach the database right now.', data: { code: 'DB_UNAVAILABLE' } })
  }
})
