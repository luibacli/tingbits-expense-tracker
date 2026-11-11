<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { Trash2, Repeat } from '@lucide/vue'
import type { TxType } from '#shared/types'
import type { Suggestion } from '#shared/utils/stats'

const store = useLedgerStore()
const { data } = store
const sheet = useEntrySheet()
const toast = useToast()

const type = ref<TxType>('expense')
const amountText = ref('')
const note = ref('')
const categoryId = ref<string | null>(null)
const date = ref(todayISO())
const memberId = ref<string | null>(null)
const methodId = ref<string | null>(null)
const showErrors = ref(false)
const noteFocused = ref(false)
const amountEl = ref<HTMLInputElement | null>(null)

const isEdit = computed(() => !!sheet.editing.value)
const addedBy = computed(() => {
  const by = sheet.editing.value?.createdBy
  return by ? store.accountMap.get(by)?.name ?? null : null
})
const title = computed(() => (isEdit.value ? 'Edit entry' : type.value === 'expense' ? 'Add expense' : 'Add income'))

const today = computed(() => todayISO())
const yesterday = computed(() => addDays(today.value, -1))
const amount = computed(() => parseAmount(amountText.value))
const isSum = computed(() => /\d\s*[+\-]\s*\d/.test(amountText.value))
const categories = computed(() => data.categories.filter((c) => c.kind === type.value && (!c.archived || c.id === categoryId.value)))
const quickPicks = computed(() => frequentEntries(data.transactions, today.value, 6).filter((s) => s.type === type.value))
const matches = computed(() => (noteFocused.value ? noteMatches(data.transactions.filter((t) => t.type === type.value), note.value) : [])
  .filter((m) => m.note.toLowerCase() !== note.value.trim().toLowerCase() || m.categoryId !== categoryId.value))

const amountError = computed(() => (showErrors.value && !amount.value ? 'Enter an amount above zero.' : ''))
const categoryError = computed(() => (showErrors.value && !categoryId.value ? 'Pick a category.' : ''))

watch(sheet.open, (open) => {
  if (!open) return
  // Read-only household: don't let anyone fill in a form that can't be saved.
  if (!sheet.editing.value && !store.canWrite) {
    sheet.close()
    toast.show(store.readOnlyMessage)
    return
  }
  const tx = sheet.editing.value
  showErrors.value = false
  if (tx) {
    type.value = tx.type
    amountText.value = centsToInput(tx.amount)
    note.value = tx.note
    categoryId.value = tx.categoryId
    date.value = tx.date
    memberId.value = tx.memberId
    methodId.value = tx.methodId
  } else {
    type.value = sheet.preset.value?.type ?? 'expense'
    date.value = sheet.preset.value?.date ?? todayISO()
    reset()
  }
  nextTick(() => amountEl.value?.focus())
})

function reset() {
  amountText.value = ''
  note.value = ''
  categoryId.value = null
  memberId.value = data.settings.defaultMemberId && store.memberMap.has(data.settings.defaultMemberId) ? data.settings.defaultMemberId : data.members[0]?.id ?? null
  methodId.value = data.settings.defaultMethodId && store.methodMap.has(data.settings.defaultMethodId) ? data.settings.defaultMethodId : null
  showErrors.value = false
}

function setType(t: TxType) {
  if (t === type.value) return
  type.value = t
  if (categoryId.value && store.category(categoryId.value).kind !== t) categoryId.value = null
}

function applySuggestion(s: Suggestion, alsoAmount: boolean) {
  note.value = s.note
  categoryId.value = s.categoryId
  if (alsoAmount || !amount.value) amountText.value = centsToInput(s.amount)
  noteFocused.value = false
}

