import type { AppData, Category, Frequency, Member, PaymentMethod, Recurring, Settings, Transaction, TxType } from '#shared/types'
import { defaultData } from './defaults'
import { DEFAULT_CURRENCY } from './money'

/*
 * Everything read from storage or from an imported backup file is untrusted.
 * normalizeData() rebuilds a clean AppData object field by field, dropping anything invalid,
 * so a corrupt or hand-edited file can never put the app in a broken state.
 */

type Obj = Record<string, unknown>
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v)
const str = (v: unknown, max = 200): string | null => (typeof v === 'string' ? v.slice(0, max) : null)
const int = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : null)
const isDate = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)
const txType = (v: unknown): TxType | null => (v === 'expense' || v === 'income' ? v : null)
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])

function category(v: unknown): Category | null {
  if (!isObj(v)) return null
  const id = str(v.id, 80), name = str(v.name, 60), kind = txType(v.kind)
  if (!id || !name || !kind) return null
  const budget = int(v.budget)
  return { id, name, kind, emoji: str(v.emoji, 16) || '📦', budget: budget && budget > 0 ? budget : null, archived: v.archived === true }
}

function named(v: unknown): Member | PaymentMethod | null {
  if (!isObj(v)) return null
  const id = str(v.id, 80), name = str(v.name, 60)
  return id && name ? { id, name } : null
}

function transaction(v: unknown): Transaction | null {
  if (!isObj(v)) return null
  const id = str(v.id, 80), type = txType(v.type), amount = int(v.amount), categoryId = str(v.categoryId, 80)
  if (!id || !type || !amount || amount <= 0 || !categoryId || !isDate(v.date)) return null
  return {
    id, type, amount, categoryId,
    date: v.date,
    note: str(v.note, 200) ?? '',
    memberId: str(v.memberId, 80),
    methodId: str(v.methodId, 80),
    recurringId: str(v.recurringId, 80),
    createdAt: int(v.createdAt) ?? Date.now(),
  }
}

function recurring(v: unknown): Recurring | null {
  if (!isObj(v)) return null
  const id = str(v.id, 80), type = txType(v.type), amount = int(v.amount), categoryId = str(v.categoryId, 80)
  const frequency = (['weekly', 'monthly', 'yearly'] as const).find((f) => f === v.frequency) as Frequency | undefined
  if (!id || !type || !amount || amount <= 0 || !categoryId || !frequency || !isDate(v.nextDate)) return null
  return {
    id, type, amount, categoryId, frequency,
    nextDate: v.nextDate,
    note: str(v.note, 200) ?? '',
    memberId: str(v.memberId, 80),
    methodId: str(v.methodId, 80),
    auto: v.auto !== false,
    active: v.active !== false,
  }
}

function settings(v: unknown, fallback: Settings): Settings {
  if (!isObj(v)) return fallback
  const currency = str(v.currency, 3)
  const start = int(v.periodStartDay)
  const budget = int(v.monthlyBudget)
  return {
    currency: currency && /^[A-Z]{3}$/.test(currency) ? currency : fallback.currency,
    monthlyBudget: budget && budget > 0 ? budget : null,
    periodStartDay: start && start >= 1 && start <= 28 ? start : 1,
    theme: v.theme === 'light' || v.theme === 'dark' ? v.theme : 'system',
    defaultMemberId: str(v.defaultMemberId, 80),
    defaultMethodId: str(v.defaultMethodId, 80),
    setupDone: v.setupDone === true,
  }
}

const keep = <T>(list: unknown[], fn: (v: unknown) => T | null): T[] =>
  list.map(fn).filter((x): x is T => x !== null)

/** Returns clean data, or null when the input is not an expense-tracker backup at all. */
export function normalizeData(raw: unknown, currency?: string): AppData | null {
  if (!isObj(raw) || raw.version !== 1) return null
  const base = defaultData(currency)
  const categories = keep(arr(raw.categories), category)
  const members = keep(arr(raw.members), named)
  const methods = keep(arr(raw.methods), named)
  return {
    version: 1,
    transactions: keep(arr(raw.transactions), transaction),
    categories: categories.length ? categories : base.categories,
    members: members.length ? members : base.members,
    methods,
    recurring: keep(arr(raw.recurring), recurring),
    settings: settings(raw.settings, base.settings),
  }
}

/* ---------- API input validators (used at the server boundary, and by forms) ---------- */

export type Valid<T> = { ok: true, value: T } | { ok: false, fields: Record<string, string> }

const ID_RE = /^[A-Za-z0-9_:-]{1,80}$/
export const isId = (v: unknown): v is string => typeof v === 'string' && ID_RE.test(v)
export const isISODate = (v: unknown): v is string => isDate(v) && !Number.isNaN(Date.parse(`${v}T12:00:00Z`))
const MAX_AMOUNT = 100_000_000_00 // 100 million in major units

