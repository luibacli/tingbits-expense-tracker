<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { Frequency, Recurring, TxType } from '#shared/types'

const open = defineModel<boolean>({ required: true })
const props = defineProps<{ item: Recurring | null }>()
const store = useLedgerStore()
const { data } = store
const toast = useToast()

const type = ref<TxType>('expense')
const amountText = ref('')
const note = ref('')
const categoryId = ref('')
const frequency = ref<Frequency>('monthly')
const nextDate = ref(todayISO())
const auto = ref(false)
const active = ref(true)
const memberId = ref<string | null>(null)
const methodId = ref<string | null>(null)
const showErrors = ref(false)

watch(open, (v) => {
  if (!v) return
  const r = props.item
  showErrors.value = false
  type.value = r?.type ?? 'expense'
  amountText.value = r ? centsToInput(r.amount) : ''
  note.value = r?.note ?? ''
  categoryId.value = r?.categoryId ?? 'bills'
  frequency.value = r?.frequency ?? 'monthly'
  nextDate.value = r?.nextDate ?? todayISO()
  auto.value = r?.auto ?? false
  active.value = r?.active ?? true
  memberId.value = r?.memberId ?? data.settings.defaultMemberId
  methodId.value = r?.methodId ?? null
})

const categories = computed(() => data.categories.filter((c) => c.kind === type.value && !c.archived))
watch(type, () => { if (!categories.value.some((c) => c.id === categoryId.value)) categoryId.value = categories.value[0]?.id ?? '' })
const amount = computed(() => parseAmount(amountText.value))
const valid = computed(() => !!amount.value && !!note.value.trim() && !!categoryId.value && !!nextDate.value)

function save() {
  showErrors.value = true
  if (!valid.value) return
  const fields = {
    type: type.value, amount: amount.value!, note: note.value.trim(), categoryId: categoryId.value,
    frequency: frequency.value, nextDate: nextDate.value, auto: auto.value, memberId: memberId.value, methodId: methodId.value,
  }
  store.saveRecurring({ ...fields, active: props.item ? active.value : true }, props.item?.id)
  open.value = false
  toast.show(auto.value && nextDate.value <= todayISO() ? 'Saved. Past due entries will be posted.' : 'Recurring item saved')
}

function remove() {
  if (!props.item) return
  const removed = store.deleteRecurring(props.item.id)
  if (removed) toast.show('Recurring item removed. Past entries are kept.', { label: 'Undo', run: () => store.restoreRecurring(removed) })
  open.value = false
}
</script>

<template>
  <BaseSheet v-model="open" :title="item ? 'Edit recurring item' : 'New recurring item'">
    <form class="space-y-4 p-4" novalidate @submit.prevent="save">
      <div class="grid grid-cols-2 rounded-xl bg-surface-2 p-1" role="group" aria-label="Type">
        <button v-for="t in (['expense', 'income'] as const)" :key="t" type="button" class="min-h-10 rounded-lg text-sm font-semibold capitalize" :class="type === t ? 'bg-surface text-ink shadow-sm' : 'text-ink-2'" :aria-pressed="type === t" @click="type = t">{{ t }}</button>
      </div>
      <div>
        <label for="rec-note" class="label">Name</label>
        <input id="rec-note" v-model="note" class="field" placeholder="Rent, Netflix, Internet, Salary…" maxlength="200" :aria-invalid="showErrors && !note.trim()">
        <p v-if="showErrors && !note.trim()" class="mt-1 text-sm text-critical">Give it a name.</p>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label for="rec-amount" class="label">Amount</label>
          <input id="rec-amount" v-model="amountText" class="field num" inputmode="decimal" autocomplete="off" :aria-invalid="showErrors && !amount">
          <p v-if="showErrors && !amount" class="mt-1 text-sm text-critical">Enter an amount.</p>
        </div>
        <div>
          <label for="rec-cat" class="label">Category</label>
          <select id="rec-cat" v-model="categoryId" class="field">
            <option v-for="c in categories" :key="c.id" :value="c.id">{{ c.emoji }} {{ c.name }}</option>
          </select>
        </div>
        <div>
          <label for="rec-freq" class="label">Repeats</label>
          <select id="rec-freq" v-model="frequency" class="field">
            <option value="weekly">Every week</option>
            <option value="monthly">Every month</option>
            <option value="yearly">Every year</option>
          </select>
        </div>
        <div>
          <label for="rec-next" class="label">Next due</label>
          <input id="rec-next" v-model="nextDate" type="date" class="field">
        </div>
        <div v-if="data.members.length > 1">
          <label for="rec-member" class="label">Paid by</label>
          <select id="rec-member" v-model="memberId" class="field">
            <option v-for="m in data.members" :key="m.id" :value="m.id">{{ m.name }}</option>
          </select>
        </div>
        <div>
          <label for="rec-method" class="label">Method</label>
          <select id="rec-method" v-model="methodId" class="field">
            <option :value="null">Not set</option>
            <option v-for="m in data.methods" :key="m.id" :value="m.id">{{ m.name }}</option>
          </select>
        </div>
      </div>
      <label class="flex items-start gap-3 rounded-xl border border-line p-3">
        <input v-model="auto" type="checkbox" class="mt-1 size-5 accent-current">
        <span>
          <span class="block font-medium">Log it automatically</span>
          <span class="block text-sm text-ink-2">Best for fixed amounts like rent or subscriptions. Leave off for bills that vary, and you will get a "Mark paid" reminder on the Today screen instead.</span>
        </span>
      </label>
      <label v-if="item" class="flex items-center gap-3 px-1">
        <input v-model="active" type="checkbox" class="size-5 accent-current">
        <span class="font-medium">Active</span>
        <span class="text-sm text-ink-2">Untick to pause without deleting</span>
      </label>
      <div class="flex gap-2 pt-1">
        <button v-if="item" type="button" class="btn btn-danger" @click="remove">Delete</button>
        <button type="submit" class="btn btn-primary flex-1">Save</button>
      </div>
    </form>
  </BaseSheet>
</template>
