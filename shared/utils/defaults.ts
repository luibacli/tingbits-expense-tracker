import type { AppData, Category, Settings } from '#shared/types'
import { DEFAULT_CURRENCY } from './money'

export function uid(): string {
  // crypto.randomUUID needs a secure context; a LAN dev URL on a phone is not one.
  // Browsers expose isSecureContext; on the server it is undefined, which counts as secure.
  const secure = (globalThis as { isSecureContext?: boolean }).isSecureContext !== false
  if (secure && typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

const expense: Array<[string, string, string]> = [
  ['food', 'Food & dining', '🍜'],
  ['groceries', 'Groceries', '🛒'],
  ['transport', 'Transport', '🚌'],
  ['bills', 'Bills & utilities', '💡'],
  ['home', 'Rent & home', '🏠'],
  ['shopping', 'Shopping', '🛍️'],
  ['health', 'Health', '💊'],
  ['family', 'Family & kids', '👶'],
  ['fun', 'Fun & leisure', '🎬'],
  ['education', 'Education', '📚'],
  ['giving', 'Gifts & giving', '🎁'],
  ['other', 'Other', '📦'],
]

const income: Array<[string, string, string]> = [
  ['salary', 'Salary', '💼'],
  ['side', 'Side income', '💸'],
  ['gift-in', 'Gifts received', '🎉'],
  ['other-in', 'Other income', '➕'],
]

export function defaultCategories(): Category[] {
  return [
    ...expense.map(([id, name, emoji]) => ({ id, name, emoji, kind: 'expense' as const, budget: null, archived: false })),
    ...income.map(([id, name, emoji]) => ({ id, name, emoji, kind: 'income' as const, budget: null, archived: false })),
  ]
}

export function defaultSettings(currency = DEFAULT_CURRENCY): Settings {
  return {
    currency,
    monthlyBudget: null,
    periodStartDay: 1,
    theme: 'system',
    defaultMemberId: 'me',
    defaultMethodId: 'cash',
    setupDone: false,
  }
}

export function defaultData(currency?: string): AppData {
  return {
    version: 1,
    transactions: [],
    categories: defaultCategories(),
    members: [{ id: 'me', name: 'Me' }],
    methods: [
      { id: 'cash', name: 'Cash' },
      { id: 'card', name: 'Card' },
      { id: 'ewallet', name: 'E-wallet' },
      { id: 'bank', name: 'Bank transfer' },
    ],
    recurring: [],
    settings: defaultSettings(currency),
  }
}
