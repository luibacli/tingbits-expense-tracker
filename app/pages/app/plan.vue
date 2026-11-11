<script setup lang="ts">
import { computed, ref } from 'vue'
import { Plus, Repeat, Zap, Pause } from '@lucide/vue'
import type { Recurring } from '#shared/types'

useSeoMeta({ title: 'Plan' })

const store = useLedgerStore()
const { data } = store

// Budgets: edit as text, store as cents on blur so typing "1,500" is never fought by re-formatting.
const overallText = ref(data.settings.monthlyBudget ? centsToInput(data.settings.monthlyBudget) : '')
function saveOverall() {
  data.settings.monthlyBudget = parseAmount(overallText.value)
  overallText.value = data.settings.monthlyBudget ? centsToInput(data.settings.monthlyBudget) : ''
}
const catTexts = ref<Record<string, string>>(Object.fromEntries(data.categories.map((c) => [c.id, c.budget ? centsToInput(c.budget) : ''])))
function saveCat(id: string) {
  const c = data.categories.find((x) => x.id === id)
  if (!c) return
  c.budget = parseAmount(catTexts.value[id] ?? '')
  catTexts.value[id] = c.budget ? centsToInput(c.budget) : ''
}
const expenseCats = computed(() => data.categories.filter((c) => c.kind === 'expense' && !c.archived))
const catSum = computed(() => expenseCats.value.reduce((s, c) => s + (c.budget ?? 0), 0))

const recurring = computed(() => [...data.recurring].sort((a, b) => (a.nextDate < b.nextDate ? -1 : 1)))
const monthlyCost = computed(() => data.recurring.filter((r) => r.active && r.type === 'expense').reduce((s, r) =>
  s + (r.frequency === 'monthly' ? r.amount : r.frequency === 'weekly' ? Math.round((r.amount * 52) / 12) : Math.round(r.amount / 12)), 0))

const sheetOpen = ref(false)
const editing = ref<Recurring | null>(null)
function openSheet(r: Recurring | null) { editing.value = r; sheetOpen.value = true }
const freqLabel = { weekly: 'weekly', monthly: 'monthly', yearly: 'yearly' } as const
</script>

<template>
  <div class="space-y-6">
    <h1 class="text-2xl font-semibold tracking-tight">Plan</h1>

    <section class="card p-4" aria-labelledby="budget-heading">
      <h2 id="budget-heading" class="font-semibold">Monthly budget</h2>
      <p class="mt-1 text-sm text-ink-2">Your daily "safe to spend" number comes from this. Leave it empty to use the total of the category budgets below.</p>
      <label for="overall-budget" class="sr-only">Monthly spending budget</label>
      <div class="mt-3 flex items-center gap-2">
        <span class="text-lg font-semibold text-muted" aria-hidden="true">{{ currencySymbol(data.settings.currency) }}</span>
        <input id="overall-budget" v-model="overallText" class="field num text-lg font-semibold" inputmode="decimal" autocomplete="off" :placeholder="catSum ? centsToInput(catSum) : 'e.g. 30000'" @blur="saveOverall" @keydown.enter="saveOverall">
      </div>

      <h3 class="mt-6 text-sm font-semibold text-ink-2">Per category <span class="font-normal text-muted">(optional)</span></h3>
      <ul class="mt-2 divide-y divide-line">
        <li v-for="c in expenseCats" :key="c.id" class="flex items-center gap-3 py-2">
          <label :for="`budget-${c.id}`" class="flex flex-1 items-center gap-2 text-sm">
            <span aria-hidden="true">{{ c.emoji }}</span> {{ c.name }}
          </label>
          <input :id="`budget-${c.id}`" v-model="catTexts[c.id]" class="field num !w-32 !py-1.5 text-right" inputmode="decimal" autocomplete="off" placeholder="No limit" @blur="saveCat(c.id)" @keydown.enter="saveCat(c.id)">
        </li>
      </ul>
      <p v-if="catSum" class="mt-2 text-right text-sm text-ink-2">Category budgets total <span class="num font-semibold text-ink">{{ store.money(catSum) }}</span></p>
    </section>

    <section aria-labelledby="rec-heading">
      <div class="mb-2 flex items-center justify-between">
        <h2 id="rec-heading" class="font-semibold">Recurring bills & income</h2>
        <button type="button" class="btn btn-ghost !min-h-10 text-sm" @click="openSheet(null)"><Plus :size="16" aria-hidden="true" /> Add</button>
      </div>
      <p v-if="monthlyCost" class="mb-2 text-sm text-ink-2">Fixed costs about <span class="num font-semibold text-ink">{{ store.money(monthlyCost) }}</span> a month.</p>
      <ul v-if="recurring.length" class="card divide-y divide-line overflow-hidden">
        <li v-for="r in recurring" :key="r.id">
          <button type="button" class="flex min-h-14 w-full items-center gap-3 px-3 py-2 text-left hover:bg-surface-2" :class="r.active ? '' : 'opacity-60'" @click="openSheet(r)">
            <span class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-lg" aria-hidden="true">{{ store.category(r.categoryId).emoji }}</span>
            <span class="min-w-0 flex-1">
              <span class="block truncate font-medium">{{ r.note }}</span>
              <span class="flex items-center gap-1 text-xs text-muted">
                <Zap v-if="r.auto" :size="12" aria-hidden="true" /><Repeat v-else :size="12" aria-hidden="true" />
                {{ r.auto ? 'Auto' : 'Reminder' }}, {{ freqLabel[r.frequency] }} · next {{ formatDay(r.nextDate) }}
                <template v-if="!r.active"><Pause :size="12" aria-hidden="true" /> paused</template>
              </span>
            </span>
            <span class="num shrink-0 font-semibold" :class="r.type === 'income' ? 'text-good' : ''">{{ store.money(r.amount, { sign: r.type === 'income' }) }}</span>
          </button>
        </li>
      </ul>
      <p v-else class="card p-4 text-sm text-ink-2">Add rent, utilities, subscriptions, tuition or salary once and they show up on time, every time.</p>
    </section>

    <RecurringSheet v-model="sheetOpen" :item="editing" />
  </div>
</template>
