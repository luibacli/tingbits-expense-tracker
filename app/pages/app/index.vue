<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Zap, ArrowRight, Repeat, Plus } from '@lucide/vue'
import type { Suggestion } from '#shared/utils/stats'

useSeoMeta({ title: 'Today' })

const store = useLedgerStore()
const { data } = store
const sheet = useEntrySheet()
const toast = useToast()
const route = useRoute()
const router = useRouter()

// Re-read "today" whenever the page is shown so an app left open overnight rolls over.
const today = ref(todayISO())
onMounted(() => {
  document.addEventListener('visibilitychange', () => { today.value = todayISO() })
  const add = route.query.add
  if (add === 'expense' || add === 'income') {
    sheet.add({ type: add })
    router.replace({ query: {} })
  }
})

const period = computed(() => periodFor(today.value, data.settings.periodStartDay))
const periodTx = computed(() => txInPeriod(data.transactions, period.value))
const budget = computed(() => effectiveBudget(data))
const pace = computed(() => (budget.value ? dailyPace(data.transactions, period.value, budget.value, today.value) : null))
const spent = computed(() => sumBy(periodTx.value, 'expense'))
const income = computed(() => sumBy(periodTx.value, 'income'))
const spentToday = computed(() => data.transactions.reduce((s, t) => s + (t.type === 'expense' && t.date === today.value ? t.amount : 0), 0))
const evenPace = computed(() => (budget.value ? Math.round(budget.value / period.value.days) : null))

const selectedDay = ref<string | null>(null)
const listDay = computed(() => selectedDay.value ?? today.value)
const dayItems = computed(() => data.transactions.filter((t) => t.date === listDay.value))

const quick = computed(() => frequentEntries(data.transactions, today.value, 8))
function quickAdd(s: Suggestion) {
  const tx = store.addTransaction({
    type: s.type, amount: s.amount, categoryId: s.categoryId, note: s.note, date: today.value,
    memberId: data.settings.defaultMemberId, methodId: data.settings.defaultMethodId, recurringId: null,
  })
  if (!tx) return
  toast.show(`${store.category(s.categoryId).emoji} ${s.note} ${store.money(s.amount)} added`, {
    label: 'Undo', run: () => store.deleteTransaction(tx.id),
  })
}

const due = computed(() => data.recurring
  .filter((r) => r.active && !r.auto && r.nextDate <= addDays(today.value, 3))
  .sort((a, b) => (a.nextDate < b.nextDate ? -1 : 1)))

function markPaid(id: string) {
  const paid = store.markRecurringPaid(id, today.value)
  if (paid) toast.show(`${store.money(paid.tx.amount)} recorded`, { label: 'Undo', run: () => store.undoPaid(id, paid.tx, paid.previousDue) })
}

// Motion signature: the headline figure settles on its new value after an entry.
const shownLeft = useTweenedNumber(() => pace.value?.leftToday ?? 0)
const shownSpent = useTweenedNumber(() => spentToday.value)

const usedRatio = computed(() => (pace.value ? Math.min(1, pace.value.spent / pace.value.budget) : 0))
const periodRatio = computed(() => (daysBetween(period.value.start, today.value) + 1) / period.value.days)
</script>