function amountOf(v: unknown): number | null {
  const n = int(v)
  return n && n > 0 && n <= MAX_AMOUNT ? n : null
}
const optId = (v: unknown) => (v === null || v === undefined || v === '' ? null : isId(v) ? v : undefined)

export interface TxBody {
  id: string
  type: TxType
  amount: number
  categoryId: string
  note: string
  date: string
  memberId: string | null
  methodId: string | null
}

/** Full entry, for create. `partial` validates only the fields present, for PATCH. */
export function validateTx(raw: unknown, partial = false): Valid<Partial<TxBody>> {
  if (!isObj(raw)) return { ok: false, fields: { body: 'Expected an object.' } }
  const f: Record<string, string> = {}
  const out: Partial<TxBody> = {}
  const has = (k: string) => !partial || k in raw
  if (!partial) { if (isId(raw.id)) out.id = raw.id; else f.id = 'Invalid id.' }
  if (has('type')) { const t = txType(raw.type); if (t) out.type = t; else f.type = 'Must be expense or income.' }
  if (has('amount')) { const a = amountOf(raw.amount); if (a) out.amount = a; else f.amount = 'Enter an amount above zero.' }
  if (has('categoryId')) { if (isId(raw.categoryId)) out.categoryId = raw.categoryId; else f.categoryId = 'Pick a category.' }
  if (has('date')) { if (isISODate(raw.date)) out.date = raw.date; else f.date = 'Invalid date.' }
  if (has('note')) { const n = raw.note ?? ''; if (typeof n === 'string' && n.length <= 200) out.note = n.trim(); else f.note = 'Note is too long.' }
  for (const k of ['memberId', 'methodId'] as const) {
    if (!has(k)) continue
    const v = optId(raw[k])
    if (v === undefined) f[k] = 'Invalid id.'
    else out[k] = v
  }
  return Object.keys(f).length ? { ok: false, fields: f } : { ok: true, value: out }
}

export interface RecurringBody extends Omit<Recurring, 'active'> { active?: boolean }

export function validateRecurring(raw: unknown, partial = false): Valid<Partial<RecurringBody>> {
  if (!isObj(raw)) return { ok: false, fields: { body: 'Expected an object.' } }
  // Reuse the entry rules for the shared fields; nextDate is checked like an entry date.
  const asTx: Record<string, unknown> = { ...raw }
  delete asTx.nextDate
  if ('nextDate' in raw) asTx.date = raw.nextDate
  if (partial) delete asTx.id
  const base = validateTx(asTx, partial)
  const f: Record<string, string> = base.ok ? {} : { ...base.fields }
  if (f.date) { f.nextDate = f.date; delete f.date }
  const out: Partial<RecurringBody> = {}
  if (base.ok) {
    const { date, ...rest } = base.value
    Object.assign(out, rest)
    if (date) out.nextDate = date
  }
  const has = (k: string) => !partial || k in raw
  if (has('note') && !(typeof raw.note === 'string' && raw.note.trim())) f.note = 'Give it a name.'
  if (has('frequency')) {
    if (raw.frequency === 'weekly' || raw.frequency === 'monthly' || raw.frequency === 'yearly') out.frequency = raw.frequency
    else f.frequency = 'Choose how often it repeats.'
  }
  if (has('auto')) out.auto = raw.auto === true
  if ('active' in raw) out.active = raw.active !== false
  return Object.keys(f).length ? { ok: false, fields: f } : { ok: true, value: out }
}

function namedList(v: unknown, max: number): Array<{ id: string, name: string }> | null {
  if (!Array.isArray(v) || v.length > max) return null
  const out = []
  for (const item of v) {
    if (!isObj(item) || !isId(item.id) || typeof item.name !== 'string') return null
    const name = item.name.trim().slice(0, 60)
    if (!name) return null
    out.push({ id: item.id, name })
  }
  return out
}

