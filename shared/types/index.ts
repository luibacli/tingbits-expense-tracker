import type { SubscriptionState } from '../utils/subscription'

/** Amounts are stored as integer minor units (cents/centavos) to avoid float drift. */
export type Cents = number
/** Local calendar date, `YYYY-MM-DD`. */
export type ISODate = string

export type TxType = 'expense' | 'income'

export interface Transaction {
  id: string
  type: TxType
  amount: Cents
  categoryId: string
  note: string
  date: ISODate
  memberId: string | null
  methodId: string | null
  recurringId: string | null
  createdAt: number
  /** Account that recorded the entry (server-set). Null for imported or automatic entries. */
  createdBy?: string | null
}

export interface Category {
  id: string
  name: string
  emoji: string
  kind: TxType
  /** Monthly budget for this category, expense categories only. */
  budget: Cents | null
  archived: boolean
}

export interface Member {
  id: string
  name: string
}

export interface PaymentMethod {
  id: string
  name: string
}

export type Frequency = 'weekly' | 'monthly' | 'yearly'

export interface Recurring {
  id: string
  type: TxType
  amount: Cents
  categoryId: string
  note: string
  memberId: string | null
  methodId: string | null
  frequency: Frequency
  /** Next date this item is due. */
  nextDate: ISODate
  /** Post automatically when due; otherwise it waits on the home screen for "Mark paid". */
  auto: boolean
  active: boolean
}

export type Theme = 'system' | 'light' | 'dark'

export interface Settings {
  currency: string
  /** Overall monthly spending budget; null means "sum of category budgets". */
  monthlyBudget: Cents | null
  /** Day of month a budget period starts (1-28), e.g. payday. */
  periodStartDay: number
  theme: Theme
  defaultMemberId: string | null
  defaultMethodId: string | null
  setupDone: boolean
}

export interface AppData {
  version: 1
  transactions: Transaction[]
  categories: Category[]
  members: Member[]
  methods: PaymentMethod[]
  recurring: Recurring[]
  settings: Settings
}

export interface Period {
  start: ISODate
  end: ISODate
  /** Number of days in the period. */
  days: number
}

/* ---------- Accounts and households (server-backed) ---------- */

export type Role = 'owner' | 'member'

export interface UserPrefs {
  theme: Theme
  defaultMemberId: string | null
  defaultMethodId: string | null
}

export interface SessionUser {
  id: string
  name: string
  email: string
  role: Role
  prefs: UserPrefs
}

export interface HouseholdSettings {
  currency: string
  monthlyBudget: Cents | null
  periodStartDay: number
  setupDone: boolean
  /** IANA time zone used to decide "today" on the server for recurring items. */
  timezone: string
}

export interface Household {
  id: string
  name: string
  /** Only sent to owners. */
  inviteCode: string | null
  categories: Category[]
  members: Member[]
  methods: PaymentMethod[]
  settings: HouseholdSettings
  accounts: Array<{ id: string, name: string, role: Role }>
  subscription: SubscriptionState
}

/** Fields of a household any member may change. */
export interface HouseholdPatch {
  name: string
  categories: Category[]
  members: Member[]
  methods: PaymentMethod[]
  settings: Omit<HouseholdSettings, 'timezone'> & { timezone?: string }
}

export interface Bootstrap {
  user: SessionUser
  household: Household
  recurring: Recurring[]
  transactions: Transaction[]
  /** First date included in `transactions`. */
  from: ISODate
  /** Entries posted by automatic recurring items during this request. */
  posted: number
  today: ISODate
}

/** Error body the API returns in `data`. */
export interface ApiErrorData {
  code: string
  fields?: Record<string, string>
}
