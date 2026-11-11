import { createError } from 'h3'
import type { Types } from 'mongoose'
import type { AppData, Recurring, Transaction } from '#shared/types'
import type { RecurringBody, TxBody } from '#shared/utils/validate'
import { nextOccurrence } from '#shared/utils/dates'
import { HouseholdModel, RecurringModel, TransactionModel, type HouseholdDoc, type RecurringDoc, type TxDoc } from '../models'

type Id = Types.ObjectId

const notFound = (what: string) => createError({ statusCode: 404, statusMessage: `${what} not found.`, data: { code: 'NOT_FOUND' } })

export function toClientTx(d: TxDoc & { createdAt?: Date }): Transaction {
  return {
    id: d._id,
    type: d.type as Transaction['type'],
    amount: d.amount,
    categoryId: d.categoryId,
    note: d.note ?? '',
    date: d.date,
    memberId: d.memberId ?? null,
    methodId: d.methodId ?? null,
    recurringId: d.recurringId ?? null,
    createdAt: d.createdAt ? new Date(d.createdAt).getTime() : 0,
    createdBy: d.createdBy ? String(d.createdBy) : null,
  }
}

export function toClientRecurring(d: RecurringDoc): Recurring {
  return {
    id: d._id,
    type: d.type as Recurring['type'],
    amount: d.amount,
    categoryId: d.categoryId,
    note: d.note,
    memberId: d.memberId ?? null,
    methodId: d.methodId ?? null,
    frequency: d.frequency as Recurring['frequency'],
    nextDate: d.nextDate,
    auto: !!d.auto,
    active: d.active !== false,
  }
}

/* ---------- entries ---------- */

const MAX_RANGE_ROWS = 20_000

export async function listTransactions(household: Id, from: string, to?: string): Promise<Transaction[]> {
  const date: Record<string, string> = { $gte: from }
  if (to) date.$lte = to
  const rows = await TransactionModel.find({ household, date }).sort({ date: -1, createdAt: -1 }).limit(MAX_RANGE_ROWS).lean<TxDoc[]>()
  return rows.map(toClientTx)
}

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Search notes across all time, newest first. Category-name and amount matching happen in the client. */
export async function searchTransactions(household: Id, q: string, limit = 200): Promise<Transaction[]> {
  const rows = await TransactionModel.find({ household, note: { $regex: escapeRegex(q.slice(0, 80)), $options: 'i' } })
    .sort({ date: -1 }).limit(Math.min(limit, 500)).lean<TxDoc[]>()
  return rows.map(toClientTx)
}

/**
 * Create an entry. The id comes from the client so a create sent twice (offline retry)
 * has no effect the second time.
 */
export async function createTransaction(household: Id, userId: Id | null, body: TxBody): Promise<Transaction> {
  const existing = await TransactionModel.findById(body.id).lean<TxDoc>()
  if (existing) {
    if (String(existing.household) !== String(household)) {
      throw createError({ statusCode: 409, statusMessage: 'Id already in use.', data: { code: 'ID_CONFLICT' } })
    }
    return toClientTx(existing)
  }
  const doc = await TransactionModel.create({ ...body, _id: body.id, household, createdBy: userId, recurringId: null })
  return toClientTx(doc.toObject())
}

export async function updateTransaction(household: Id, id: string, patch: Partial<TxBody>): Promise<Transaction> {
  const { id: _ignored, ...fields } = patch
  const doc = await TransactionModel.findOneAndUpdate({ _id: id, household }, { $set: fields }, { returnDocument: 'after' }).lean<TxDoc>()
  if (!doc) throw notFound('Entry')
  return toClientTx(doc)
}

/** Deleting an entry that is already gone succeeds, so a retried delete is harmless. */
export async function deleteTransaction(household: Id, id: string): Promise<void> {
  await TransactionModel.deleteOne({ _id: id, household })
}

/* ---------- recurring ---------- */

export async function listRecurring(household: Id): Promise<Recurring[]> {
  const rows = await RecurringModel.find({ household }).sort({ nextDate: 1 }).lean<RecurringDoc[]>()
  return rows.map(toClientRecurring)
}

/**
 * Post every automatic recurring item that is due on or before `today`, catching up missed periods.
 * Entry ids are `<recurringId>:<date>`, so two devices catching up at once cannot double-post.
 */
