import { createError } from 'h3'
import { subscriptionState, trialEnd, type SubscriptionState } from '#shared/utils/subscription'
import { HouseholdModel, type HouseholdDoc } from '../models'

/**
 * Households created before billing existed have no trial date. They get a full trial
 * starting the first time they are seen (business rule S6). Returns the household with the date set.
 */
export async function ensureTrial(h: HouseholdDoc, now = new Date()): Promise<HouseholdDoc> {
  if (h.trialEndsAt) return h
  const trialEndsAt = trialEnd(now)
  // Only set it if still missing, so two devices loading at once agree on one date.
  await HouseholdModel.updateOne({ _id: h._id, $or: [{ trialEndsAt: null }, { trialEndsAt: { $exists: false } }] }, { $set: { trialEndsAt } })
  const fresh = await HouseholdModel.findById(h._id).lean<HouseholdDoc>()
  return fresh ?? { ...h, trialEndsAt }
}

export function stateOf(h: HouseholdDoc, now = new Date()): SubscriptionState {
  return subscriptionState({ trialEndsAt: h.trialEndsAt ?? trialEnd(now), paidThrough: h.paidThrough ?? null }, now)
}

/** Read-only households can view and export, but not add or change entries (business rule S3). */
export function assertWritable(h: HouseholdDoc, now = new Date()): void {
  if (!stateOf(h, now).canWrite) {
    throw createError({
      statusCode: 402,
      statusMessage: 'Your free trial has ended. Subscribe to keep adding entries. Your data is safe and you can still view and export it.',
      data: { code: 'SUBSCRIPTION_REQUIRED' },
    })
  }
}

/**
 * Extend paid access by whole months from the later of now or the current paid date.
 * Used by payment webhooks (later) and by scripts/grant-subscription.mjs for manual payments.
 */
export async function extendPaidThrough(householdId: HouseholdDoc['_id'], months: number, now = new Date()): Promise<Date> {
  const h = await HouseholdModel.findById(householdId).lean<HouseholdDoc>()
  if (!h) throw createError({ statusCode: 404, statusMessage: 'Household not found.', data: { code: 'NOT_FOUND' } })
  const base = h.paidThrough && h.paidThrough > now ? new Date(h.paidThrough) : new Date(now)
  base.setMonth(base.getMonth() + months)
  await HouseholdModel.updateOne({ _id: householdId }, { $set: { paidThrough: base } })
  return base
}
