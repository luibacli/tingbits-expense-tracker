/**
 * Security log: one JSON line per sensitive event, written to the server log (Vercel keeps it
 * per its log retention). Only ids and fixed codes are allowed, so emails, names, passwords,
 * tokens and IP addresses can never end up here (docs/security.md → Security log).
 */
export type SecurityEvent =
  | 'auth.register' | 'auth.login' | 'auth.login_failed' | 'auth.logout'
  | 'account.removed' | 'account.ownership_transferred' | 'account.deleted' | 'account.password_changed'
  | 'household.invite_renewed' | 'household.ledger_erased'
  | 'data.exported' | 'data.imported'

type Id = { toString(): string } | null | undefined

export interface SecurityFields {
  userId?: Id
  householdId?: Id
  targetId?: Id
  outcome?: 'ok' | 'denied'
  /** A fixed error code such as BAD_PASSWORD, never free text. */
  code?: string
}

export function securityLine(event: SecurityEvent, f: SecurityFields = {}, now = new Date()): string {
  const id = (v: Id) => (v == null ? undefined : String(v))
  return JSON.stringify({
    type: 'security',
    event,
    at: now.toISOString(),
    outcome: f.outcome ?? 'ok',
    userId: id(f.userId),
    householdId: id(f.householdId),
    targetId: id(f.targetId),
    code: f.code && /^[A-Z_]{1,40}$/.test(f.code) ? f.code : undefined,
  })
}

export function securityLog(event: SecurityEvent, fields?: SecurityFields): void {
  console.info(securityLine(event, fields))
}

/** The error code of a thrown h3 error, for logging denied attempts. */
export function errorCode(err: unknown): string | undefined {
  return (err as { data?: { code?: string } })?.data?.code
}
