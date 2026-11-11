<script setup lang="ts">
import { computed, ref } from 'vue'

/* Spending per budget period for the last N periods. Single series; the selected period is full strength. */
const props = defineProps<{ offset: number, count?: number }>()
const emit = defineEmits<{ pick: [offset: number] }>()
const store = useLedgerStore()

const bars = computed(() => {
  const n = props.count ?? 6
  const today = todayISO()
  const out = []
  for (let i = n - 1; i >= 0; i--) {
    const off = props.offset - i
    const p = periodFor(today, store.data.settings.periodStartDay, off)
    out.push({ off, p, total: sumBy(txInPeriod(store.data.transactions, p), 'expense') })
  }
  return out
})
const max = computed(() => Math.max(1, ...bars.value.map((b) => b.total)) * 1.1)
const avg = computed(() => {
  const done = bars.value.filter((b) => b.off < 0 && b.total > 0)
  return done.length ? done.reduce((s, b) => s + b.total, 0) / done.length : null
})
const hovered = ref<number | null>(null)
const focusBar = computed(() => bars.value.find((b) => b.off === (hovered.value ?? props.offset)))
</script>

<template>
  <figure class="m-0">
    <div class="flex min-h-6 items-baseline justify-between text-sm" aria-live="polite">
      <span class="font-medium">{{ focusBar ? formatPeriod(focusBar.p) : '' }}</span>
      <span class="num font-semibold">{{ focusBar ? store.money(focusBar.total) : '' }}</span>
    </div>
    <div class="relative mt-2 h-32">
      <div class="absolute inset-x-0 bottom-0 border-t border-line-strong" aria-hidden="true" />
      <div v-if="avg" class="pointer-events-none absolute inset-x-0 z-10 border-t-2 border-dashed border-ink-2 opacity-60" :style="{ bottom: `${(avg / max) * 100}%` }" aria-hidden="true" />
      <div class="absolute inset-0 flex items-end gap-2">
        <button
          v-for="b in bars"
          :key="b.off"
          type="button"
          class="flex h-full flex-1 items-end justify-center"
          :aria-label="`${formatPeriod(b.p)}: ${store.money(b.total)}`"
          :aria-pressed="b.off === offset"
          @mouseenter="hovered = b.off"
          @mouseleave="hovered = null"
          @focus="hovered = b.off"
          @blur="hovered = null"
          @click="emit('pick', b.off)"
        >
          <span
            class="bar-fill block h-full w-full max-w-12"
            :style="{ '--fill': `${Math.max(b.total ? 2 : 0, (b.total / max) * 100)}%`, background: b.off === offset ? 'var(--data)' : 'var(--data-soft)' }"
          />
        </button>
      </div>
    </div>
    <div class="mt-1.5 flex gap-2 text-center text-xs text-muted">
      <span v-for="b in bars" :key="b.off" class="flex-1" :class="b.off === offset ? 'font-semibold text-ink' : ''">{{ formatPeriodShort(b.p) }}</span>
    </div>
    <figcaption v-if="avg" class="mt-2 flex items-center gap-1.5 text-xs text-muted">
      <span class="inline-block w-4 border-t-2 border-dashed border-ink-2" aria-hidden="true" />
      Average of completed periods <span class="num">{{ store.money(Math.round(avg)) }}</span>
    </figcaption>
  </figure>
</template>