function save(again: boolean) {
  showErrors.value = true
  if (!amount.value || !categoryId.value) {
    nextTick(() => (document.querySelector('[aria-invalid="true"]') as HTMLElement | null)?.focus())
    return
  }
  const input = {
    type: type.value,
    amount: amount.value,
    categoryId: categoryId.value,
    note: note.value.trim(),
    date: date.value || todayISO(),
    memberId: memberId.value,
    methodId: methodId.value,
  }
  const cat = store.category(input.categoryId)
  if (sheet.editing.value) {
    store.updateTransaction(sheet.editing.value.id, input)
    toast.show('Entry updated')
    sheet.close()
    return
  }
  const tx = store.addTransaction({ ...input, recurringId: null })
  if (!tx) { sheet.close(); return } // read-only household: the store already explained why
  toast.show(`${cat.emoji} ${store.money(tx.amount)} saved`, {
    label: 'Undo',
    run: () => store.deleteTransaction(tx.id),
  })
  if (again) {
    const keepDate = date.value
    reset()
    date.value = keepDate
    nextTick(() => amountEl.value?.focus())
  } else {
    sheet.close()
  }
}

function remove() {
  const tx = sheet.editing.value
  if (!tx) return
  const removed = store.deleteTransaction(tx.id)
  sheet.close()
  if (removed) toast.show('Entry deleted', { label: 'Undo', run: () => store.restoreTransaction(removed) })
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); save(true) }
}
</script>

