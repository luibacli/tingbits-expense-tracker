import { defineStore } from 'pinia'
import { computed, reactive, ref, watch } from 'vue'
import type { AppData, Bootstrap, Category, Household, Recurring, SessionUser, Transaction } from '#shared/types'
import type { RegisterBody } from '#shared/utils/validate'

/*
 * The household ledger on the client.
 *
 * - Source of truth is the server (MongoDB). The last bootstrap is cached on the device so the
 *   app opens instantly and works with no signal.
 * - Every change is applied to local state first, then sent through an outbox. Requests are
 *   sent in order; a request that cannot reach the server stays queued (persisted) and is retried
 *   when the device is back online. Creates use client-made ids, so retries are safe.
 * - Settings-like data (household, preferences) is edited in place and saved by a debounced watcher.
 */

const CACHE_KEY = 'tingbits:cache:v2'
const OUTBOX_KEY = 'tingbits:outbox:v2'
// Written by the device-only v1 (released as "Bacli Expenses"); still read so old phones can import it.
const LEGACY_KEY = 'bacli-expenses:v1'

type Method = 'POST' | 'PATCH' | 'DELETE'
interface Op {
  id: string
  method: Method
  url: string
  body?: unknown
  /** Ops with the same key replace each other (only the latest settings save matters). */
  key?: string
  /** Re-read from the server after this succeeds (the server may have posted recurring entries). */
  refreshAfter?: boolean
}

export type Status = 'loading' | 'ready' | 'signed-out' | 'unreachable'

const FALLBACK_CATEGORY: Category = { id: '?', name: 'Uncategorized', emoji: '❔', kind: 'expense', budget: null, archived: false }

function readJSON<T>(key: string): T | null {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) as T : null } catch { return null }
}
function writeJSON(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* storage full or blocked: the server still has the data */ }
}
function emptyData(): AppData {
  return { ...defaultData(), categories: [], members: [], methods: [] }
}

