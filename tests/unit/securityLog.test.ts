import { describe, expect, it } from 'vitest'
import { Types } from 'mongoose'
import { securityLine } from '../../server/utils/securityLog'

describe('security log', () => {
  it('writes one JSON line with ids and fixed codes only', () => {
    const userId = new Types.ObjectId()
    const line = JSON.parse(securityLine('account.deleted', { userId, householdId: 'h1', outcome: 'denied', code: 'BAD_PASSWORD' }, new Date('2026-11-12T00:00:00Z')))
    expect(line).toEqual({ type: 'security', event: 'account.deleted', at: '2026-11-12T00:00:00.000Z', outcome: 'denied', userId: String(userId), householdId: 'h1', code: 'BAD_PASSWORD' })
  })
  it('cannot carry personal data: unknown fields are dropped and codes must be fixed tokens', () => {
    const fields = { userId: 'u1', email: 'someone@example.com', password: 'secret', code: 'someone@example.com' } as never
    const text = securityLine('auth.login_failed', fields)
    expect(text).not.toContain('example.com')
    expect(text).not.toContain('secret')
    expect(JSON.parse(text).code).toBeUndefined()
  })
})
