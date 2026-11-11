import type { H3Event } from 'h3'

// In-memory and per server instance: it slows down password guessing on a single instance.
// On serverless hosting each instance has its own window; see docs/security.md.
const hits = new Map<string, { count: number, reset: number }>()

export function rateLimit(event: H3Event, key: string, max = 10, windowMs = 15 * 60_000) {
  const ip = getRequestIP(event, { xForwardedFor: true }) ?? 'unknown'
  const k = `${key}|${ip}`
  const now = Date.now()
  const entry = hits.get(k)
  if (!entry || entry.reset < now) {
    hits.set(k, { count: 1, reset: now + windowMs })
    if (hits.size > 10_000) for (const [key2, v] of hits) if (v.reset < now) hits.delete(key2)
    return
  }
  entry.count++
  if (entry.count > max) {
    setResponseHeader(event, 'Retry-After', Math.ceil((entry.reset - now) / 1000))
    throw createError({ statusCode: 429, statusMessage: 'Too many attempts. Try again in a few minutes.', data: { code: 'RATE_LIMITED' } })
  }
}
