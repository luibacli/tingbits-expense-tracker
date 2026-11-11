import mongoose, { Schema, type Model, type Types } from 'mongoose'

/*
 * Document types are written out by hand instead of using Mongoose's InferSchemaType:
 * inferring them made the TypeScript checker run out of memory (see docs/decisions/ADR-005).
 * Keep each interface in step with its schema below.
 */
type Kind = 'expense' | 'income'
interface NamedItem { id: string, name: string }
interface CategoryItem { id: string, name: string, emoji: string, kind: Kind, budget: number | null, archived: boolean }

export interface HouseholdDoc {
  _id: Types.ObjectId
  name: string
  inviteCode: string
  currency: string
  monthlyBudget: number | null
  periodStartDay: number
  timezone: string
  setupDone: boolean
  categories: CategoryItem[]
  members: NamedItem[]
  methods: NamedItem[]
  /** End of the free trial. Missing on households created before billing (set on first read). */
  trialEndsAt?: Date | null
  /** Paid access lasts until this date. Only payments (or a manual activation) move it forward. */
  paidThrough?: Date | null
  createdAt?: Date
  updatedAt?: Date
}

export interface UserDoc {
  _id: Types.ObjectId
  email: string
  name: string
  passwordHash: string
  household: Types.ObjectId
  role: 'owner' | 'member'
  prefs: { theme: 'system' | 'light' | 'dark', defaultMemberId: string | null, defaultMethodId: string | null }
  createdAt?: Date
  updatedAt?: Date
}

export interface TxDoc {
  _id: string
  household: Types.ObjectId
  type: Kind
  amount: number
  categoryId: string
  note: string
  date: string
  memberId: string | null
  methodId: string | null
  recurringId: string | null
  createdBy: Types.ObjectId | null
  createdAt?: Date
  updatedAt?: Date
}

export interface RecurringDoc {
  _id: string
  household: Types.ObjectId
  type: Kind
  amount: number
  categoryId: string
  note: string
  memberId: string | null
  methodId: string | null
  frequency: 'weekly' | 'monthly' | 'yearly'
  nextDate: string
  auto: boolean
  active: boolean
  createdAt?: Date
  updatedAt?: Date
}

/*
 * All collections. Monetary amounts are integer cents. Dates are local calendar dates as
 * `YYYY-MM-DD` strings (they sort and range-query correctly and never shift with time zones).
 * Entry and recurring ids are client-generated strings so offline creates can be retried safely.
 */

const named = new Schema({ id: { type: String, required: true }, name: { type: String, required: true } }, { _id: false })
const category = new Schema({
  id: { type: String, required: true },
  name: { type: String, required: true },
  emoji: { type: String, default: '📦' },
  kind: { type: String, enum: ['expense', 'income'], required: true },
  budget: { type: Number, default: null },
  archived: { type: Boolean, default: false },
}, { _id: false })

const householdSchema = new Schema<HouseholdDoc>({
  name: { type: String, required: true },
  inviteCode: { type: String, required: true, unique: true },
  currency: { type: String, required: true },
  monthlyBudget: { type: Number, default: null },
  periodStartDay: { type: Number, default: 1, min: 1, max: 28 },
  timezone: { type: String, default: 'UTC' },
  setupDone: { type: Boolean, default: false },
  categories: { type: [category], default: [] },
  members: { type: [named], default: [] },
  methods: { type: [named], default: [] },
  trialEndsAt: { type: Date, default: null },
  paidThrough: { type: Date, default: null },
}, { timestamps: true })

const userSchema = new Schema<UserDoc>({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  name: { type: String, required: true },
  passwordHash: { type: String, required: true, select: false },
  household: { type: Schema.Types.ObjectId, ref: 'Household', required: true, index: true },
  role: { type: String, enum: ['owner', 'member'], required: true },
  prefs: {
    theme: { type: String, enum: ['system', 'light', 'dark'], default: 'system' },
    defaultMemberId: { type: String, default: null },
    defaultMethodId: { type: String, default: null },
  },
}, { timestamps: true })

const txSchema = new Schema<TxDoc>({
  _id: { type: String, required: true },
  household: { type: Schema.Types.ObjectId, ref: 'Household', required: true },
  type: { type: String, enum: ['expense', 'income'], required: true },
  amount: { type: Number, required: true, min: 1 },
  categoryId: { type: String, required: true },
  note: { type: String, default: '' },
  date: { type: String, required: true },
  memberId: { type: String, default: null },
  methodId: { type: String, default: null },
  recurringId: { type: String, default: null },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true })
// Every list is "this household, a date range, newest first".
txSchema.index({ household: 1, date: -1 })

const recurringSchema = new Schema<RecurringDoc>({
  _id: { type: String, required: true },
  household: { type: Schema.Types.ObjectId, ref: 'Household', required: true, index: true },
  type: { type: String, enum: ['expense', 'income'], required: true },
  amount: { type: Number, required: true, min: 1 },
  categoryId: { type: String, required: true },
  note: { type: String, required: true },
  memberId: { type: String, default: null },
  methodId: { type: String, default: null },
  frequency: { type: String, enum: ['weekly', 'monthly', 'yearly'], required: true },
  nextDate: { type: String, required: true },
  auto: { type: Boolean, default: false },
  active: { type: Boolean, default: true },
}, { timestamps: true })

// Reuse compiled models across hot reloads.
function get<T>(name: string, schema: Schema<T>): Model<T> {
  return (mongoose.models[name] as Model<T> | undefined) ?? mongoose.model<T>(name, schema)
}

export const HouseholdModel = get<HouseholdDoc>('Household', householdSchema)
export const UserModel = get<UserDoc>('User', userSchema)
export const TransactionModel = get<TxDoc>('Transaction', txSchema)
export const RecurringModel = get<RecurringDoc>('Recurring', recurringSchema)