export async function postDueRecurring(household: Id, today: string): Promise<number> {
  const due = await RecurringModel.find({ household, active: true, auto: true, nextDate: { $lte: today } }).lean<RecurringDoc[]>()
  let posted = 0
  for (const r of due) {
    const anchorDay = Number(r.nextDate.slice(8, 10))
    let next = r.nextDate
    const ops = []
    for (let guard = 0; next <= today && guard < 120; guard++) {
      ops.push({
        updateOne: {
          filter: { _id: `${r._id}:${next}` },
          update: { $setOnInsert: { household, type: r.type, amount: r.amount, categoryId: r.categoryId, note: r.note, date: next, memberId: r.memberId, methodId: r.methodId, recurringId: r._id, createdBy: null } },
          upsert: true,
        },
      })
      next = nextOccurrence(next, r.frequency as Recurring['frequency'], anchorDay)
    }
    if (!ops.length) continue
    const res = await TransactionModel.bulkWrite(ops, { ordered: false })
    posted += res.upsertedCount
    // Only advance if nobody else advanced it meanwhile.
    await RecurringModel.updateOne({ _id: r._id, nextDate: r.nextDate }, { $set: { nextDate: next } })
  }
  return posted
}

export async function createRecurring(household: Id, body: RecurringBody, today: string): Promise<{ recurring: Recurring, posted: number }> {
  const existing = await RecurringModel.findById(body.id).lean<RecurringDoc>()
  if (existing) {
    if (String(existing.household) !== String(household)) throw createError({ statusCode: 409, statusMessage: 'Id already in use.', data: { code: 'ID_CONFLICT' } })
  } else {
    await RecurringModel.create({ ...body, _id: body.id, household, active: body.active ?? true })
  }
  const posted = await postDueRecurring(household, today)
  const doc = await RecurringModel.findById(body.id).lean<RecurringDoc>()
  return { recurring: toClientRecurring(doc!), posted }
}

export async function updateRecurring(household: Id, id: string, patch: Partial<RecurringBody>, today: string): Promise<{ recurring: Recurring, posted: number }> {
  const { id: _ignored, ...fields } = patch
  const doc = await RecurringModel.findOneAndUpdate({ _id: id, household }, { $set: fields }, { returnDocument: 'after' }).lean<RecurringDoc>()
  if (!doc) throw notFound('Recurring item')
  const posted = await postDueRecurring(household, today)
  const fresh = await RecurringModel.findById(id).lean<RecurringDoc>()
  return { recurring: toClientRecurring(fresh ?? doc), posted }
}

export async function deleteRecurring(household: Id, id: string): Promise<void> {
  await RecurringModel.deleteOne({ _id: id, household })
}

/**
 * Record a payment for a manual recurring item. `from` is the due date the client saw;
 * a retried or duplicate request (same entry id, or the date already moved on) changes nothing.
 */
export async function payRecurring(household: Id, userId: Id, id: string, input: { transactionId: string, date: string, from: string }) {
  const r = await RecurringModel.findOne({ _id: id, household }).lean<RecurringDoc>()
  if (!r) throw notFound('Recurring item')
  const tx = await createTransaction(household, userId, {
    id: input.transactionId, type: r.type as Transaction['type'], amount: r.amount, categoryId: r.categoryId,
    note: r.note, date: input.date, memberId: r.memberId ?? null, methodId: r.methodId ?? null,
  })
  await TransactionModel.updateOne({ _id: input.transactionId, household }, { $set: { recurringId: r._id } })
  if (r.nextDate === input.from) {
    const next = nextOccurrence(r.nextDate, r.frequency as Recurring['frequency'], Number(r.nextDate.slice(8, 10)))
    await RecurringModel.updateOne({ _id: id, household, nextDate: input.from }, { $set: { nextDate: next } })
  }
  const fresh = await RecurringModel.findById(id).lean<RecurringDoc>()
  return { recurring: toClientRecurring(fresh!), transaction: { ...tx, recurringId: r._id } }
}

export async function skipRecurring(household: Id, id: string, from: string): Promise<Recurring> {
  const r = await RecurringModel.findOne({ _id: id, household }).lean<RecurringDoc>()
  if (!r) throw notFound('Recurring item')
  if (r.nextDate === from) {
    const next = nextOccurrence(r.nextDate, r.frequency as Recurring['frequency'], Number(r.nextDate.slice(8, 10)))
    await RecurringModel.updateOne({ _id: id, household, nextDate: from }, { $set: { nextDate: next } })
  }
  return toClientRecurring((await RecurringModel.findById(id).lean<RecurringDoc>())!)
}

/* ---------- backup ---------- */

