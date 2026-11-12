<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Period } from '#shared/types'

/*
 * One bar per day of the budget period, single series in the data hue, with the even
 * daily pace as a dashed reference line. Tap a day to see its entries.
 * Hover/focus shows the day's value in the readout row above the plot (never color alone).
 *
 * Accessibility: 30 bars on a phone are about 9 px wide, below the WCAG 2.2 target size
 * (24 px). So the whole plot is one control (role="slider"): tap or click anywhere picks the
 * nearest day, arrow keys move between days, Escape goes back to today. Bars are decoration.
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

// Days that can be chosen: up to today.
const choosable = computed(() => days.value.filter((d) => d.date <= props.today))
const current = computed(() => selected.value ?? props.today)
const currentIndex = computed(() => Math.max(0, choosable.value.findIndex((d) => d.date === current.value)))
const currentDay = computed(() => choosable.value[currentIndex.value])
const valueText = computed(() => {
  const d = currentDay.value
  if (!d) return ''
  return `${formatDay(d.date, props.today)}: ${store.money(d.total)}${props.pace && d.total > props.pace ? ', above pace' : ''}`
})

const plot = ref<HTMLElement | null>(null)
function dayAt(clientX: number): string | null {
  const el = plot.value
  if (!el || !days.value.length) return null
  const r = el.getBoundingClientRect()
  const i = Math.min(days.value.length - 1, Math.max(0, Math.floor(((clientX - r.left) / r.width) * days.value.length)))
  const d = days.value[i]
  return d && d.date <= props.today ? d.date : null
}
function onPointerMove(e: PointerEvent) {
  if (e.pointerType === 'mouse') hovered.value = dayAt(e.clientX)
}
function onClick(e: MouseEvent) {
  const d = dayAt(e.clientX)
  if (d) pick(d)
}
function onKey(e: KeyboardEvent) {
  const last = choosable.value.length - 1
  const step: Record<string, number> = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1, PageDown: -7, PageUp: 7 }
  let i: number | null = null
  if (e.key in step) i = currentIndex.value + step[e.key]!
  else if (e.key === 'Home') i = 0
  else if (e.key === 'End') i = last
  else if (e.key === 'Escape' && selected.value) { selected.value = null; hovered.value = props.today; e.preventDefault(); return }
  if (i === null || last < 0) return
  e.preventDefault()
  const d = choosable.value[Math.min(last, Math.max(0, i))]
  if (!d) return
  selected.value = d.date === props.today ? null : d.date
  hovered.value = d.date
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

    <div
      ref="plot"
      class="relative mt-2 h-24 cursor-pointer touch-manipulation rounded-sm"
      role="slider"
      tabindex="0"
      aria-label="Day"
      :aria-describedby="`daystrip-summary-${period.start}`"
      aria-valuemin="1"
      :aria-valuemax="choosable.length"
      :aria-valuenow="currentIndex + 1"
      :aria-valuetext="valueText"
      @click="onClick"
      @pointermove="onPointerMove"
      @pointerleave="hovered = null"
      @focus="hovered = current"
      @blur="hovered = null"
      @keydown="onKey"
    >
      <span :id="`daystrip-summary-${period.start}`" class="sr-only">{{ summary }} Use the arrow keys to choose a day, Escape for today.</span>
      <!-- baseline -->
      <div class="absolute inset-x-0 bottom-0 border-t border-line-strong" aria-hidden="true" />
      <div
        v-if="pace"
        class="pointer-events-none absolute inset-x-0 z-10 border-t-2 border-dashed border-ink-2 opacity-60"
        :style="{ bottom: `${(pace / max) * 100}%` }"
        aria-hidden="true"
      />
      <div class="absolute inset-0 flex items-end gap-[2px]" aria-hidden="true">
        <span
          v-for="d in days"
          :key="d.date"
          class="relative flex h-full min-w-0 flex-1 items-end justify-center"
          :data-date="d.date"
        >
          <span v-if="d.total === 0 && d.date <= today" class="absolute bottom-0 left-1/2 h-[3px] w-full max-w-4 -translate-x-1/2 rounded-t-[2px] bg-line-strong" />
          <span
            v-if="d.date <= today"
            class="bar-fill relative block h-full w-full max-w-4"
            :class="(selected && selected !== d.date) || (hovered && hovered !== d.date) ? 'opacity-45' : ''"
            :style="{ '--fill': `${d.total > 0 ? Math.max(3, (d.total / max) * 100) : 0}%`, background: 'var(--data)' }"
          />
          <span v-if="d.date === today" class="absolute -bottom-2 size-1.5 translate-y-full rounded-full bg-ink" />
        </span>
      </div>
    </div>
    <figcaption class="mt-4 flex justify-between text-xs text-muted">
      <span>{{ formatShortDate(period.start) }}</span>
      <span>{{ formatShortDate(period.end) }}</span>
    </figcaption>
  </figure>
</template>
