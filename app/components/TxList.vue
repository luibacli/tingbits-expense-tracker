<script setup lang="ts">
import { computed } from 'vue'
import { Repeat } from '@lucide/vue'
import type { Transaction } from '#shared/types'

const props = defineProps<{ items: Transaction[], showDayTotals?: boolean, emptyText?: string }>()
const store = useLedgerStore()
const sheet = useEntrySheet()

const groups = computed(() => {
  const sorted = [...props.items].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.createdAt - a.createdAt))
  const out: Array<{ date: string, items: Transaction[], spent: number }> = []
  for (const t of sorted) {
    let g = out[out.length - 1]
    if (!g || g.date !== t.date) { g = { date: t.date, items: [], spent: 0 }; out.push(g) }
    g.items.push(t)
    if (t.type === 'expense') g.spent += t.amount
  }
  return out
})

const showMember = computed(() => store.data.members.length > 1)
</script>

<template>
  <div>
    <p v-if="!groups.length" class="px-1 py-8 text-center text-sm text-muted">{{ emptyText ?? 'Nothing here yet.' }}</p>
    <div v-for="g in groups" :key="g.date" role="group" class="mb-4 last:mb-0" :aria-label="formatDay(g.date)">
      <div class="flex items-baseline justify-between px-1 pb-1.5">
        <h3 class="text-sm font-semibold text-ink-2">{{ formatDay(g.date) }}</h3>
        <span v-if="showDayTotals && g.spent" class="num text-sm text-muted">{{ store.money(g.spent) }}</span>
      </div>
      <ul class="card divide-y divide-line overflow-hidden">
        <li v-for="t in g.items" :key="t.id">
          <button type="button" class="flex min-h-14 w-full items-center gap-3 px-3 py-2 text-left hover:bg-surface-2 active:bg-surface-2" @click="sheet.edit(t)">
            <span class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-lg" aria-hidden="true">
              {{ store.category(t.categoryId).emoji }}
            </span>
            <span class="min-w-0 flex-1">
              <span class="block truncate font-medium">{{ t.note || store.category(t.categoryId).name }}</span>
              <span class="flex items-center gap-1 truncate text-xs text-muted">
                <Repeat v-if="t.recurringId" :size="12" aria-label="Recurring" />
                {{ store.category(t.categoryId).name }}
                <template v-if="showMember && t.memberId && store.memberMap.get(t.memberId)"> · {{ store.memberMap.get(t.memberId)!.name }}</template>
                <template v-if="t.methodId && store.methodMap.get(t.methodId)"> · {{ store.methodMap.get(t.methodId)!.name }}</template>
              </span>
            </span>
            <span class="num shrink-0 font-semibold" :class="t.type === 'income' ? 'text-good' : 'text-ink'">
              {{ t.type === 'income' ? store.money(t.amount, { sign: true }) : store.money(t.amount) }}
            </span>
          </button>
        </li>
      </ul>
    </div>
  </div>
</template>
