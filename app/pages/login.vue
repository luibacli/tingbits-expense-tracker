<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { Wallet } from '@lucide/vue'

definePageMeta({ layout: false })
useSeoMeta({ title: 'Sign in' })

type Mode = 'signin' | 'create' | 'join'

const store = useLedgerStore()
const route = useRoute()

const mode = ref<Mode>(typeof route.query.invite === 'string' ? 'join' : route.query.mode === 'create' ? 'create' : 'signin')
const name = ref('')
const email = ref('')
const password = ref('')
const householdName = ref('')
const inviteCode = ref(typeof route.query.invite === 'string' ? route.query.invite : '')
const busy = ref(false)
const formError = ref('')
const fields = ref<Record<string, string>>({})

watch(mode, () => { formError.value = ''; fields.value = {} })

const deletedNotice = route.query.deleted === 'household'
  ? 'Your account and household were deleted.'
  : route.query.deleted === 'account' ? 'Your account was deleted.' : ''

const title = computed(() => ({ signin: 'Sign in', create: 'Create a household', join: 'Join a household' })[mode.value])
const submitLabel = computed(() => ({ signin: 'Sign in', create: 'Create household', join: 'Join household' })[mode.value])

// Only same-site paths are allowed as a redirect target.
function nextPath() {
  const n = route.query.next
  return typeof n === 'string' && n.startsWith('/app') && !n.startsWith('//') ? n : '/app'
}

function clientCheck(): boolean {
  const f: Record<string, string> = {}
  if (mode.value !== 'signin' && !name.value.trim()) f.name = 'Enter your name.'
  if (!/^\S+@\S+\.\S+$/.test(email.value.trim())) f.email = 'Enter a valid email address.'
  if (mode.value === 'signin' ? !password.value : password.value.length < 8) f.password = mode.value === 'signin' ? 'Enter your password.' : 'Use at least 8 characters.'
  if (mode.value === 'join' && !inviteCode.value.trim()) f.inviteCode = 'Enter the invite code from your household.'
  fields.value = f
  return !Object.keys(f).length
}

async function submit() {
  formError.value = ''
  if (!clientCheck()) return focusFirstError()
  busy.value = true
  try {
    if (mode.value === 'signin') await store.login(email.value.trim(), password.value)
    else await store.register({
      name: name.value.trim(),
      email: email.value.trim(),
      password: password.value,
      householdName: mode.value === 'create' ? householdName.value.trim() || null : null,
      inviteCode: mode.value === 'join' ? inviteCode.value.trim() : null,
    })
    if (store.status === 'ready') await navigateTo(nextPath(), { replace: true })
    else formError.value = 'Signed in, but the household could not be loaded. Check your connection and try again.'
  } catch (err) {
    const f = toApiFailure(err)
    fields.value = f.fields
    formError.value = f.message
    focusFirstError()
  } finally {
    busy.value = false
  }
}

function focusFirstError() {
  nextTick(() => (document.querySelector('[aria-invalid="true"]') as HTMLElement | null)?.focus())
}
</script>

<template>
  <div class="flex min-h-dvh items-start justify-center px-4 py-10 sm:items-center">
    <main class="w-full max-w-sm">
      <p class="mb-6 flex items-center gap-2 text-lg font-semibold"><Wallet :size="22" aria-hidden="true" /> Tingbits Expense Tracker</p>
      <p v-if="deletedNotice" class="mb-4 rounded-xl border border-line-strong p-3 text-sm" role="status" data-testid="deleted-notice">{{ deletedNotice }}</p>
      <div class="card p-5" style="box-shadow: var(--shadow)">
        <div class="grid grid-cols-3 rounded-xl bg-surface-2 p-1 text-sm" role="group" aria-label="Choose">
          <button v-for="m in (['signin', 'create', 'join'] as const)" :key="m" type="button" class="min-h-10 rounded-lg font-semibold" :class="mode === m ? 'bg-surface text-ink shadow-sm' : 'text-ink-2'" :aria-pressed="mode === m" @click="mode = m">
            {{ m === 'signin' ? 'Sign in' : m === 'create' ? 'New' : 'Join' }}
          </button>
        </div>

        <h1 class="mt-5 text-xl font-semibold">{{ title }}</h1>
        <p class="mt-1 text-sm text-ink-2">
          <template v-if="mode === 'signin'">Welcome back.</template>
          <template v-else-if="mode === 'create'">Start a shared ledger. Invite your partner or family after.</template>
          <template v-else>Use the invite code from Settings on the household owner's phone.</template>
        </p>

        <p v-if="formError" class="mt-4 rounded-lg border border-line-strong p-3 text-sm text-critical" role="alert">{{ formError }}</p>

        <form class="mt-4 space-y-4" novalidate @submit.prevent="submit">
          <div v-if="mode === 'join'">
            <label for="f-invite" class="label">Invite code</label>
            <input id="f-invite" v-model="inviteCode" class="field uppercase tracking-widest" autocomplete="off" autocapitalize="characters" maxlength="12" :aria-invalid="!!fields.inviteCode" :aria-describedby="fields.inviteCode ? 'f-invite-err' : undefined">
            <p v-if="fields.inviteCode" id="f-invite-err" class="mt-1 text-sm text-critical">{{ fields.inviteCode }}</p>
          </div>
          <div v-if="mode !== 'signin'">
            <label for="f-name" class="label">Your name</label>
            <input id="f-name" v-model="name" class="field" autocomplete="given-name" maxlength="60" :aria-invalid="!!fields.name" :aria-describedby="fields.name ? 'f-name-err' : undefined">
            <p v-if="fields.name" id="f-name-err" class="mt-1 text-sm text-critical">{{ fields.name }}</p>
          </div>
          <div v-if="mode === 'create'">
            <label for="f-household" class="label">Household name <span class="font-normal text-muted">(optional)</span></label>
            <input id="f-household" v-model="householdName" class="field" maxlength="60" placeholder="Dela Cruz family">
          </div>
          <div>
            <label for="f-email" class="label">Email</label>
            <input id="f-email" v-model="email" type="email" class="field" autocomplete="email" inputmode="email" :aria-invalid="!!fields.email" :aria-describedby="fields.email ? 'f-email-err' : undefined">
            <p v-if="fields.email" id="f-email-err" class="mt-1 text-sm text-critical">{{ fields.email }}</p>
          </div>
          <div>
            <label for="f-password" class="label">Password</label>
            <input id="f-password" v-model="password" type="password" class="field" :autocomplete="mode === 'signin' ? 'current-password' : 'new-password'" :aria-invalid="!!fields.password" :aria-describedby="fields.password ? 'f-password-err' : (mode !== 'signin' ? 'f-password-hint' : undefined)">
            <p v-if="fields.password" id="f-password-err" class="mt-1 text-sm text-critical">{{ fields.password }}</p>
            <p v-else-if="mode !== 'signin'" id="f-password-hint" class="mt-1 text-sm text-muted">At least 8 characters.</p>
          </div>
          <button type="submit" class="btn btn-primary w-full" :disabled="busy">{{ busy ? 'Please wait…' : submitLabel }}</button>
        </form>
      </div>
      <p class="mt-4 text-center text-xs text-muted">Your household's data is private to its members.</p>
    </main>
  </div>
</template>