<template>
  <div class="space-y-5">
    <SetupCard v-if="!data.settings.setupDone" />

    <!-- Signature: what you can still spend today without breaking the month -->
    <section class="card p-5" aria-labelledby="today-heading" style="box-shadow: var(--shadow)">
      <template v-if="pace">
        <h1 id="today-heading" class="text-sm font-medium text-ink-2">
          {{ pace.leftToday >= 0 ? 'Safe to spend today' : 'Over today’s allowance' }}
        </h1>
        <p class="mt-1 text-5xl font-semibold tracking-tight" :class="pace.leftToday < 0 ? 'text-critical' : ''" data-testid="safe-to-spend">
          <span aria-hidden="true">{{ store.money(Math.abs(shownLeft)) }}</span>
          <span class="sr-only">{{ store.money(Math.abs(pace.leftToday)) }}</span>
        </p>
        <p class="mt-2 text-sm text-ink-2">
          <template v-if="pace.remaining >= 0">
            <span class="num font-semibold text-ink">{{ store.money(pace.remaining) }}</span> left of {{ store.money(pace.budget) }},
            {{ pace.daysLeft }} {{ pace.daysLeft === 1 ? 'day' : 'days' }} to go.
          </template>
          <template v-else>
            <span class="font-semibold text-critical">{{ store.money(-pace.remaining) }} over</span> the {{ store.money(pace.budget) }} budget for {{ formatPeriod(period) }}.
          </template>
          <template v-if="pace.spentToday"> Spent today <span class="num">{{ store.money(pace.spentToday) }}</span>.</template>
        </p>
        <div class="relative mt-4 h-2 rounded-full" style="background: var(--data-track)" role="meter" aria-label="Budget used" :aria-valuenow="Math.round(usedRatio * 100)" aria-valuemin="0" aria-valuemax="100" :aria-valuetext="`${Math.round(usedRatio * 100)}% of budget used, ${Math.round(periodRatio * 100)}% of the period gone`">
          <div class="meter-fill h-full w-full" :style="{ '--fill': `${usedRatio * 100}%`, background: pace.remaining < 0 ? 'var(--critical)' : 'var(--data)' }" />
          <div class="absolute -top-1 h-4 w-0.5 rounded bg-ink" :style="{ left: `calc(${periodRatio * 100}% - 1px)` }" aria-hidden="true" />
        </div>
        <p class="mt-2 flex justify-between text-xs text-muted">
          <span>{{ Math.round(usedRatio * 100) }}% used</span>
          <span>Projected {{ store.money(pace.projected, { compact: true }) }} by {{ formatShortDate(period.end) }}</span>
        </p>
      </template>
      <template v-else>
        <h1 id="today-heading" class="text-sm font-medium text-ink-2">Spent today</h1>
        <p class="mt-1 text-5xl font-semibold tracking-tight">
          <span aria-hidden="true">{{ store.money(shownSpent) }}</span>
          <span class="sr-only">{{ store.money(spentToday) }}</span>
        </p>
        <p class="mt-2 text-sm text-ink-2">
          {{ formatPeriod(period) }}: <span class="num font-semibold text-ink">{{ store.money(spent) }}</span> spent<template v-if="income">, <span class="num text-good">{{ store.money(income) }}</span> in</template>.
        </p>
        <NuxtLink to="/app/plan" class="mt-3 inline-flex min-h-10 items-center gap-1 text-sm font-semibold underline underline-offset-4">
          Set a monthly budget to get a daily allowance <ArrowRight :size="16" aria-hidden="true" />
        </NuxtLink>
      </template>
    </section>

    <section v-if="due.length" class="card divide-y divide-line" aria-labelledby="due-heading">
      <h2 id="due-heading" class="flex items-center gap-2 px-4 pb-2 pt-3 text-sm font-semibold"><Repeat :size="16" aria-hidden="true" /> Bills due</h2>
      <div v-for="r in due" :key="r.id" class="flex items-center gap-3 px-4 py-2.5">
        <span class="text-lg" aria-hidden="true">{{ store.category(r.categoryId).emoji }}</span>
        <div class="min-w-0 flex-1">
          <p class="truncate font-medium">{{ r.note || store.category(r.categoryId).name }}</p>
          <p class="text-xs" :class="r.nextDate < today ? 'font-semibold text-critical' : 'text-muted'">
            {{ r.nextDate < today ? 'Overdue since' : 'Due' }} {{ formatDay(r.nextDate, today) }} · <span class="num">{{ store.money(r.amount) }}</span>
          </p>
        </div>
        <button type="button" class="btn btn-ghost !min-h-10 !px-3 text-sm" @click="store.skipRecurring(r.id)">Skip</button>
        <button type="button" class="btn btn-primary !min-h-10 !px-3 text-sm" @click="markPaid(r.id)">Mark paid</button>
      </div>
    </section>

    <section v-if="quick.length" aria-labelledby="quick-heading">
      <h2 id="quick-heading" class="mb-2 flex items-center gap-1.5 text-sm font-semibold text-ink-2"><Zap :size="16" aria-hidden="true" /> One-tap add</h2>
      <div class="scroll-x -mx-4 flex gap-2 px-4 pb-1">
        <button v-for="s in quick" :key="s.type + s.categoryId + s.note" type="button" class="chip !min-h-11" @click="quickAdd(s)">
          <span aria-hidden="true">{{ store.category(s.categoryId).emoji }}</span>
          {{ s.note }}
          <span class="num text-muted">{{ store.money(s.amount) }}</span>
        </button>
      </div>
    </section>

    <section class="card p-4" aria-labelledby="strip-heading">
      <div class="mb-3 flex items-baseline justify-between">
        <h2 id="strip-heading" class="font-semibold">{{ formatPeriod(period) }}</h2>
        <span class="num text-sm text-ink-2">{{ store.money(spent) }} spent</span>
      </div>
      <DayStrip v-model:selected="selectedDay" :period="period" :pace="evenPace" :today="today" />
    </section>

    <section aria-labelledby="day-heading">
      <div class="mb-2 flex items-center justify-between">
        <h2 id="day-heading" class="font-semibold">{{ selectedDay ? formatDay(selectedDay, today) : 'Today' }}</h2>
        <div class="flex items-center gap-1">
          <button v-if="selectedDay" type="button" class="min-h-10 px-2 text-sm font-medium text-ink-2 underline underline-offset-4" @click="selectedDay = null">Back to today</button>
          <NuxtLink v-else to="/app/history" class="inline-flex min-h-10 items-center gap-1 px-2 text-sm font-medium text-ink-2">All entries <ArrowRight :size="16" aria-hidden="true" /></NuxtLink>
        </div>
      </div>
      <TxList :items="dayItems" :empty-text="listDay === today ? 'Nothing logged today.' : 'Nothing logged this day.'" />
      <button type="button" class="btn btn-ghost mt-3 w-full" @click="sheet.add({ date: listDay })">
        <Plus :size="18" aria-hidden="true" /> {{ listDay === today ? 'Add for today' : `Add for ${formatDay(listDay, today)}` }}
      </button>
    </section>
  </div>
</template>