export const useLedgerStore = defineStore('ledger', () => {
  const toast = useToast()

  const status = ref<Status>('loading')
  const user = ref<SessionUser | null>(null)
  const household = ref<Pick<Household, 'id' | 'inviteCode' | 'accounts' | 'subscription'> & { timezone: string } | null>(null)
  const householdName = ref('')
  const data = reactive<AppData>(emptyData())
  const loadedFrom = ref('')
  const sync = reactive({ online: true, syncing: false, pending: 0 })

  const categoryMap = computed(() => new Map(data.categories.map((c) => [c.id, c])))
  const memberMap = computed(() => new Map(data.members.map((m) => [m.id, m])))
  const methodMap = computed(() => new Map(data.methods.map((m) => [m.id, m])))
  const accountMap = computed(() => new Map((household.value?.accounts ?? []).map((a) => [a.id, a])))
  const isOwner = computed(() => user.value?.role === 'owner')

  // Trial / subscription. Recomputed from the dates against the clock, so it also expires while offline.
  const clock = ref(Date.now())
  const subscription = computed(() => {
    const s = household.value?.subscription
    return s ? subscriptionState({ trialEndsAt: s.trialEndsAt, paidThrough: s.paidThrough }, new Date(clock.value)) : null
  })
  const canWrite = computed(() => subscription.value?.canWrite !== false)
  /** Read-only households can't add or change entries; say so instead of queueing a change the server will refuse. */
  const readOnlyMessage = computed(() => (isOwner.value
    ? 'Your free trial has ended. Subscribe in Settings to keep adding entries.'
    : 'The household’s free trial has ended. Ask the owner to subscribe.'))
  function writable(): boolean {
    if (canWrite.value) return true
    toast.show(readOnlyMessage.value)
    return false
  }

  const category = (id: string) => categoryMap.value.get(id) ?? FALLBACK_CATEGORY
  const money = (cents: number, opts?: { compact?: boolean, sign?: boolean }) => formatMoney(cents, data.settings.currency, opts)

  /* ---------- applying server state ---------- */

  let lastHousehold = ''
  let lastPrefs = ''
  const householdPayload = () => JSON.stringify({
    name: householdName.value,
    categories: data.categories,
    members: data.members,
    methods: data.methods,
    settings: {
      currency: data.settings.currency,
      monthlyBudget: data.settings.monthlyBudget,
      periodStartDay: data.settings.periodStartDay,
      setupDone: data.settings.setupDone,
    },
  })
  const prefsPayload = () => JSON.stringify({
    theme: data.settings.theme,
    defaultMemberId: data.settings.defaultMemberId,
    defaultMethodId: data.settings.defaultMethodId,
  })

  function apply(b: Bootstrap) {
    clock.value = Date.now()
    user.value = b.user
    household.value = { id: b.household.id, inviteCode: b.household.inviteCode, accounts: b.household.accounts, subscription: b.household.subscription, timezone: b.household.settings.timezone }
    householdName.value = b.household.name
    data.categories = b.household.categories
    data.members = b.household.members
    data.methods = b.household.methods
    data.recurring = b.recurring
    data.transactions = b.transactions
    data.settings = { ...b.household.settings, ...b.user.prefs }
    loadedFrom.value = b.from
    lastHousehold = householdPayload()
    lastPrefs = prefsPayload()
  }

  // Cache a snapshot of what the user sees, so the next start is instant and works offline.
  let cacheTimer: ReturnType<typeof setTimeout> | undefined
  function saveCache() {
    clearTimeout(cacheTimer)
    cacheTimer = setTimeout(() => {
      if (!user.value || !household.value) return
      const snapshot: Bootstrap = {
        user: { ...user.value, prefs: { theme: data.settings.theme, defaultMemberId: data.settings.defaultMemberId, defaultMethodId: data.settings.defaultMethodId } },
        household: {
          ...household.value,
          name: householdName.value,
          categories: data.categories, members: data.members, methods: data.methods,
          settings: { currency: data.settings.currency, monthlyBudget: data.settings.monthlyBudget, periodStartDay: data.settings.periodStartDay, setupDone: data.settings.setupDone, timezone: household.value.timezone },
        },
        recurring: data.recurring, transactions: data.transactions, from: loadedFrom.value, posted: 0, today: todayISO(),
      }
      writeJSON(CACHE_KEY, snapshot)
    }, 300)
  }
  watch([data, householdName], saveCache, { deep: true })

  /* ---------- outbox ---------- */

  const outbox: Op[] = readJSON<Op[]>(OUTBOX_KEY) ?? []
  sync.pending = outbox.length
  let flushing: Promise<void> | null = null

  function persistOutbox() {
    writeJSON(OUTBOX_KEY, outbox)
    sync.pending = outbox.length
  }

  // Bumped on every local change. A refresh that started before the latest change is discarded,
  // so a slow response can never overwrite newer edits.
  let localVersion = 0

  /** Queue a change and start sending. `queueOnly` just stores it (used while the page is going away). */
  function send(op: Omit<Op, 'id'>, queueOnly = false) {
    localVersion++
    if (op.key) {
      const i = outbox.findIndex((o, idx) => o.key === op.key && idx > 0) // never replace the one in flight
      if (i >= 0) outbox.splice(i, 1)
    }
    outbox.push({ ...op, id: uid() })
    persistOutbox()
    if (!queueOnly) void flush()
  }

  // Only one flush runs at a time. The marker is cleared in .finally(), which always runs after the
  // assignment (clearing it inside the async body broke when the body finished synchronously).
  function flush(): Promise<void> {
    if (!flushing) flushing = runFlush().finally(() => { flushing = null })
    return flushing
  }

  async function runFlush(): Promise<void> {
    let refreshNeeded = false
    sync.syncing = true
    try {
      while (outbox.length) {
        const op = outbox[0]!
        try {
          await $fetch(op.url, { method: op.method, body: op.body as Record<string, unknown> | undefined })
          outbox.shift()
          sync.online = true
          if (op.refreshAfter) refreshNeeded = true
        } catch (err) {
          const f = toApiFailure(err)
          if (f.status === 0) { sync.online = false; break } // offline: keep it, retry later
          if (f.status === 401) { signedOut(); break }
          if (f.status >= 500 || f.status === 429) break // server or database trouble: retry later
          // The server rejected the change (e.g. the entry was deleted on another phone): drop it and resync.
          outbox.shift()
          toast.show(`Not saved: ${f.message}`)
          refreshNeeded = true
        } finally {
          persistOutbox()
        }
      }
    } finally {
      sync.syncing = false
    }
    // Not awaited: refresh() itself waits for flush(), so awaiting here would deadlock.
    if (refreshNeeded && !outbox.length) queueMicrotask(() => { void refresh() })
  }

  /* ---------- loading ---------- */

  let initPromise: Promise<void> | null = null
  let listening = false
  function init(): Promise<void> {
    if (initPromise) return initPromise
    const cached = readJSON<Bootstrap>(CACHE_KEY)
    if (cached?.user && cached.household) {
      apply(cached)
      status.value = 'ready'
      void refresh()
      initPromise = Promise.resolve()
    } else {
      // No cached account: ask cheaply whether a session exists before loading everything.
      initPromise = $fetch<{ signedIn: boolean }>('/api/auth/session')
        .then((s) => (s.signedIn ? refresh() : signedOut()))
        .catch(() => refresh())
    }
    if (!listening) {
      listening = true
      window.addEventListener('online', () => { sync.online = true; void refresh() })
      window.addEventListener('offline', () => { sync.online = false })
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') void refresh() })
      // Pick up what others in the household logged while this screen stays open.
      setInterval(() => {
        clock.value = Date.now()
        if (document.visibilityState === 'visible' && status.value === 'ready') void refresh()
      }, 60_000)
    }
    return initPromise
  }

  let refreshing: Promise<void> | null = null
  function refresh(): Promise<void> {
    if (!refreshing) refreshing = runRefresh().finally(() => { refreshing = null })
    return refreshing
  }

  async function runRefresh(): Promise<void> {
    try {
      await flush()
      if (outbox.length) return // still offline: keep showing local state
      const defaultFrom = addDays(todayISO(), -400)
      const from = loadedFrom.value && loadedFrom.value < defaultFrom ? loadedFrom.value : defaultFrom
      const startedAt = localVersion
      const b = await $fetch<Bootstrap>('/api/bootstrap', { query: { from } })
      if (outbox.length || startedAt !== localVersion) {
        // Changed while loading: this snapshot may be older than local state. Try again shortly.
        setTimeout(() => { void refresh() }, 500)
        return
      }
      apply(b)
      status.value = 'ready'
      sync.online = true
      if (b.posted) toast.show(`${b.posted} recurring ${b.posted === 1 ? 'entry' : 'entries'} posted`)
    } catch (err) {
      const f = toApiFailure(err)
      if (f.status === 401) signedOut()
      else {
        if (f.status === 0) sync.online = false
        if (status.value !== 'ready') status.value = 'unreachable'
      }
    }
  }

  /** Load older entries when a screen needs dates before what is loaded. */
  async function ensureFrom(date: string) {
    if (!loadedFrom.value || date >= loadedFrom.value || status.value !== 'ready') return
    try {
      const older = await $fetch<Transaction[]>('/api/transactions', { query: { from: date, to: addDays(loadedFrom.value, -1) } })
      const have = new Set(data.transactions.map((t) => t.id))
      data.transactions.push(...older.filter((t) => !have.has(t.id)))
      loadedFrom.value = date
    } catch { /* offline: older history appears when back online */ }
  }

  /** Search notes across all time on the server. Results are merged into local state. */
  async function search(q: string): Promise<boolean> {
    try {
      const found = await $fetch<Transaction[]>('/api/transactions', { query: { q } })
      const have = new Set(data.transactions.map((t) => t.id))
      data.transactions.push(...found.filter((t) => !have.has(t.id)))
      return true
    } catch {
      return false
    }
  }

  function signedOut() {
    status.value = 'signed-out'
    user.value = null
    household.value = null
    Object.assign(data, emptyData())
    outbox.splice(0, outbox.length)
    persistOutbox()
    try { localStorage.removeItem(CACHE_KEY) } catch { /* ignore */ }
    lastHousehold = ''
    lastPrefs = ''
  }

  /* ---------- settings-like data: saved automatically ---------- */

  let settingsTimer: ReturnType<typeof setTimeout> | undefined
  function saveSettingsNow(queueOnly = false) {
    clearTimeout(settingsTimer)
    if (status.value !== 'ready') return
    const h = householdPayload()
    if (h !== lastHousehold) {
      lastHousehold = h
      const body = JSON.parse(h)
      send({ method: 'PATCH', url: '/api/household', body: { ...body, settings: { ...body.settings, timezone: household.value?.timezone } }, key: 'household' }, queueOnly)
    }
    const p = prefsPayload()
    if (p !== lastPrefs) {
      lastPrefs = p
      send({ method: 'PATCH', url: '/api/me/prefs', body: JSON.parse(p), key: 'prefs' }, queueOnly)
    }
  }
  // Typing in settings fields saves after a short pause...
  watch([() => householdPayload(), () => prefsPayload()], () => {
    if (status.value !== 'ready') return
    clearTimeout(settingsTimer)
    settingsTimer = setTimeout(() => saveSettingsNow(), 600)
  })
  // ...and is queued at once if the app is closed or backgrounded first. Only queued, not sent:
  // a request started while the page unloads gets cancelled. The outbox is stored on the device
  // and sent when the app is next opened or comes back to the foreground.
  if (typeof window !== 'undefined') {
    window.addEventListener('pagehide', () => saveSettingsNow(true))
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') saveSettingsNow(true) })
  }

  /* ---------- entries ---------- */

  type TxInput = Omit<Transaction, 'id' | 'createdAt' | 'createdBy'>

  function addTransaction(input: TxInput): Transaction | null {
    if (!writable()) return null
    const tx: Transaction = { ...input, id: uid(), createdAt: Date.now(), createdBy: user.value?.id ?? null }
    data.transactions.push(tx)
    send({ method: 'POST', url: '/api/transactions', body: txBody(tx) })
    return tx
  }

  function updateTransaction(id: string, patch: Partial<TxInput>) {
    if (!writable()) return
    const tx = data.transactions.find((t) => t.id === id)
    if (!tx) return
    Object.assign(tx, patch)
    const { recurringId: _r, ...body } = patch
    send({ method: 'PATCH', url: `/api/transactions/${encodeURIComponent(id)}`, body })
  }

  function deleteTransaction(id: string): Transaction | null {
    if (!writable()) return null
    const i = data.transactions.findIndex((t) => t.id === id)
    if (i < 0) return null
    const [removed] = data.transactions.splice(i, 1)
    send({ method: 'DELETE', url: `/api/transactions/${encodeURIComponent(id)}` })
    return removed ?? null
  }

  function restoreTransaction(tx: Transaction) {
    if (!writable()) return
    if (data.transactions.some((t) => t.id === tx.id)) return
    data.transactions.push(tx)
    send({ method: 'POST', url: '/api/transactions', body: txBody(tx) })
  }

  const txBody = (t: Transaction) => ({
    id: t.id, type: t.type, amount: t.amount, categoryId: t.categoryId, note: t.note, date: t.date, memberId: t.memberId, methodId: t.methodId,
  })

  /* ---------- recurring ---------- */

  type RecurringInput = Omit<Recurring, 'id'>

  function saveRecurring(fields: RecurringInput, id?: string): Recurring | null {
    if (!writable()) return null
    const existing = id ? data.recurring.find((r) => r.id === id) : undefined
    if (existing) {
      Object.assign(existing, fields)
      send({ method: 'PATCH', url: `/api/recurring/${encodeURIComponent(existing.id)}`, body: fields, refreshAfter: true })
      return existing
    }
    const r: Recurring = { ...fields, id: uid() }
    data.recurring.push(r)
    send({ method: 'POST', url: '/api/recurring', body: r, refreshAfter: true })
    return r
  }

  function deleteRecurring(id: string): Recurring | null {
    if (!writable()) return null
    const i = data.recurring.findIndex((r) => r.id === id)
    if (i < 0) return null
    const [removed] = data.recurring.splice(i, 1)
    send({ method: 'DELETE', url: `/api/recurring/${encodeURIComponent(id)}` })
    return removed ?? null
  }

  function restoreRecurring(r: Recurring) {
    if (!writable()) return
    if (data.recurring.some((x) => x.id === r.id)) return
    data.recurring.push(r)
    send({ method: 'POST', url: '/api/recurring', body: r, refreshAfter: true })
  }

  const advance = (r: Recurring) => nextOccurrence(r.nextDate, r.frequency, Number(r.nextDate.slice(8, 10)))

  /** Record a payment of a manual recurring item and move it to its next due date. */
  function markRecurringPaid(id: string, date = todayISO()) {
    if (!writable()) return null
    const r = data.recurring.find((x) => x.id === id)
    if (!r) return null
    const previousDue = r.nextDate
    const tx: Transaction = {
      id: uid(), type: r.type, amount: r.amount, categoryId: r.categoryId, note: r.note, date,
      memberId: r.memberId, methodId: r.methodId, recurringId: r.id, createdAt: Date.now(), createdBy: user.value?.id ?? null,
    }
    data.transactions.push(tx)
    r.nextDate = advance(r)
    send({ method: 'POST', url: `/api/recurring/${encodeURIComponent(id)}/pay`, body: { transactionId: tx.id, date, from: previousDue } })
    return { tx, previousDue }
  }

  /** Undo "Mark paid": remove the entry and put the due date back. */
  function undoPaid(id: string, tx: Transaction, previousDue: string) {
    deleteTransaction(tx.id)
    const r = data.recurring.find((x) => x.id === id)
    if (!r) return
    r.nextDate = previousDue
    send({ method: 'PATCH', url: `/api/recurring/${encodeURIComponent(id)}`, body: { nextDate: previousDue } })
  }

  function skipRecurring(id: string) {
    if (!writable()) return
    const r = data.recurring.find((x) => x.id === id)
    if (!r) return
    const from = r.nextDate
    r.nextDate = advance(r)
    send({ method: 'POST', url: `/api/recurring/${encodeURIComponent(id)}/skip`, body: { from } })
  }

  /* ---------- account and household actions (online only) ---------- */

  async function login(email: string, password: string) {
    await $fetch('/api/auth/login', { method: 'POST', body: { email, password } })
    await refresh()
  }

  async function register(body: Omit<RegisterBody, 'timezone' | 'currency'> & { currency?: string }) {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
    await $fetch('/api/auth/register', { method: 'POST', body: { ...body, currency: body.currency ?? DEFAULT_CURRENCY, timezone } })
    await refresh()
  }

  async function logout() {
    await flush()
    try { await $fetch('/api/auth/logout', { method: 'POST' }) } catch { /* signing out locally is enough to hide data */ }
    signedOut()
  }

  async function regenerateInvite() {
    const res = await $fetch<{ inviteCode: string }>('/api/household/invite', { method: 'POST' })
    if (household.value) household.value.inviteCode = res.inviteCode
  }

  async function importData(payload: unknown) {
    await flush()
    const res = await $fetch<{ entries: number, skipped: number, recurring: number }>('/api/import', { method: 'POST', body: payload as Record<string, unknown> })
    await refresh()
    return res
  }

  async function eraseLedger() {
    await flush()
    await $fetch('/api/household/ledger', { method: 'DELETE', body: { confirm: 'ERASE' } })
    await refresh()
  }

  /** Data saved on this device by the earlier offline-only version, if any. */
  function legacyData(): AppData | null {
    const raw = readJSON<unknown>(LEGACY_KEY)
    const parsed = raw ? normalizeData(raw) : null
    return parsed && parsed.transactions.length + parsed.recurring.length > 0 ? parsed : null
  }
  function forgetLegacyData() {
    try { localStorage.removeItem(LEGACY_KEY) } catch { /* ignore */ }
  }

  return {
    status, user, household, householdName, data, loadedFrom, sync,
    categoryMap, memberMap, methodMap, accountMap, isOwner, subscription, canWrite, readOnlyMessage,
    category, money,
    init, refresh, flush, ensureFrom, search,
    addTransaction, updateTransaction, deleteTransaction, restoreTransaction,
    saveRecurring, deleteRecurring, restoreRecurring, markRecurringPaid, undoPaid, skipRecurring,
    login, register, logout, regenerateInvite, importData, eraseLedger, legacyData, forgetLegacyData,
  }
})