export function validateHouseholdPatch(raw: unknown): Valid<HouseholdPatchBody> {
  if (!isObj(raw)) return { ok: false, fields: { body: 'Expected an object.' } }
  const f: Record<string, string> = {}
  const name = typeof raw.name === 'string' ? raw.name.trim().slice(0, 60) : ''
  if (!name) f.name = 'Household name is required.'
  const categories = Array.isArray(raw.categories) && raw.categories.length <= 100
    ? raw.categories.map(category).filter((c): c is Category => c !== null && isId(c.id))
    : null
  if (!categories || categories.length !== (raw.categories as unknown[]).length) f.categories = 'Invalid categories.'
  const members = namedList(raw.members, 30)
  if (!members || !members.length) f.members = 'At least one person is required.'
  const methods = namedList(raw.methods, 30)
  if (!methods) f.methods = 'Invalid payment methods.'
  const s = isObj(raw.settings) ? raw.settings : null
  const currency = s && typeof s.currency === 'string' && /^[A-Z]{3}$/.test(s.currency) ? s.currency : null
  if (!currency) f.currency = 'Invalid currency.'
  const startDay = s ? int(s.periodStartDay) : null
  if (!startDay || startDay < 1 || startDay > 28) f.periodStartDay = 'Day must be 1 to 28.'
  const budget = s && s.monthlyBudget !== null ? amountOf(s.monthlyBudget) : null
  if (s && s.monthlyBudget !== null && s.monthlyBudget !== undefined && !budget) f.monthlyBudget = 'Invalid budget.'
  const timezone = s && typeof s.timezone === 'string' && isTimeZone(s.timezone) ? s.timezone : undefined
  if (Object.keys(f).length) return { ok: false, fields: f }
  return {
    ok: true,
    value: {
      name, categories: categories!, members: members!, methods: methods!,
      settings: { currency: currency!, periodStartDay: startDay!, monthlyBudget: budget, setupDone: s?.setupDone === true, timezone },
    },
  }
}
export interface HouseholdPatchBody {
  name: string
  categories: Category[]
  members: Member[]
  methods: PaymentMethod[]
  settings: { currency: string, periodStartDay: number, monthlyBudget: number | null, setupDone: boolean, timezone?: string }
}

export function isTimeZone(tz: string): boolean {
  if (tz.length > 64) return false
  try { new Intl.DateTimeFormat('en', { timeZone: tz }); return true } catch { return false }
}

export function validatePrefs(raw: unknown): Valid<{ theme: Settings['theme'], defaultMemberId: string | null, defaultMethodId: string | null }> {
  if (!isObj(raw)) return { ok: false, fields: { body: 'Expected an object.' } }
  const theme = raw.theme === 'light' || raw.theme === 'dark' || raw.theme === 'system' ? raw.theme : null
  const m = optId(raw.defaultMemberId), p = optId(raw.defaultMethodId)
  if (!theme || m === undefined || p === undefined) return { ok: false, fields: { body: 'Invalid preferences.' } }
  return { ok: true, value: { theme, defaultMemberId: m, defaultMethodId: p } }
}

const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/

export interface RegisterBody {
  name: string
  email: string
  password: string
  householdName: string | null
  inviteCode: string | null
  currency: string
  timezone: string
}

export function validateRegister(raw: unknown): Valid<RegisterBody> {
  if (!isObj(raw)) return { ok: false, fields: { body: 'Expected an object.' } }
  const f: Record<string, string> = {}
  const name = typeof raw.name === 'string' ? raw.name.trim().slice(0, 60) : ''
  if (!name) f.name = 'Enter your name.'
  const email = typeof raw.email === 'string' ? raw.email.trim().toLowerCase() : ''
  if (!EMAIL_RE.test(email) || email.length > 254) f.email = 'Enter a valid email address.'
  const password = typeof raw.password === 'string' ? raw.password : ''
  if (password.length < 8) f.password = 'Use at least 8 characters.'
  else if (password.length > 200) f.password = 'Password is too long.'
  const inviteCode = typeof raw.inviteCode === 'string' && raw.inviteCode.trim() ? raw.inviteCode.trim().toUpperCase() : null
  if (inviteCode && !/^[A-Z0-9]{6,12}$/.test(inviteCode)) f.inviteCode = 'That invite code is not valid.'
  const householdName = typeof raw.householdName === 'string' && raw.householdName.trim() ? raw.householdName.trim().slice(0, 60) : null
  const currency = typeof raw.currency === 'string' && /^[A-Z]{3}$/.test(raw.currency) ? raw.currency : DEFAULT_CURRENCY
  const timezone = typeof raw.timezone === 'string' && isTimeZone(raw.timezone) ? raw.timezone : 'UTC'
  return Object.keys(f).length ? { ok: false, fields: f } : { ok: true, value: { name, email, password, householdName, inviteCode, currency, timezone } }
}

export function validateLogin(raw: unknown): Valid<{ email: string, password: string }> {
  if (!isObj(raw)) return { ok: false, fields: { body: 'Expected an object.' } }
  const email = typeof raw.email === 'string' ? raw.email.trim().toLowerCase() : ''
  const password = typeof raw.password === 'string' ? raw.password : ''
  if (!email || !password || password.length > 200) return { ok: false, fields: { email: 'Enter your email and password.' } }
  return { ok: true, value: { email, password } }
}
