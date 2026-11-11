<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Download, Upload, FileSpreadsheet, Trash2, Plus, Archive, ArchiveRestore, Smartphone, X, Copy, LogOut, Users, CreditCard, UserCog, KeyRound } from '@lucide/vue'
import type { AppData, TxType } from '#shared/types'

useSeoMeta({ title: 'Settings' })

const store = useLedgerStore()
const { data } = store
const toast = useToast()

// ---------- people, methods, categories ----------
const newPerson = ref('')
function addPerson() {
  const name = newPerson.value.trim()
  if (!name) return
  data.members.push({ id: uid(), name: name.slice(0, 60) })
  newPerson.value = ''
}
function removePerson(id: string) {
  if (data.members.length <= 1) return
  data.members = data.members.filter((m) => m.id !== id)
  if (data.settings.defaultMemberId === id) data.settings.defaultMemberId = data.members[0]?.id ?? null
}

const newMethod = ref('')
function addMethod() {
  const name = newMethod.value.trim()
  if (!name) return
  data.methods.push({ id: uid(), name: name.slice(0, 60) })
  newMethod.value = ''
}
function removeMethod(id: string) {
  data.methods = data.methods.filter((m) => m.id !== id)
  if (data.settings.defaultMethodId === id) data.settings.defaultMethodId = null
}

const catKind = ref<TxType>('expense')
const newCatName = ref('')
const newCatEmoji = ref('')
const shownCats = computed(() => data.categories.filter((c) => c.kind === catKind.value))
const usage = computed(() => {
  const m = new Map<string, number>()
  for (const t of data.transactions) m.set(t.categoryId, (m.get(t.categoryId) ?? 0) + 1)
  return m
})
function addCategory() {
  const name = newCatName.value.trim()
  if (!name) return
  data.categories.push({ id: uid(), name: name.slice(0, 60), emoji: newCatEmoji.value.trim() || '🏷️', kind: catKind.value, budget: null, archived: false })
  newCatName.value = ''; newCatEmoji.value = ''
}

// ---------- household and account ----------
const inviteBusy = ref(false)
async function newInvite() {
  inviteBusy.value = true
  try { await store.regenerateInvite(); toast.show('New invite code made. The old one no longer works.') }
  catch (err) { toast.show(toApiFailure(err).message) }
  finally { inviteBusy.value = false }
}
async function copyInvite() {
  const code = store.household?.inviteCode
  if (!code) return
  try { await navigator.clipboard.writeText(code); toast.show('Invite code copied') }
  catch { toast.show(`Invite code: ${code}`) }
}
// The layout moves to the sign-in screen once the store reports the session ended.
async function signOut() {
  await store.logout()
}

// ---------- account management (owner: remove, make owner; everyone: password, delete) ----------
const acting = ref<{ id: string, kind: 'remove' | 'owner' } | null>(null)
const actPassword = ref('')
const actError = ref('')
const actBusy = ref(false)
const actingName = computed(() => store.household?.accounts.find((a) => a.id === acting.value?.id)?.name ?? '')
function startAct(id: string, kind: 'remove' | 'owner') {
  acting.value = { id, kind }
  actPassword.value = ''
  actError.value = ''
}
async function confirmAct() {
  if (!acting.value) return
  const { id, kind } = acting.value
  const name = actingName.value
  actBusy.value = true
  actError.value = ''
  try {
    if (kind === 'remove') {
      await store.removeAccount(id)
      toast.show(`${name} was removed from the household`)
    } else {
      await store.transferOwnership(id, actPassword.value)
      toast.show(`${name} is now the owner`)
    }
    acting.value = null
  } catch (err) {
    const f = toApiFailure(err)
    actError.value = f.fields.password ?? f.message
  } finally {
    actBusy.value = false
  }
}

