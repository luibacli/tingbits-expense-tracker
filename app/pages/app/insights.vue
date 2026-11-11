<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { TrendingDown, TrendingUp } from '@lucide/vue'

useSeoMeta({ title: 'Insights' })

const store = useLedgerStore()
const { data } = store
const offset = ref(0)
const today = todayISO()

const period = computed(() => periodFor(today, data.settings.periodStartDay, offset.value))
const prev = computed(() => periodFor(today, data.settings.periodStartDay, offset.value - 1))
const txs = computed(() => txInPeriod(data.transactions, period.value))
const spent = computed(() => sumBy(txs.value, 'expense'))
const income = computed(() => sumBy(txs.value, 'income'))
const isCurrent = computed(() => offset.value === 0)
// The trend chart shows six periods ending at the selected one; make sure they are loaded.
watch(offset, (o) => store.ensureFrom(periodFor(today, data.settings.periodStartDay, o - 6).start), { immediate: true })

// Fair comparison: for the running period, compare against the same number of days of the previous one.
const elapsed = computed(() => (isCurrent.value ? daysBetween(period.value.start, today) + 1 : period.value.days))
const prevSameSpan = computed(() => {
  const end = addDays(prev.value.start, Math.min(elapsed.value, prev.value.days) - 1)
  return sumBy(txInPeriod(data.transactions, { start: prev.value.start, end, days: elapsed.value }), 'expense')
})
const delta = computed(() => (prevSameSpan.value ? (spent.value - prevSameSpan.value) / prevSameSpan.value : null))
const dailyAvg = computed(() => Math.round(spent.value / Math.max(1, elapsed.value)))
const savedRate = computed(() => (income.value ? (income.value - spent.value) / income.value : null))

const byMember = computed(() => totalsByKey(txs.value, (t) => t.memberId).map((r) => ({ ...r, name: store.memberMap.get(r.id)?.name ?? 'Unassigned' })))
const byMethod = computed(() => totalsByKey(txs.value, (t) => t.methodId).map((r) => ({ ...r, name: store.methodMap.get(r.id)?.name ?? 'Not set' })))
const topNotes = computed(() => totalsByKey(txs.value.filter((t) => t.note.trim()), (t) => t.note.trim().toLowerCase())
  .slice(0, 5)
  .map((r) => {
    const sample = txs.value.find((t) => t.note.trim().toLowerCase() === r.id)!
    const count = txs.value.filter((t) => t.type === 'expense' && t.note.trim().toLowerCase() === r.id).length
    return { ...r, note: sample.note.trim(), emoji: store.category(sample.categoryId).emoji, count }
  }))
const pct = (n: number) => `${Math.round(Math.abs(n) * 100)}%`
</script>

<template>
  <div class="space-y-5">
    <h1 class="sr-only">Insights</h1>
    <PeriodNav v-model="offset" />

    <dl class="grid grid-cols-2 gap-3">
      <div class="card p-4">
        <dt class="text-sm text-ink-2">Spent</dt>
        <dd class="mt-1 text-2xl font-semibold">{{ store.money(spent, { compact: true }) }}</dd>
        <dd v-if="delta !== null" class="mt-1 flex items-center gap-1 text-xs" :class="delta > 0 ? 'text-critical' : 'text-good'">
          <component :is="delta > 0 ? TrendingUp : TrendingDown" :size="14" aria-hidden="true" />
          {{ pct(delta) }} {{ delta > 0 ? 'more' : 'less' }} than {{ isCurrent ? 'this point last period' : 'previous period' }}
        </dd>
      </div>
      <div class="card p-4">
        <dt class="text-sm text-ink-2">Income</dt>
        <dd class="mt-1 text-2xl font-semibold">{{ store.money(income, { compact: true }) }}</dd>
        <dd v-if="savedRate !== null" class="mt-1 text-xs text-ink-2">
          {{ savedRate >= 0 ? `Kept ${pct(savedRate)} of it` : `Spent ${pct(savedRate)} more than came in` }}
        </dd>
      </div>
      <div class="card p-4">
        <dt class="text-sm text-ink-2">Daily average</dt>
        <dd class="mt-1 text-2xl font-semibold">{{ store.money(dailyAvg, { compact: true }) }}</dd>
        <dd class="mt-1 text-xs text-ink-2">over {{ elapsed }} {{ elapsed === 1 ? 'day' : 'days' }}</dd>
      </div>
      <div class="card p-4">
        <dt class="text-sm text-ink-2">Entries</dt>
        <dd class="mt-1 text-2xl font-semibold">{{ txs.length }}</dd>
        <dd class="mt-1 text-xs text-ink-2">{{ txs.filter((t) => t.type === 'expense').length }} expenses</dd>
      </div>
    </dl>

    <section class="card p-4" aria-labelledby="cat-heading">
      <h2 id="cat-heading" class="mb-4 font-semibold">By category</h2>
      <CategoryBars :items="txs" show-budgets />
    </section>

    <section class="card p-4" aria-labelledby="trend-heading">
      <h2 id="trend-heading" class="mb-2 font-semibold">Last 6 periods</h2>
      <TrendBars :offset="offset" @pick="offset = $event" />
    </section>

    <div class="grid gap-5 sm:grid-cols-2">
      <section v-if="data.members.length > 1" class="card p-4" aria-labelledby="who-heading">
        <h2 id="who-heading" class="mb-3 font-semibold">Who paid</h2>
        <ul class="space-y-2 text-sm">
          <li v-for="m in byMember" :key="m.id" class="flex justify-between gap-2">
            <span>{{ m.name }}</span>
            <span class="num"><span class="font-semibold">{{ store.money(m.total) }}</span> <span class="text-muted">· {{ spent ? Math.round((m.total / spent) * 100) : 0 }}%</span></span>
          </li>
        </ul>
        <p v-if="!byMember.length" class="text-sm text-muted">No spending yet.</p>
      </section>

      <section class="card p-4" aria-labelledby="method-heading">
        <h2 id="method-heading" class="mb-3 font-semibold">How you paid</h2>
        <ul class="space-y-2 text-sm">
          <li v-for="m in byMethod" :key="m.id" class="flex justify-between gap-2">
            <span>{{ m.name }}</span>
            <span class="num font-semibold">{{ store.money(m.total) }}</span>
          </li>
        </ul>
        <p v-if="!byMethod.length" class="text-sm text-muted">No spending yet.</p>
      </section>

      <section class="card p-4" aria-labelledby="top-heading">
        <h2 id="top-heading" class="mb-3 font-semibold">Biggest items</h2>
        <ol class="space-y-2 text-sm">
          <li v-for="n in topNotes" :key="n.id" class="flex justify-between gap-2">
            <span class="min-w-0 truncate"><span aria-hidden="true">{{ n.emoji }}</span> {{ n.note }} <span v-if="n.count > 1" class="text-muted">×{{ n.count }}</span></span>
            <span class="num shrink-0 font-semibold">{{ store.money(n.total) }}</span>
          </li>
        </ol>
        <p v-if="!topNotes.length" class="text-sm text-muted">Add notes to entries to see where money goes.</p>
      </section>
    </div>
  </div>
</template>
