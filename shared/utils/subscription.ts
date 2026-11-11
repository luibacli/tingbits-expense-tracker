/*
 * Subscription rules (docs/business-rules.md S1 to S6), shared by server and client.
 * Access is date-based: a household may add or change entries while today is before
 * the end of its trial or before the date it is paid through. Payments (PayMongo, or a
 * manual activation) only ever move `paidThrough` forward.
 */

export const TRIAL_DAYS = 30
export const PRICE_PHP_MONTHLY = 150

export type SubscriptionStatus = 'trial' | 'active' | 'expired'

export interface SubscriptionDates {
  trialEndsAt: string | Date
  paidThrough: string | Date | null
}

export interface SubscriptionState {
  status: SubscriptionStatus
  /** When access ends (end of trial or paid period). */
  endsAt: string
  /** Days until access ends, to the nearest day and at least 1 while open; 0 once expired. */
  daysLeft: number
  canWrite: boolean
  trialEndsAt: string
  paidThrough: string | null
}

const DAY = 86_400_000

export function trialEnd(from: Date = new Date()): Date {
  return new Date(from.getTime() + TRIAL_DAYS * DAY)
}

export function subscriptionState(d: SubscriptionDates, now: Date = new Date()): SubscriptionState {
  const trial = new Date(d.trialEndsAt)
  const paid = d.paidThrough ? new Date(d.paidThrough) : null
  // Access lasts until the later of the two dates.
  const endsAt = paid && paid > trial ? paid : trial
  const open = endsAt > now
  const status: SubscriptionStatus = !open ? 'expired' : paid && paid > now ? 'active' : 'trial'
  return {
    status,
    endsAt: endsAt.toISOString(),
    // Nearest day, not ceiling: a reading taken milliseconds early must not turn 30 days into 31.
    daysLeft: open ? Math.max(1, Math.round((endsAt.getTime() - now.getTime()) / DAY)) : 0,
    canWrite: open,
    trialEndsAt: trial.toISOString(),
    paidThrough: paid ? paid.toISOString() : null,
  }
}
