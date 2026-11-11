<script setup lang="ts">
import { CloudOff, RefreshCw } from '@lucide/vue'

/* Shows only when something needs attention: offline, or changes still being sent. */
const store = useLedgerStore()
</script>

<template>
  <p v-if="!store.sync.online" class="flex items-center gap-1.5 text-xs font-medium text-ink-2" role="status">
    <CloudOff :size="14" aria-hidden="true" />
    Offline<template v-if="store.sync.pending">, {{ store.sync.pending }} {{ store.sync.pending === 1 ? 'change' : 'changes' }} waiting</template>
  </p>
  <p v-else-if="store.sync.pending" class="flex items-center gap-1.5 text-xs text-muted" role="status">
    <RefreshCw :size="14" class="motion-safe:animate-spin" aria-hidden="true" /> Saving…
  </p>
</template>
