import { createError } from 'h3'
import type { Types } from 'mongoose'
import type { Household, Role } from '#shared/types'
import type { HouseholdPatchBody } from '#shared/utils/validate'
import { HouseholdModel, RecurringModel, TransactionModel, UserModel, type HouseholdDoc } from '../models'
import { newInviteCode } from './auth'
import { stateOf } from './subscription'

/** Today's date in the household's time zone, as YYYY-MM-DD. */
export function todayIn(timezone: string, now = new Date()): string {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
  } catch {
    return now.toISOString().slice(0, 10)
  }
}

export async function getHouseholdDoc(id: Types.ObjectId | string): Promise<HouseholdDoc> {
  const h = await HouseholdModel.findById(id).lean<HouseholdDoc>()
  if (!h) throw createError({ statusCode: 404, statusMessage: 'Household not found.', data: { code: 'NOT_FOUND' } })
  return h
}

export async function toClientHousehold(h: HouseholdDoc, role: Role): Promise<Household> {
  const accounts = await UserModel.find({ household: h._id }).select('name role').lean()
  return {
    id: String(h._id),
    name: h.name,
    inviteCode: role === 'owner' ? h.inviteCode : null,
    categories: h.categories.map((c) => ({ id: c.id, name: c.name, emoji: c.emoji ?? '📦', kind: c.kind as 'expense' | 'income', budget: c.budget ?? null, archived: !!c.archived })),
    members: h.members.map((m) => ({ id: m.id, name: m.name })),
    methods: h.methods.map((m) => ({ id: m.id, name: m.name })),
    settings: {
      currency: h.currency,
      monthlyBudget: h.monthlyBudget ?? null,
      periodStartDay: h.periodStartDay ?? 1,
      setupDone: !!h.setupDone,
      timezone: h.timezone ?? 'UTC',
    },
    accounts: accounts.map((a) => ({ id: String(a._id), name: a.name, role: a.role as Role })),
    subscription: stateOf(h),
  }
}

/** Replace the editable parts of a household (last write wins; the document is small). */
export async function patchHousehold(id: Types.ObjectId, body: HouseholdPatchBody): Promise<void> {
  const ids = new Set<string>()
  for (const c of body.categories) {
    if (ids.has(c.id)) throw createError({ statusCode: 400, statusMessage: 'Duplicate category id.', data: { code: 'VALIDATION', fields: { categories: 'Duplicate category.' } } })
    ids.add(c.id)
  }
  const update: Record<string, unknown> = {
    name: body.name,
    categories: body.categories,
    members: body.members,
    methods: body.methods,
    currency: body.settings.currency,
    monthlyBudget: body.settings.monthlyBudget,
    periodStartDay: body.settings.periodStartDay,
    setupDone: body.settings.setupDone,
  }
  if (body.settings.timezone) update.timezone = body.settings.timezone
  await HouseholdModel.updateOne({ _id: id }, { $set: update })
}

export async function regenerateInvite(id: Types.ObjectId): Promise<string> {
  const code = newInviteCode()
  await HouseholdModel.updateOne({ _id: id }, { $set: { inviteCode: code } })
  return code
}

/** Delete every entry and recurring item of a household. Settings, people and accounts stay. */
export async function eraseLedger(id: Types.ObjectId): Promise<{ transactions: number, recurring: number }> {
  const [t, r] = await Promise.all([
    TransactionModel.deleteMany({ household: id }),
    RecurringModel.deleteMany({ household: id }),
  ])
  return { transactions: t.deletedCount, recurring: r.deletedCount }
}
