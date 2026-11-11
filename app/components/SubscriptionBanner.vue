<script setup lang="ts">
import { computed } from 'vue'
import { Lock, Clock } from '@lucide/vue'

/* Shown above every app screen: read-only after the trial, or a gentle countdown in the last week. */
const store = useLedgerStore()
const s = computed(() => store.subscription)
const owner = computed(() => store.household?.accounts.find((a) => a.role === 'owner')?.name ?? 'the owner')
</script>

<template>
  <div v-if="s && s.status === 'expired'" class="card mb-5 flex items-start gap-3 p-4" role="status" data-testid="readonly-banner">
    <Lock :size="20" class="mt-0.5 shrink-0 text-ink-2" aria-hidden="true" />
    <div class="min-w-0 flex-1">
      <p class="font-semibold">Your free trial has ended</p>
      <p class="mt-0.5 text-sm text-ink-2">
        <template v-if="store.isOwner">Subscribe for ₱{{ PRICE_PHP_MONTHLY }} a month to keep adding entries.</template>
        <template v-else>Ask {{ owner }} to subscribe to keep adding entries.</template>
        Your data is safe: you can still view and export everything.
      </p>
    </div>
    <NuxtLink v-if="store.isOwner" to="/app/settings#plan" class="btn btn-primary !min-h-10 shrink-0 text-sm">See plan</NuxtLink>
  </div>
  <p v-else-if="s && s.status === 'trial' && s.daysLeft <= 7" class="mb-4 flex items-center gap-2 text-sm text-ink-2" role="status">
    <Clock :size="16" aria-hidden="true" />
    Free trial: {{ s.daysLeft }} {{ s.daysLeft === 1 ? 'day' : 'days' }} left.
    <NuxtLink v-if="store.isOwner" to="/app/settings#plan" class="font-medium text-ink underline underline-offset-4">See plan</NuxtLink>
  </p>
</template>