const pwCurrent = ref('')
const pwNext = ref('')
const pwErrors = ref<Record<string, string>>({})
const pwBusy = ref(false)
const pwOpen = ref(false)
async function savePassword() {
  pwErrors.value = {}
  if (pwNext.value.length < 8) { pwErrors.value = { next: 'Use at least 8 characters.' }; return }
  pwBusy.value = true
  try {
    await store.changePassword(pwCurrent.value, pwNext.value)
    pwCurrent.value = ''; pwNext.value = ''; pwOpen.value = false
    toast.show('Password changed')
  } catch (err) {
    const f = toApiFailure(err)
    pwErrors.value = f.fields.password ? { current: f.fields.password } : Object.keys(f.fields).length ? f.fields : { current: f.message }
  } finally {
    pwBusy.value = false
  }
}

const otherAccounts = computed(() => (store.household?.accounts ?? []).filter((a) => a.id !== store.user?.id).length)
const delOpen = ref(false)
const delPassword = ref('')
const delError = ref('')
const delBusy = ref(false)
async function deleteMe() {
  delError.value = ''
  delBusy.value = true
  try {
    await store.deleteAccount(delPassword.value)
  } catch (err) {
    const f = toApiFailure(err)
    delError.value = f.fields.password ?? f.message
  } finally {
    delBusy.value = false
  }
}

// ---------- data ----------
const BACKUP_KEY = 'tingbits:last-backup'
const lastBackup = ref<string | null>(null)
onMounted(() => { try { lastBackup.value = localStorage.getItem(BACKUP_KEY) } catch { /* ignore */ } })
function markBackup() {
  const now = new Date().toISOString()
  try { localStorage.setItem(BACKUP_KEY, now) } catch { /* ignore */ }
  lastBackup.value = now
}

const fileEl = ref<HTMLInputElement | null>(null)
const pendingImport = ref<{ data: AppData, source: 'file' | 'device' } | null>(null)
const importError = ref('')
const importBusy = ref(false)
const legacy = ref<AppData | null>(null)
onMounted(() => { legacy.value = store.legacyData() })

async function onFile(e: Event) {
  importError.value = ''
  pendingImport.value = null
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  try {
    if (file.size > 20_000_000) throw new Error('too big')
    const parsed = normalizeData(JSON.parse(await file.text()))
    if (!parsed) throw new Error('not a backup')
    pendingImport.value = { data: parsed, source: 'file' }
  } catch {
    importError.value = 'That file is not a Tingbits backup.'
  } finally {
    if (fileEl.value) fileEl.value.value = ''
  }
}
async function confirmImport() {
  if (!pendingImport.value) return
  importBusy.value = true
  importError.value = ''
  try {
    const { source, data: payload } = pendingImport.value
    const res = await store.importData(payload)
    if (source === 'device') { store.forgetLegacyData(); legacy.value = null }
    pendingImport.value = null
    toast.show(`Added ${res.entries} entries${res.skipped ? `, ${res.skipped} already there` : ''}`)
  } catch (err) {
    importError.value = toApiFailure(err).message
  } finally {
    importBusy.value = false
  }
}

const eraseStep = ref(0)
const eraseBusy = ref(false)
async function erase() {
  if (eraseStep.value === 0) { eraseStep.value = 1; return }
  eraseBusy.value = true
  try {
    await store.eraseLedger()
    toast.show('All entries and recurring items erased')
  } catch (err) {
    toast.show(toApiFailure(err).message)
  } finally {
    eraseStep.value = 0
    eraseBusy.value = false
  }
}

// ---------- install ----------
interface InstallEvent extends Event { prompt: () => Promise<void> }
const installEvt = ref<InstallEvent | null>(null)
const standalone = ref(false)
const isIOS = ref(false)
onMounted(() => {
  standalone.value = window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true
  isIOS.value = /iPhone|iPad|iPod/.test(navigator.userAgent)
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installEvt.value = e as InstallEvent })
})
async function install() {
  await installEvt.value?.prompt()
  installEvt.value = null
}

const formatDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { dateStyle: 'long' })
const formatBackup = (iso: string) => new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
</script>

