import type { H3Event } from 'h3'
import type { Valid } from '#shared/utils/validate'

/** Read the JSON body and run a shared validator; 400 with per-field messages on failure. */
export async function readValid<T>(event: H3Event, validator: (raw: unknown) => Valid<T>): Promise<T> {
  const raw = await readBody(event).catch(() => undefined)
  return checkValid(validator(raw))
}

export function checkValid<T>(result: Valid<T>): T {
  if (!result.ok) {
    throw createError({ statusCode: 400, statusMessage: 'Some fields are invalid.', data: { code: 'VALIDATION', fields: result.fields } })
  }
  return result.value
}

export function routeId(event: H3Event): string {
  const id = getRouterParam(event, 'id')
  if (!isId(id)) throw createError({ statusCode: 400, statusMessage: 'Invalid id.', data: { code: 'VALIDATION' } })
  return id
}