<template>
  <BaseSheet v-model="sheet.open.value" :title="title">
    <form class="space-y-5 px-4 pb-4 pt-4" novalidate @submit.prevent="save(false)" @keydown="onKeydown">
      <div class="grid grid-cols-2 rounded-xl bg-surface-2 p-1" role="group" aria-label="Entry type">
        <button
          v-for="t in (['expense', 'income'] as const)"
          :key="t"
          type="button"
          class="min-h-10 rounded-lg text-sm font-semibold capitalize"
          :class="type === t ? 'bg-surface text-ink shadow-sm' : 'text-ink-2'"
          :aria-pressed="type === t"
          @click="setType(t)"
        >
          {{ t }}
        </button>
      </div>

      <div>
        <label for="entry-amount" class="label">Amount</label>
        <div class="flex items-center gap-2 rounded-xl border bg-surface px-3 focus-within:outline-3 focus-within:outline-offset-2 focus-within:outline-[var(--focus)]" :class="amountError ? 'border-critical' : 'border-line-strong'">
          <span class="text-2xl font-semibold text-muted" aria-hidden="true">{{ currencySymbol(data.settings.currency) }}</span>
          <input
            id="entry-amount"
            ref="amountEl"
            autofocus
            v-model="amountText"
            class="num min-w-0 flex-1 bg-transparent py-3 text-3xl font-semibold outline-none focus-visible:outline-none"
            inputmode="decimal"
            autocomplete="off"
            enterkeyhint="done"
            placeholder="0"
            :aria-invalid="!!amountError"
            :aria-describedby="amountError ? 'entry-amount-error' : 'entry-amount-hint'"
          >
        </div>
        <p v-if="amountError" id="entry-amount-error" class="mt-1 text-sm text-critical">{{ amountError }}</p>
        <p v-else id="entry-amount-hint" class="mt-1 text-sm text-muted">
          <template v-if="isSum && amount">Total <strong class="num text-ink">{{ store.money(amount) }}</strong></template>
          <template v-else>Add up a receipt with +, like 120+45</template>
        </p>
      </div>

      <div v-if="!isEdit && quickPicks.length">
        <p class="label">Again?</p>
        <div class="scroll-x -mx-4 flex gap-2 px-4">
          <button v-for="s in quickPicks" :key="s.note + s.categoryId" type="button" class="chip" @click="applySuggestion(s, true)">
            <span aria-hidden="true">{{ store.category(s.categoryId).emoji }}</span>
            {{ s.note }}
            <span class="num text-muted">{{ store.money(s.amount) }}</span>
          </button>
        </div>
      </div>

      <div class="relative">
        <label for="entry-note" class="label">What for? <span class="font-normal text-muted">(optional)</span></label>
        <input
          id="entry-note"
          v-model="note"
          class="field"
          autocomplete="off"
          maxlength="200"
          placeholder="Lunch, jeepney, Meralco…"
          role="combobox"
          aria-autocomplete="list"
          :aria-expanded="matches.length > 0"
          aria-controls="entry-note-list"
          @focus="noteFocused = true"
          @blur="noteFocused = false"
        >
        <ul
          v-show="matches.length"
          id="entry-note-list"
          role="listbox"
          class="absolute inset-x-0 top-full z-10 mt-1 overflow-hidden rounded-xl border border-line bg-surface"
          style="box-shadow: var(--shadow)"
        >
          <li v-for="m in matches" :key="m.note + m.categoryId" role="option" :aria-selected="false">
            <button
              type="button"
              class="flex min-h-11 w-full items-center gap-3 px-3 text-left hover:bg-surface-2"
              @mousedown.prevent="applySuggestion(m, false)"
            >
              <span aria-hidden="true">{{ store.category(m.categoryId).emoji }}</span>
              <span class="flex-1 truncate">{{ m.note }}</span>
              <span class="num text-sm text-muted">{{ store.money(m.amount) }}</span>
            </button>
          </li>
        </ul>
      </div>

      <fieldset>
        <legend class="label">Category</legend>
        <div class="grid grid-cols-3 gap-2 sm:grid-cols-4" :aria-describedby="categoryError ? 'entry-cat-error' : undefined">
          <button
            v-for="c in categories"
            :key="c.id"
            type="button"
            class="flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl border px-1 py-2 text-xs leading-tight"
            :class="categoryId === c.id ? 'border-primary bg-primary text-on-primary' : 'border-line bg-surface text-ink'"
            :aria-pressed="categoryId === c.id"
            :aria-invalid="!!categoryError && c === categories[0]"
            @click="categoryId = c.id"
          >
            <span class="text-xl" aria-hidden="true">{{ c.emoji }}</span>
            <span class="line-clamp-2 text-center">{{ c.name }}</span>
          </button>
        </div>
        <p v-if="categoryError" id="entry-cat-error" class="mt-1 text-sm text-critical">{{ categoryError }}</p>
      </fieldset>

      <fieldset>
        <legend class="label">Date</legend>
        <div class="flex flex-wrap items-center gap-2">
          <button type="button" class="chip" :aria-pressed="date === today" @click="date = today">Today</button>
          <button type="button" class="chip" :aria-pressed="date === yesterday" @click="date = yesterday">Yesterday</button>
          <label class="sr-only" for="entry-date">Pick a date</label>
          <input id="entry-date" v-model="date" type="date" class="field !w-auto !py-1.5" :max="addDays(today, 366)">
        </div>
      </fieldset>

      <fieldset v-if="data.members.length > 1">
        <legend class="label">{{ type === 'expense' ? 'Paid by' : 'Received by' }}</legend>
        <div class="flex flex-wrap gap-2">
          <button v-for="m in data.members" :key="m.id" type="button" class="chip" :aria-pressed="memberId === m.id" @click="memberId = m.id">
            {{ m.name }}
          </button>
        </div>
      </fieldset>

      <fieldset v-if="data.methods.length">
        <legend class="label">Method</legend>
        <div class="flex flex-wrap gap-2">
          <button v-for="m in data.methods" :key="m.id" type="button" class="chip" :aria-pressed="methodId === m.id" @click="methodId = methodId === m.id ? null : m.id">
            {{ m.name }}
          </button>
        </div>
      </fieldset>

      <p v-if="addedBy" class="text-sm text-muted">Added by {{ addedBy }}</p>
      <p v-if="sheet.editing.value?.recurringId" class="flex items-center gap-2 text-sm text-muted">
        <Repeat :size="16" aria-hidden="true" /> Posted by a recurring item. Editing changes this entry only.
      </p>

      <div class="sticky bottom-0 -mx-4 flex gap-2 border-t border-line bg-surface px-4 pt-3">
        <button v-if="isEdit" type="button" class="btn btn-danger" @click="remove">
          <Trash2 :size="18" aria-hidden="true" /> Delete
        </button>
        <button v-else type="button" class="btn btn-ghost" @click="save(true)">Save & add another</button>
        <button type="submit" class="btn btn-primary flex-1">{{ isEdit ? 'Save changes' : 'Save' }}</button>
      </div>
    </form>
  </BaseSheet>
</template>
