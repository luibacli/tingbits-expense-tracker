<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Period } from '#shared/types'

/*
 * One bar per day of the budget period, single series in the data hue, with the even
 * daily pace as a dashed reference line. Tap a day to see its entries.
 * Hover/focus shows the day's value in the readout row above the plot (never color alone).
 */
const props = defineProps<{ period: Period, pace: number | null, today: string }>()
const selected = defineModel<string | null>('selected', { default: null })
const store = useLedgerStore()

const days = computed(() => dailyTotals(store.data.transactions, props.period))
const max = computed(() => Math.max(1, props.pace ?? 0, ...days.value.map((d) => d.total)) * 1.08)
const hovered = ref<string | null>(null)
const focus = computed(() => hovered.value ?? selected.value)
const focusDay = computed(() => days.value.find((d) => d.date === focus.value))

const summary = computed(() => {
  const spentDays = days.value.filter((d) => d.total > 0).length
  return `Daily spending for ${formatPeriod(props.period)}. ${spentDays} days with spending.`
    + (props.pace ? ` Even daily pace ${store.money(props.pace)}.` : '')
})

function pick(date: string) {
  selected.value = selected.value === date ? null : date
}
</script>

<template>
  <figure class="m-0">
    <div class="flex min-h-6 items-baseline justify-between gap-2 text-sm" aria-live="polite">
      <template v-if="focusDay">
        <span class="font-medium">{{ formatDay(focusDay.date, today) }}</span>
        <span class="num font-semibold">{{ store.money(focusDay.total) }}
          <span v-if="pace && focusDay.total > pace" class="font-normal text-muted">, above pace</span>
        </span>
      </template>
      <template v-else>
        <span class="text-muted">Daily spending</span>
        <span v-if="pace" class="flex items-center gap-1.5 text-muted">
          <span class="inline-block w-4 border-t-2 border-dashed border-ink-2" aria-hidden="true" />
          even pace <span class="num">{{ store.money(pace) }}</span>
        </span>
      </template>
    </div>

    <div class="relative mt-2 h-24" role="group" :aria-label="summary">
      <!-- baseline -->
      <div class="absolute inset-x-0 bottom-0 border-t border-line-strong" aria-hidden="true" />
      <div
        v-if="pace"
        class="pointer-events-none absolute inset-x-0 z-10 border-t-2 border-dashed border-ink-2 opacity-60"
        :style="{ bottom: `${(pace / max) * 100}%` }"
        aria-hidden="true"
      />
      <div class="absolute inset-0 flex items-end gap-[2px]">
        <button
          v-for="d in days"
          :key="d.date"
          type="button"
          class="group relative flex h-full min-w-0 flex-1 items-end justify-center"
          :aria-label="`${formatDay(d.date, today)}: ${store.money(d.total)}`"
          :aria-pressed="selected === d.date"
          :disabled="d.date > today"
          @mouseenter="hovered = d.date"
          @mouseleave="hovered = null"
          @focus="hovered = d.date"
          @blur="hovered = null"
          @click="pick(d.date)"
        >
          <span v-if="d.total === 0 && d.date <= today" class="absolute bottom-0 left-1/2 h-[3px] w-full max-w-4 -translate-x-1/2 rounded-t-[2px] bg-line-strong" />
          <span
            v-if="d.date <= today"
            class="bar-fill relative block h-full w-full max-w-4"
            :class="(selected && selected !== d.date) || (hovered && hovered !== d.date) ? 'opacity-45' : ''"
            :style="{ '--fill': `${d.total > 0 ? Math.max(3, (d.total / max) * 100) : 0}%`, background: 'var(--data)' }"
          />
          <span v-if="d.date === today" class="absolute -bottom-2 size-1.5 translate-y-full rounded-full bg-ink" aria-hidden="true" />
        </button>
      </div>
    </div>
    <figcaption class="mt-4 flex justify-between text-xs text-muted">
      <span>{{ formatShortDate(period.start) }}</span>
      <span>{{ formatShortDate(period.end) }}</span>
    </figcaption>
  </figure>
</template>
