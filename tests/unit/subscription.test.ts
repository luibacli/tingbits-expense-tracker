import { describe, expect, it } from 'vitest'
import { subscriptionState, trialEnd, TRIAL_DAYS } from '#shared/utils/subscription'

const now = new Date('2026-11-10T08:00:00Z')
const days = (n: number) => new Date(now.getTime() + n * 86_400_000)

describe('subscription state', () => {
  it('a new household gets a 30-day trial', () => {
    expect(TRIAL_DAYS).toBe(30)
    const s = subscriptionState({ trialEndsAt: trialEnd(now), paidThrough: null }, now)
    expect(s).toMatchObject({ status: 'trial', daysLeft: 30, canWrite: true })
  })
  it('a reading taken a moment early still says 30 days', () => {
    const s = subscriptionState({ trialEndsAt: new Date(now.getTime() + 30 * 86_400_000 + 50), paidThrough: null }, now)
    expect(s.daysLeft).toBe(30)
  })
  it('the trial ends exactly at its end time: read-only after', () => {
    expect(subscriptionState({ trialEndsAt: days(0.5), paidThrough: null }, now)).toMatchObject({ status: 'trial', daysLeft: 1, canWrite: true })
    expect(subscriptionState({ trialEndsAt: days(-1), paidThrough: null }, now)).toMatchObject({ status: 'expired', daysLeft: 0, canWrite: false })
  })
  it('paying during the trial makes it active until the paid date', () => {
    const s = subscriptionState({ trialEndsAt: days(10), paidThrough: days(40) }, now)
    expect(s).toMatchObject({ status: 'active', daysLeft: 40, canWrite: true })
  })
  it('a lapsed payment expires; access ends at the later of the two dates', () => {
    const s = subscriptionState({ trialEndsAt: days(-60), paidThrough: days(-2) }, now)
    expect(s.status).toBe('expired')
    expect(s.endsAt).toBe(days(-2).toISOString())
  })
  it('a still-running trial outlasts an earlier paid date', () => {
    const s = subscriptionState({ trialEndsAt: days(20), paidThrough: days(5) }, now)
    expect(s).toMatchObject({ status: 'active', canWrite: true })
  })
})