/** Everything in the same format the device-only version used, so old and new backups are interchangeable. */
export async function exportAll(h: HouseholdDoc): Promise<AppData> {
  const [txs, rec] = await Promise.all([
    TransactionModel.find({ household: h._id }).sort({ date: 1 }).lean<TxDoc[]>(),
    RecurringModel.find({ household: h._id }).lean<RecurringDoc[]>(),
  ])
  return {
    version: 1,
    transactions: txs.map(toClientTx),
    categories: h.categories.map((c) => ({ id: c.id, name: c.name, emoji: c.emoji ?? '📦', kind: c.kind as 'expense' | 'income', budget: c.budget ?? null, archived: !!c.archived })),
    members: h.members.map((m) => ({ id: m.id, name: m.name })),
    methods: h.methods.map((m) => ({ id: m.id, name: m.name })),
    recurring: rec.map(toClientRecurring),
    settings: {
      currency: h.currency, monthlyBudget: h.monthlyBudget ?? null, periodStartDay: h.periodStartDay ?? 1,
      theme: 'system', defaultMemberId: null, defaultMethodId: null, setupDone: !!h.setupDone,
    },
  }
}

/**
 * Merge a backup into the household. Nothing is overwritten: entries and recurring items whose
 * id already exists are skipped, and categories, people and methods are added only when missing.
 * Running the same import twice therefore changes nothing the second time.
 */
export async function importBackup(h: HouseholdDoc, userId: Id, data: AppData) {
  const household = h._id
  // Ids are global. A backup restored into a different household (a new account, say) would collide
  // with the original household's ids, so those get a stable household-specific id instead.
  // Stable means importing the same file again still finds and skips them.
  const scoped = (id: string) => `${String(household)}:${id}`.slice(0, 80)
  const [txTaken, recTaken] = await Promise.all([
    takenElsewhere(TransactionModel, household, data.transactions.map((t) => t.id)),
    takenElsewhere(RecurringModel, household, data.recurring.map((r) => r.id)),
  ])
  const txId = (id: string) => (txTaken.has(id) ? scoped(id) : id)
  const recId = (id: string | null) => (id && recTaken.has(id) ? scoped(id) : id)

  const txOps = data.transactions.map((t) => ({
    updateOne: {
      filter: { _id: txId(t.id) },
      update: { $setOnInsert: { household, type: t.type, amount: t.amount, categoryId: t.categoryId, note: t.note, date: t.date, memberId: t.memberId, methodId: t.methodId, recurringId: recId(t.recurringId), createdBy: userId } },
      upsert: true,
    },
  }))
  const recOps = data.recurring.map((r) => ({
    updateOne: {
      filter: { _id: recId(r.id)! },
      update: { $setOnInsert: { household, type: r.type, amount: r.amount, categoryId: r.categoryId, note: r.note, memberId: r.memberId, methodId: r.methodId, frequency: r.frequency, nextDate: r.nextDate, auto: r.auto, active: r.active } },
      upsert: true,
    },
  }))
  let entries = 0, recurring = 0
  for (let i = 0; i < txOps.length; i += 1000) entries += (await TransactionModel.bulkWrite(txOps.slice(i, i + 1000), { ordered: false })).upsertedCount
  if (recOps.length) recurring = (await RecurringModel.bulkWrite(recOps, { ordered: false })).upsertedCount

  const has = <T extends { id: string }>(list: T[]) => new Set(list.map((x) => x.id))
  const catIds = has(h.categories), memIds = has(h.members), metIds = has(h.methods)
  const addCats = data.categories.filter((c) => !catIds.has(c.id))
  const addMembers = data.members.filter((m) => !memIds.has(m.id))
  const addMethods = data.methods.filter((m) => !metIds.has(m.id))
  const set: Record<string, unknown> = {}
  if (!h.monthlyBudget && data.settings.monthlyBudget) set.monthlyBudget = data.settings.monthlyBudget
  await HouseholdModel.updateOne({ _id: household }, {
    ...(Object.keys(set).length ? { $set: set } : {}),
    $push: { categories: { $each: addCats }, members: { $each: addMembers }, methods: { $each: addMethods } },
  })
  return { entries, skipped: data.transactions.length - entries, recurring }
}

/** Which of these ids already belong to a different household. */
async function takenElsewhere(model: typeof TransactionModel | typeof RecurringModel, household: Id, ids: string[]): Promise<Set<string>> {
  if (!ids.length) return new Set()
  const rows = await (model as typeof TransactionModel).find({ _id: { $in: ids }, household: { $ne: household } }).select('_id').lean<Array<{ _id: string }>>()
  return new Set(rows.map((r) => r._id))
}
