<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { Search, X } from '@lucide/vue'

useSeoMeta({ title: 'History' })

const store = useLedgerStore()
const { data } = store
const route = useRoute()

const offset = ref(0)
const query = ref('')
const type = ref<'all' | 'expense' | 'income'>('all')
const categoryId = ref('')
const memberId = ref('')
const limit = ref(200)
const searchEl = ref<HTMLInputElement | null>(null)

onMounted(() => { if (route.query.focus === 'search') searchEl.value?.focus() })
watch(() => route.query.focus, (f) => { if (f === 'search') searchEl.value?.focus() })

const period = computed(() => periodFor(todayISO(), data.settings.periodStartDay, offset.value))
const searching = computed(() => query.value.trim().length > 0)

// Older periods and all-time search come from the server; what is already loaded shows at once.
watch(period, (p) => store.ensureFrom(p.start), { immediate: true })
const searchOffline = ref(false)
let searchTimer: ReturnType<typeof setTimeout> | undefined
watch(query, (q) => {
  clearTimeout(searchTimer)
  if (!q.trim()) { searchOffline.value = false; return }
  searchTimer = setTimeout(async () => { searchOffline.value = !(await store.search(q.trim())) }, 300)
})

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  return data.transactions.filter((t) => {
    if (!searching.value && !inPeriod(t.date, period.value)) return false
    if (type.value !== 'all' && t.type !== type.value) return false
    if (categoryId.value && t.categoryId !== categoryId.value) return false
    if (memberId.value && t.memberId !== memberId.value) return false
    if (q) {
      const hay = `${t.note} ${store.category(t.categoryId).name} ${(t.amount / 100).toFixed(2)}`.toLowerCase()
      if (!q.split(/\s+/).every((w) => hay.includes(w))) return false
    }
    return true
  })
})
const shown = computed(() => [...filtered.value].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, limit.value))
const spent = computed(() => sumBy(filtered.value, 'expense'))
const income = computed(() => sumBy(filtered.value, 'income'))
const categories = computed(() => data.categories.filter((c) => type.value === 'all' || c.kind === type.value))
const hasFilters = computed(() => type.value !== 'all' || !!categoryId.value || !!memberId.value || searching.value)

function clearFilters() {
  query.value = ''; type.value = 'all'; categoryId.value = ''; memberId.value = ''
}
</script>

<template>
  <div class="space-y-4">
    <h1 class="sr-only">History</h1>

    <div class="relative">
      <Search :size="18" class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden="true" />
      <label for="history-search" class="sr-only">Search all entries</label>
      <input id="history-search" ref="searchEl" v-model="query" type="search" class="field !pl-10" placeholder="Search notes, categories, amounts" autocomplete="off">
    </div>

    <div class="flex flex-wrap items-center gap-2">
      <div class="flex rounded-full bg-surface-2 p-0.5" role="group" aria-label="Type">
        <button v-for="t in (['all', 'expense', 'income'] as const)" :key="t" type="button" class="min-h-9 rounded-full px-3 text-sm font-medium capitalize" :class="type === t ? 'bg-surface text-ink shadow-sm' : 'text-ink-2'" :aria-pressed="type === t" @click="type = t; categoryId = ''">
          {{ t === 'all' ? 'All' : t === 'expense' ? 'Expenses' : 'Income' }}
        </button>
      </div>
      <label class="sr-only" for="history-cat">Category</label>
      <select id="history-cat" v-model="categoryId" class="field !w-auto !rounded-full !py-1.5 text-sm">
        <option value="">All categories</option>
        <option v-for="c in categories" :key="c.id" :value="c.id">{{ c.emoji }} {{ c.name }}</option>
      </select>
      <template v-if="data.members.length > 1">
        <label class="sr-only" for="history-member">Person</label>
        <select id="history-member" v-model="memberId" class="field !w-auto !rounded-full !py-1.5 text-sm">
          <option value="">Everyone</option>
          <option v-for="m in data.members" :key="m.id" :value="m.id">{{ m.name }}</option>
        </select>
      </template>
      <button v-if="hasFilters" type="button" class="inline-flex min-h-9 items-center gap-1 px-2 text-sm font-medium text-ink-2" @click="clearFilters">
        <X :size="16" aria-hidden="true" /> Clear
      </button>
    </div>

    <PeriodNav v-if="!searching" v-model="offset" />
    <p v-else class="text-sm text-ink-2">{{ searchOffline ? 'Offline: searching entries saved on this device' : 'Searching all time' }}</p>

    <dl class="card grid grid-cols-3 divide-x divide-line text-center">
      <div class="px-2 py-3">
        <dt class="text-xs text-muted">Spent</dt>
        <dd class="num mt-0.5 font-semibold">{{ store.money(spent, { compact: true }) }}</dd>
      </div>
      <div class="px-2 py-3">
        <dt class="text-xs text-muted">Income</dt>
        <dd class="num mt-0.5 font-semibold text-good">{{ store.money(income, { compact: true }) }}</dd>
      </div>
      <div class="px-2 py-3">
        <dt class="text-xs text-muted">Net</dt>
        <dd class="num mt-0.5 font-semibold" :class="income - spent < 0 ? 'text-critical' : ''">{{ store.money(income - spent, { compact: true, sign: true }) }}</dd>
      </div>
    </dl>

    <TxList :items="shown" show-day-totals :empty-text="hasFilters ? 'No entries match.' : 'No entries in this period.'" />
    <button v-if="filtered.length > shown.length" type="button" class="btn btn-ghost w-full" @click="limit += 200">
      Show more ({{ filtered.length - shown.length }} left)
    </button>
  </div>
</template>
