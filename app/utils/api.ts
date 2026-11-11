import type { ApiErrorData } from '#shared/types'

/** What the client needs to know about a failed API call. `status` 0 means the request never reached the server. */
export interface ApiFailure {
  status: number
  code: string
  message: string
  fields: Record<string, string>
}

export function toApiFailure(err: unknown): ApiFailure {
  const e = err as { statusCode?: number, status?: number, response?: { status?: number }, data?: { statusMessage?: string, message?: string, data?: ApiErrorData } }
  const status = e?.response?.status ?? e?.statusCode ?? e?.status ?? 0
  const body = e?.data
  return {
    status,
    code: body?.data?.code ?? (status ? 'ERROR' : 'NETWORK'),
    message: status
      ? body?.statusMessage || body?.message || 'Something went wrong. Please try again.'
      : 'You appear to be offline.',
    fields: body?.data?.fields ?? {},
  }
}
