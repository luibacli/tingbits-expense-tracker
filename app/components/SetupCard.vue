<script setup lang="ts">
import { ref } from 'vue'

/* First-run setup: the three things that make the home screen useful. Everything is editable later. */
const store = useLedgerStore()
const { data } = store

const currency = ref(data.settings.currency)
const budgetText = ref('')
const people = ref('')
const startDay = ref(data.settings.periodStartDay)

function finish() {
  data.settings.currency = currency.value
  const b = parseAmount(budgetText.value)
  if (b) data.settings.monthlyBudget = b
  data.settings.periodStartDay = startDay.value
  const names = people.value.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 12)
  if (names.length) {
    data.members[0]!.name = names[0]!
    for (const name of names.slice(1)) data.members.push({ id: uid(), name })
  }
  data.settings.setupDone = true
}
</script>

<template>
  <section class="card p-5" aria-labelledby="setup-heading">
    <h2 id="setup-heading" class="text-lg font-semibold">Set up in 20 seconds</h2>
    <p class="mt-1 text-sm text-ink-2">Shared with everyone in your household. You can change it all later in Settings.</p>
    <form class="mt-4 grid gap-4 sm:grid-cols-2" @submit.prevent="finish">
      <div>
        <label for="setup-currency" class="label">Currency</label>
        <select id="setup-currency" v-model="currency" class="field">
          <option v-for="c in CURRENCIES" :key="c" :value="c">{{ c }} ({{ currencySymbol(c) }})</option>
        </select>
      </div>
      <div>
        <label for="setup-budget" class="label">Monthly spending budget <span class="font-normal text-muted">(optional)</span></label>
        <input id="setup-budget" v-model="budgetText" class="field num" inputmode="decimal" placeholder="e.g. 30000" autocomplete="off">
      </div>
      <div>
        <label for="setup-people" class="label">Who spends? <span class="font-normal text-muted">(comma separated)</span></label>
        <input id="setup-people" v-model="people" class="field" placeholder="Me, Partner" autocomplete="off">
      </div>
      <div>
        <label for="setup-start" class="label">Budget month starts on</label>
        <select id="setup-start" v-model.number="startDay" class="field">
          <option v-for="d in 28" :key="d" :value="d">Day {{ d }}{{ d === 1 ? ' (calendar month)' : '' }}</option>
        </select>
      </div>
      <div class="flex gap-2 sm:col-span-2">
        <button type="submit" class="btn btn-primary flex-1">Start tracking</button>
        <button type="button" class="btn btn-ghost" @click="data.settings.setupDone = true">Skip</button>
      </div>
    </form>
  </section>
</template>
