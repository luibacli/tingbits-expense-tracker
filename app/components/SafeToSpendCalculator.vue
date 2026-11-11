<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

/*
 * Landing-page signature: the app's core idea with the visitor's own numbers.
 * Server render and first client render use a fixed example (9 days to payday) so they match;
 * after mounting, the days are counted from the visitor's real date.
 */
const budgetText = ref('30,000')
const spentText = ref('18,400')
const payday = ref<15 | 30>(30)
const today = ref<Date | null>(null)
onMounted(() => { today.value = new Date() })

function daysUntil(day: number, from: Date): number {
  const t = new Date(from.getFullYear(), from.getMonth(), from.getDate(), 12)
  const lastDay = (y: number, m: number) => new Date(y, m + 1, 0).getDate()
  let p = new Date(t.getFullYear(), t.getMonth(), Math.min(day, lastDay(t.getFullYear(), t.getMonth())), 12)
  if (p <= t) p = new Date(t.getFullYear(), t.getMonth() + 1, Math.min(day, lastDay(t.getFullYear(), t.getMonth() + 1)), 12)
  return Math.max(1, Math.round((p.getTime() - t.getTime()) / 86_400_000))
}

const days = computed(() => (today.value ? daysUntil(payday.value, today.value) : 9))
const left = computed(() => (parseAmount(budgetText.value) ?? 0) - (parseAmount(spentText.value) ?? 0))
const perDay = computed(() => (left.value > 0 ? Math.floor(left.value / days.value) : 0))
// Fixed locale: the server and the browser must produce identical text.
const peso = (cents: number) => `₱${Math.round(cents / 100).toLocaleString('en-PH')}`
const barCount = computed(() => Math.min(days.value, 16))
// Bar height = today's allowance against an even pace (the budget spread over 30 days):
// spend faster and the days to payday visibly get thinner.
const fill = computed(() => {
  const budget = parseAmount(budgetText.value) ?? 0
  if (left.value <= 0 || budget <= 0) return 4
  return Math.max(6, Math.min(100, (perDay.value / (budget / 30)) * 100))
})
const shownPerDay = useTweenedNumber(() => perDay.value)
</script>

<template>
  <section class="calc rounded-2xl border border-line bg-surface p-5 pl-7" style="box-shadow: var(--shadow)" aria-labelledby="calc-title">
    <h2 id="calc-title" class="text-sm font-semibold text-ink-2">Try it with your numbers</h2>
    <form class="mt-3 grid gap-3 min-[420px]:grid-cols-2" @submit.prevent>
      <div class="min-[420px]:col-span-2">
        <label for="calc-budget" class="label">Budget until payday (₱)</label>
        <input id="calc-budget" v-model="budgetText" class="field num" inputmode="decimal" autocomplete="off">
      </div>
      <div>
        <label for="calc-spent" class="label">Spent so far (₱)</label>
        <input id="calc-spent" v-model="spentText" class="field num" inputmode="decimal" autocomplete="off">
      </div>
      <div>
        <label for="calc-payday" class="label">Next payday</label>
        <select id="calc-payday" v-model.number="payday" class="field">
          <option :value="15">15th (kinsenas)</option>
          <option :value="30">30th (katapusan)</option>
        </select>
      </div>
    </form>
    <div class="mt-5 border-t border-dashed border-line pt-4" aria-live="polite">
      <p class="text-sm text-ink-2">Safe to spend today</p>
      <p class="font-serif num text-5xl font-semibold" data-testid="calc-result">
        <span aria-hidden="true">{{ peso(shownPerDay) }}</span>
        <span class="sr-only">{{ peso(perDay) }}</span>
      </p>
      <p class="mt-1 text-sm text-ink-2">
        <template v-if="left > 0">{{ peso(left) }} left, {{ days }} {{ days === 1 ? 'day' : 'days' }} to payday.</template>
        <template v-else>Already over budget for this payday.</template>
      </p>
      <div class="mt-4 flex h-16 items-end gap-1" aria-hidden="true">
        <span
          v-for="i in barCount"
          :key="i"
          class="bar-fill block h-full flex-1"
          :style="{ '--fill': `${fill}%`, background: i === 1 ? 'var(--data)' : 'var(--data-track)', transitionDelay: `${(i - 1) * 25}ms` }"
        />
      </div>
    </div>
  </section>
</template>

<style scoped>
/* The notebook's red margin line. */
.calc { box-shadow: inset 2px 0 0 0 var(--margin), var(--shadow) !important; }
</style>
