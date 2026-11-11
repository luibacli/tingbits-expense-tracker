<script setup lang="ts">
import { computed } from 'vue'
import { CircleAlert, TriangleAlert } from '@lucide/vue'
import type { Transaction } from '#shared/types'

/*
 * Spending per category as labelled horizontal bars (one hue; identity comes from the label).
 * With a budget the bar is a meter against that budget; status colors always ship with icon + text.
 */
const props = defineProps<{ items: Transaction[], limit?: number, showBudgets?: boolean }>()
const store = useLedgerStore()

const rows = computed(() => {
  const totals = totalsByKey(props.items, (t) => t.categoryId)
  const total = totals.reduce((s, r) => s + r.total, 0)
  const max = Math.max(1, ...totals.map((r) => r.total))
  const withBudget = props.showBudgets
    ? store.data.categories.filter((c) => c.kind === 'expense' && c.budget && !totals.some((r) => r.id === c.id)).map((c) => ({ id: c.id, total: 0 }))
    : []
  const all = [...totals, ...withBudget]
  const list = props.limit ? all.slice(0, props.limit) : all
  return list.map((r) => {
    const cat = store.category(r.id)
    const budget = props.showBudgets ? cat.budget : null
    const ratio = budget ? r.total / budget : r.total / max
    return {
      ...r,
      cat,
      budget,
      share: total ? Math.round((r.total / total) * 100) : 0,
      width: Math.min(1, ratio) * 100,
      over: budget ? r.total > budget : false,
      near: budget ? r.total / budget >= 0.85 && r.total <= budget : false,
    }
  })
})
</script>

<template>
  <div>
    <p v-if="!rows.length" class="py-6 text-center text-sm text-muted">No spending in this period.</p>
    <ul class="space-y-3.5">
      <li v-for="r in rows" :key="r.id">
        <div class="flex items-baseline justify-between gap-2 text-sm">
          <span class="flex min-w-0 items-center gap-2">
            <span aria-hidden="true">{{ r.cat.emoji }}</span>
            <span class="truncate font-medium">{{ r.cat.name }}</span>
          </span>
          <span class="num shrink-0">
            <span class="font-semibold">{{ store.money(r.total) }}</span>
            <span v-if="r.budget" class="text-muted"> of {{ store.money(r.budget) }}</span>
            <span v-else class="text-muted"> · {{ r.share }}%</span>
          </span>
        </div>
        <div
          class="mt-1.5 h-2 overflow-hidden rounded-full"
          :style="{ background: r.budget ? 'var(--data-track)' : 'transparent' }"
          role="meter"
          :aria-label="`${r.cat.name} spending`"
          :aria-valuenow="r.total / 100"
          :aria-valuemin="0"
          :aria-valuemax="(r.budget ?? r.total) / 100"
        >
          <div
            class="meter-fill h-full w-full"
            :style="{ '--fill': `${Math.max(r.total ? 1.5 : 0, r.width)}%`, background: r.over ? 'var(--critical)' : r.near ? 'var(--warning)' : 'var(--data)' }"
          />
        </div>
        <p v-if="r.over" class="mt-1 flex items-center gap-1 text-xs font-medium text-critical">
          <CircleAlert :size="14" aria-hidden="true" /> Over budget by {{ store.money(r.total - (r.budget ?? 0)) }}
        </p>
        <p v-else-if="r.near" class="mt-1 flex items-center gap-1 text-xs font-medium text-ink-2">
          <TriangleAlert :size="14" aria-hidden="true" /> {{ store.money((r.budget ?? 0) - r.total) }} left in budget
        </p>
      </li>
    </ul>
  </div>
</template>