<template>
  <div class="space-y-6">
    <h1 class="text-2xl font-semibold tracking-tight">Settings</h1>

    <section class="card space-y-3 p-4" aria-labelledby="household-heading">
      <h2 id="household-heading" class="flex items-center gap-2 font-semibold"><Users :size="18" aria-hidden="true" /> Household</h2>
      <div>
        <label for="household-name" class="label">Name</label>
        <input id="household-name" v-model.trim="store.householdName" class="field" maxlength="60">
      </div>
      <div>
        <p class="label">Accounts</p>
        <ul class="divide-y divide-line text-sm" data-testid="accounts">
          <li v-for="a in store.household?.accounts ?? []" :key="a.id" class="py-2">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <span>{{ a.name }}<span v-if="a.id === store.user?.id" class="text-muted"> (you)</span></span>
              <span class="flex items-center gap-1">
                <span class="text-muted">{{ a.role === 'owner' ? 'Owner' : 'Member' }}</span>
                <template v-if="store.isOwner && a.id !== store.user?.id && acting?.id !== a.id">
                  <button type="button" class="btn btn-ghost !min-h-10 text-sm" :aria-label="`Make ${a.name} the owner`" @click="startAct(a.id, 'owner')">Make owner</button>
                  <button type="button" class="btn btn-ghost !min-h-10 text-sm" :aria-label="`Remove ${a.name}'s account`" @click="startAct(a.id, 'remove')">Remove</button>
                </template>
              </span>
            </div>
            <form v-if="acting?.id === a.id" class="mt-2 space-y-2 rounded-xl border border-line-strong p-3" role="group" :aria-label="acting.kind === 'remove' ? `Remove ${a.name}'s account` : `Make ${a.name} the owner`" @submit.prevent="confirmAct">
              <p v-if="acting.kind === 'remove'">Remove <strong>{{ a.name }}</strong>? They can no longer sign in to this household. Entries they added stay.</p>
              <template v-else>
                <p>Make <strong>{{ a.name }}</strong> the owner? You become a member, and only they can manage the plan, invite people and erase entries.</p>
                <div>
                  <label :for="`act-pw-${a.id}`" class="label">Your password</label>
                  <input :id="`act-pw-${a.id}`" v-model="actPassword" type="password" class="field" autocomplete="current-password" required :aria-invalid="!!actError" :aria-describedby="actError ? 'act-error' : undefined">
                </div>
              </template>
              <p v-if="actError" id="act-error" class="text-critical" role="alert">{{ actError }}</p>
              <div class="flex flex-wrap gap-2">
                <button type="submit" :class="acting.kind === 'remove' ? 'btn btn-danger' : 'btn btn-primary'" :disabled="actBusy">{{ actBusy ? 'Saving…' : acting.kind === 'remove' ? 'Remove account' : 'Make owner' }}</button>
                <button type="button" class="btn btn-ghost" :disabled="actBusy" @click="acting = null">Cancel</button>
              </div>
            </form>
          </li>
        </ul>
      </div>
      <div v-if="store.isOwner && store.household?.inviteCode" class="rounded-xl bg-surface-2 p-3">
        <p class="text-sm text-ink-2">To add someone, have them choose <strong>Join</strong> on the sign-in screen and enter:</p>
        <p class="num mt-2 text-2xl font-semibold tracking-[0.2em]" data-testid="invite-code">{{ store.household.inviteCode }}</p>
        <div class="mt-2 flex flex-wrap gap-2">
          <button type="button" class="btn btn-ghost !min-h-10 text-sm" @click="copyInvite"><Copy :size="16" aria-hidden="true" /> Copy</button>
          <button type="button" class="btn btn-ghost !min-h-10 text-sm" :disabled="inviteBusy" @click="newInvite">New code</button>
        </div>
      </div>
      <p v-else-if="!store.isOwner" class="text-sm text-muted">Ask the household owner for an invite code to add more people.</p>
    </section>

    <section id="plan" class="card scroll-mt-20 space-y-3 p-4" aria-labelledby="plan-heading">
      <h2 id="plan-heading" class="flex items-center gap-2 font-semibold"><CreditCard :size="18" aria-hidden="true" /> Plan</h2>
      <div v-if="store.subscription" class="flex flex-wrap items-baseline justify-between gap-2">
        <p>
          <span class="font-semibold">Tingbits Family</span>
          <span class="text-ink-2"> · ₱{{ PRICE_PHP_MONTHLY }} a month for the whole household</span>
        </p>
        <p class="text-sm font-medium" data-testid="plan-status">
          <template v-if="store.subscription.status === 'trial'">Free trial · {{ store.subscription.daysLeft }} {{ store.subscription.daysLeft === 1 ? 'day' : 'days' }} left</template>
          <template v-else-if="store.subscription.status === 'active'">Active</template>
          <template v-else><span class="text-critical">Read-only</span></template>
        </p>
      </div>
      <p v-if="store.subscription" class="text-sm text-ink-2">
        <template v-if="store.subscription.status === 'trial'">Your free trial runs until {{ formatDate(store.subscription.trialEndsAt) }}. No card needed until then.</template>
        <template v-else-if="store.subscription.status === 'active'">Paid through {{ formatDate(store.subscription.paidThrough!) }}.</template>
        <template v-else>Access ended on {{ formatDate(store.subscription.endsAt) }}. Everything is still here to view and export; subscribe to add entries again.</template>
      </p>
      <template v-if="store.isOwner && store.subscription?.status !== 'active'">
        <button type="button" class="btn btn-primary" disabled aria-describedby="plan-pay-note">Subscribe for ₱{{ PRICE_PHP_MONTHLY }}/month</button>
        <p id="plan-pay-note" class="text-sm text-muted">Online payment by card or Maya is being set up and will appear here.</p>
      </template>
      <p v-else-if="!store.isOwner" class="text-sm text-muted">The household owner manages the plan.</p>
    </section>

    <section class="card space-y-4 p-4" aria-labelledby="gen-heading">
      <h2 id="gen-heading" class="font-semibold">General</h2>
      <div class="grid gap-4 sm:grid-cols-2">
        <div>
          <label for="set-currency" class="label">Currency</label>
          <select id="set-currency" v-model="data.settings.currency" class="field">
            <option v-for="c in CURRENCIES" :key="c" :value="c">{{ c }} ({{ currencySymbol(c) }})</option>
          </select>
        </div>
        <div>
          <label for="set-start" class="label">Budget month starts on</label>
          <select id="set-start" v-model.number="data.settings.periodStartDay" class="field">
            <option v-for="d in 28" :key="d" :value="d">Day {{ d }}{{ d === 1 ? ' (calendar month)' : '' }}</option>
          </select>
        </div>
        <div>
          <label for="set-theme" class="label">Appearance</label>
          <select id="set-theme" v-model="data.settings.theme" class="field">
            <option value="system">Match device</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </div>
        <div>
          <label for="set-method" class="label">Default payment method</label>
          <select id="set-method" v-model="data.settings.defaultMethodId" class="field">
            <option :value="null">None</option>
            <option v-for="m in data.methods" :key="m.id" :value="m.id">{{ m.name }}</option>
          </select>
        </div>
      </div>
    </section>

    <section class="card p-4" aria-labelledby="people-heading">
      <h2 id="people-heading" class="font-semibold">People</h2>
      <p class="mt-1 text-sm text-ink-2">Add everyone in the household who spends, to see who paid for what. The default person is pre-selected on every new entry, so set it to whoever uses this phone.</p>
      <ul class="mt-3 space-y-2">
        <li v-for="m in data.members" :key="m.id" class="flex items-center gap-2">
          <label class="sr-only" :for="`person-${m.id}`">Name</label>
          <input :id="`person-${m.id}`" v-model.trim="m.name" class="field" maxlength="60">
          <label class="flex shrink-0 items-center gap-1.5 text-sm">
            <input v-model="data.settings.defaultMemberId" type="radio" name="default-person" :value="m.id" class="size-4 accent-current"> Default
          </label>
          <button v-if="data.members.length > 1" type="button" class="icon-btn shrink-0" :aria-label="`Remove ${m.name}`" @click="removePerson(m.id)"><X :size="18" aria-hidden="true" /></button>
        </li>
      </ul>
      <form class="mt-2 flex gap-2" @submit.prevent="addPerson">
        <label class="sr-only" for="new-person">New person</label>
        <input id="new-person" v-model="newPerson" class="field" placeholder="Add a person" maxlength="60">
        <button type="submit" class="btn btn-ghost shrink-0" :disabled="!newPerson.trim()"><Plus :size="18" aria-hidden="true" /> Add</button>
      </form>
    </section>

    <section class="card p-4" aria-labelledby="cat-heading">
      <div class="flex items-center justify-between gap-2">
        <h2 id="cat-heading" class="font-semibold">Categories</h2>
        <div class="flex rounded-full bg-surface-2 p-0.5" role="group" aria-label="Category type">
          <button v-for="k in (['expense', 'income'] as const)" :key="k" type="button" class="min-h-9 rounded-full px-3 text-sm font-medium capitalize" :class="catKind === k ? 'bg-surface text-ink shadow-sm' : 'text-ink-2'" :aria-pressed="catKind === k" @click="catKind = k">{{ k }}</button>
        </div>
      </div>
      <ul class="mt-3 space-y-2">
        <li v-for="c in shownCats" :key="c.id" class="flex items-center gap-2" :class="c.archived ? 'opacity-55' : ''">
          <label class="sr-only" :for="`cat-emoji-${c.id}`">Icon for {{ c.name }}</label>
          <input :id="`cat-emoji-${c.id}`" v-model="c.emoji" class="field !w-14 text-center" maxlength="8">
          <label class="sr-only" :for="`cat-name-${c.id}`">Name</label>
          <input :id="`cat-name-${c.id}`" v-model="c.name" class="field" maxlength="60">
          <span class="num hidden w-16 shrink-0 text-right text-xs text-muted sm:block">{{ usage.get(c.id) ?? 0 }} uses</span>
          <button type="button" class="icon-btn shrink-0" :aria-label="c.archived ? `Restore ${c.name}` : `Hide ${c.name}`" :title="c.archived ? 'Restore' : 'Hide from the add screen (history is kept)'" @click="c.archived = !c.archived">
            <ArchiveRestore v-if="c.archived" :size="18" aria-hidden="true" /><Archive v-else :size="18" aria-hidden="true" />
          </button>
        </li>
      </ul>
      <form class="mt-2 flex gap-2" @submit.prevent="addCategory">
        <label class="sr-only" for="new-cat-emoji">Icon</label>
        <input id="new-cat-emoji" v-model="newCatEmoji" class="field !w-14 text-center" placeholder="🏷️" maxlength="8">
        <label class="sr-only" for="new-cat-name">New {{ catKind }} category</label>
        <input id="new-cat-name" v-model="newCatName" class="field" :placeholder="`New ${catKind} category`" maxlength="60">
        <button type="submit" class="btn btn-ghost shrink-0" :disabled="!newCatName.trim()"><Plus :size="18" aria-hidden="true" /> Add</button>
      </form>
    </section>

    <section class="card p-4" aria-labelledby="method-heading">
      <h2 id="method-heading" class="font-semibold">Payment methods</h2>
      <ul class="mt-3 space-y-2">
        <li v-for="m in data.methods" :key="m.id" class="flex items-center gap-2">
          <label class="sr-only" :for="`method-${m.id}`">Name</label>
          <input :id="`method-${m.id}`" v-model.trim="m.name" class="field" maxlength="60">
          <button type="button" class="icon-btn shrink-0" :aria-label="`Remove ${m.name}`" @click="removeMethod(m.id)"><X :size="18" aria-hidden="true" /></button>
        </li>
      </ul>
      <form class="mt-2 flex gap-2" @submit.prevent="addMethod">
        <label class="sr-only" for="new-method">New method</label>
        <input id="new-method" v-model="newMethod" class="field" placeholder="GCash, Maya, BPI card…" maxlength="60">
        <button type="submit" class="btn btn-ghost shrink-0" :disabled="!newMethod.trim()"><Plus :size="18" aria-hidden="true" /> Add</button>
      </form>
    </section>

    <section v-if="!standalone" class="card p-4" aria-labelledby="install-heading">
      <h2 id="install-heading" class="flex items-center gap-2 font-semibold"><Smartphone :size="18" aria-hidden="true" /> Put it on your home screen</h2>
      <p class="mt-1 text-sm text-ink-2">
        Opens like an app, works offline.
        <template v-if="isIOS">In Safari, tap Share, then "Add to Home Screen".</template>
        <template v-else-if="!installEvt">In your browser menu, choose "Install app" or "Add to Home screen".</template>
      </p>
      <button v-if="installEvt" type="button" class="btn btn-primary mt-3" @click="install">Install app</button>
    </section>

    <section class="card space-y-4 p-4" aria-labelledby="data-heading">
      <div>
        <h2 id="data-heading" class="font-semibold">Your data</h2>
        <p class="mt-1 text-sm text-ink-2">
          Stored securely in your household's database and shared by everyone in it. A copy of recent entries stays on this device so the app works offline.
        </p>
        <p class="mt-1 text-sm text-ink-2">Last backup from this device: {{ lastBackup ? formatBackup(lastBackup) : 'never' }}</p>
      </div>
      <div v-if="legacy && !pendingImport" class="rounded-xl border border-line-strong p-3" role="status">
        <p class="text-sm"><strong>{{ legacy.transactions.length }}</strong> entries from the earlier offline version are saved on this device.</p>
        <button type="button" class="btn btn-primary mt-2" @click="pendingImport = { data: legacy, source: 'device' }">Add them to the household</button>
      </div>
      <div class="flex flex-wrap gap-2">
        <a href="/api/export" download class="btn btn-primary" @click="markBackup"><Download :size="18" aria-hidden="true" /> Back up (JSON)</a>
        <button type="button" class="btn btn-ghost" @click="fileEl?.click()"><Upload :size="18" aria-hidden="true" /> Import backup</button>
        <a href="/api/export?format=csv" download class="btn btn-ghost"><FileSpreadsheet :size="18" aria-hidden="true" /> Export CSV</a>
        <input ref="fileEl" type="file" accept="application/json,.json" class="hidden" aria-label="Backup file" @change="onFile">
      </div>
      <p v-if="importError" class="text-sm text-critical" role="alert">{{ importError }}</p>
      <div v-if="pendingImport" class="rounded-xl border border-line-strong p-3" role="alert">
        <p class="text-sm">Add <strong>{{ pendingImport.data.transactions.length }}</strong> entries to the household? Entries that are already there are skipped, and nothing is overwritten.</p>
        <div class="mt-2 flex gap-2">
          <button type="button" class="btn btn-primary" :disabled="importBusy" @click="confirmImport">{{ importBusy ? 'Adding…' : 'Add entries' }}</button>
          <button type="button" class="btn btn-ghost" :disabled="importBusy" @click="pendingImport = null">Cancel</button>
        </div>
      </div>
      <div v-if="store.isOwner" class="border-t border-line pt-4">
        <button type="button" class="btn btn-danger" :disabled="eraseBusy" @click="erase"><Trash2 :size="18" aria-hidden="true" /> {{ eraseStep ? 'Tap again to erase all entries for everyone' : 'Erase all entries' }}</button>
        <button v-if="eraseStep" type="button" class="btn ml-2" @click="eraseStep = 0">Cancel</button>
      </div>
    </section>

    <section class="card space-y-4 p-4" aria-labelledby="account-heading">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="account-heading" class="flex items-center gap-2 font-semibold"><UserCog :size="18" aria-hidden="true" /> Your account</h2>
          <p class="text-sm text-ink-2">{{ store.user?.name }} · {{ store.user?.email }}</p>
        </div>
        <button type="button" class="btn btn-ghost" @click="signOut"><LogOut :size="18" aria-hidden="true" /> Sign out</button>
      </div>

      <div class="border-t border-line pt-4">
        <button v-if="!pwOpen" type="button" class="btn btn-ghost" @click="pwOpen = true"><KeyRound :size="18" aria-hidden="true" /> Change password</button>
        <form v-else class="grid gap-3 sm:grid-cols-2" aria-label="Change password" @submit.prevent="savePassword">
          <div>
            <label for="pw-current" class="label">Current password</label>
            <input id="pw-current" v-model="pwCurrent" type="password" class="field" autocomplete="current-password" required :aria-invalid="!!pwErrors.current" :aria-describedby="pwErrors.current ? 'pw-current-error' : undefined">
            <p v-if="pwErrors.current" id="pw-current-error" class="mt-1 text-sm text-critical">{{ pwErrors.current }}</p>
          </div>
          <div>
            <label for="pw-next" class="label">New password</label>
            <input id="pw-next" v-model="pwNext" type="password" class="field" autocomplete="new-password" minlength="8" required :aria-invalid="!!pwErrors.next" aria-describedby="pw-next-hint">
            <p id="pw-next-hint" class="mt-1 text-sm" :class="pwErrors.next ? 'text-critical' : 'text-muted'">{{ pwErrors.next ?? 'At least 8 characters.' }}</p>
          </div>
          <div class="flex flex-wrap gap-2 sm:col-span-2">
            <button type="submit" class="btn btn-primary" :disabled="pwBusy">{{ pwBusy ? 'Saving…' : 'Save password' }}</button>
            <button type="button" class="btn btn-ghost" :disabled="pwBusy" @click="pwOpen = false; pwErrors = {}">Cancel</button>
          </div>
        </form>
      </div>

      <div class="border-t border-line pt-4">
        <button v-if="!delOpen" type="button" class="btn btn-danger" @click="delOpen = true; delError = ''; delPassword = ''"><Trash2 :size="18" aria-hidden="true" /> Delete my account</button>
        <div v-else class="space-y-3 rounded-xl border border-line-strong p-3" role="group" aria-labelledby="del-heading">
          <h3 id="del-heading" class="font-semibold">Delete your account</h3>
          <template v-if="store.isOwner && otherAccounts > 0">
            <p class="text-sm" data-testid="delete-blocked">You own this household and others use it. Make someone else the owner first (Household, above), or remove the other accounts.</p>
            <button type="button" class="btn btn-ghost" @click="delOpen = false">Close</button>
          </template>
          <form v-else class="space-y-3" @submit.prevent="deleteMe">
            <p v-if="store.isOwner" class="text-sm" data-testid="delete-warning">This deletes <strong>{{ store.householdName }}</strong> and all its entries and recurring items, for good. <a href="/api/export" download class="underline underline-offset-2" @click="markBackup">Download a backup</a> first if you may want them.</p>
            <p v-else class="text-sm" data-testid="delete-warning">You will no longer be able to sign in. Entries you added stay with the household.</p>
            <div>
              <label for="del-pw" class="label">Your password</label>
              <input id="del-pw" v-model="delPassword" type="password" class="field" autocomplete="current-password" required :aria-invalid="!!delError" :aria-describedby="delError ? 'del-error' : undefined">
            </div>
            <p v-if="delError" id="del-error" class="text-sm text-critical" role="alert">{{ delError }}</p>
            <div class="flex flex-wrap gap-2">
              <button type="submit" class="btn btn-danger" :disabled="delBusy || !delPassword">{{ delBusy ? 'Deleting…' : store.isOwner ? 'Delete account and household' : 'Delete my account' }}</button>
              <button type="button" class="btn btn-ghost" :disabled="delBusy" @click="delOpen = false">Cancel</button>
            </div>
          </form>
        </div>
      </div>
    </section>
  </div>
</template>
