<script setup lang="ts">
import { computed } from 'vue'
import { ChevronLeft, ChevronRight } from '@lucide/vue'

const offset = defineModel<number>({ required: true })
const store = useLedgerStore()
const period = computed(() => periodFor(todayISO(), store.data.settings.periodStartDay, offset.value))
</script>

<template>
  <div class="flex items-center justify-between gap-2">
    <button type="button" class="icon-btn" aria-label="Previous period" @click="offset--">
      <ChevronLeft :size="20" aria-hidden="true" />
    </button>
    <p class="flex-1 text-center font-semibold" aria-live="polite">
      {{ formatPeriod(period) }}
      <button v-if="offset !== 0" type="button" class="ml-1 min-h-8 text-sm font-medium text-ink-2 underline underline-offset-4" @click="offset = 0">Now</button>
    </p>
    <button type="button" class="icon-btn" aria-label="Next period" :disabled="offset >= 0" :class="offset >= 0 ? 'invisible' : ''" @click="offset++">
      <ChevronRight :size="20" aria-hidden="true" />
    </button>
  </div>
</template>
