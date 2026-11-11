<script setup lang="ts">
import { onBeforeUnmount, onMounted, watchEffect } from 'vue'
import { House, List, ChartColumn, CalendarClock, Settings, Plus, Wallet, CloudOff, RefreshCw } from '@lucide/vue'

const store = useLedgerStore()
const sheet = useEntrySheet()
const route = useRoute()

const nav = [
  { to: '/app', label: 'Today', icon: House },
  { to: '/app/history', label: 'History', icon: List },
  { to: '/app/insights', label: 'Insights', icon: ChartColumn },
  { to: '/app/plan', label: 'Plan', icon: CalendarClock },
]

const isActive = (to: string) => (to === '/app' ? route.path === '/app' || route.path === '/app/' : route.path.startsWith(to))

// Theme
watchEffect(() => {
  const t = store.data.settings.theme
  if (t === 'system') delete document.documentElement.dataset.theme
  else document.documentElement.dataset.theme = t
})


function onKey(e: KeyboardEvent) {
  if (e.metaKey || e.ctrlKey || e.altKey || sheet.open.value) return
  const el = e.target as HTMLElement | null
  if (el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName))) return
  if (document.querySelector('dialog[open]')) return
  if (e.key === 'n' || e.key === 'a') { e.preventDefault(); sheet.add() }
  else if (e.key === 'i') { e.preventDefault(); sheet.add({ type: 'income' }) }
  else if (e.key === '/') { e.preventDefault(); navigateTo('/app/history?focus=search') }
}

onMounted(() => {
  window.addEventListener('keydown', onKey)
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey)
})
</script>

<template>
  <div class="min-h-dvh lg:flex">
    <a href="#main" class="skip-link">Skip to main content</a>

    <!-- Desktop sidebar -->
    <aside class="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-line px-3 py-5 lg:flex">
      <NuxtLink to="/app" class="mb-6 flex items-center gap-2 px-3 font-semibold">
        <Wallet :size="22" aria-hidden="true" /> Tingbits
      </NuxtLink>
      <button type="button" class="btn btn-primary mb-5 w-full" @click="sheet.add()">
        <Plus :size="18" aria-hidden="true" /> Add expense
        <kbd class="ml-auto rounded border border-current/30 px-1.5 text-xs font-normal opacity-70">N</kbd>
      </button>
      <nav aria-label="Main" class="flex flex-col gap-1">
        <NuxtLink
          v-for="n in nav"
          :key="n.to"
          :to="n.to"
          class="flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium"
          :class="isActive(n.to) ? 'bg-surface-2 text-ink' : 'text-ink-2 hover:bg-surface-2'"
          :aria-current="isActive(n.to) ? 'page' : undefined"
        >
          <component :is="n.icon" :size="18" aria-hidden="true" /> {{ n.label }}
        </NuxtLink>
        <NuxtLink
          to="/app/settings"
          class="flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium"
          :class="isActive('/app/settings') ? 'bg-surface-2 text-ink' : 'text-ink-2 hover:bg-surface-2'"
          :aria-current="isActive('/app/settings') ? 'page' : undefined"
        >
          <Settings :size="18" aria-hidden="true" /> Settings
        </NuxtLink>
      </nav>
      <SyncBadge class="mt-auto mb-3 px-3" />
      <p class="px-3 text-xs leading-5 text-muted">
        Shortcuts: <kbd>N</kbd> expense, <kbd>I</kbd> income, <kbd>/</kbd> search
      </p>
    </aside>

    <div class="min-w-0 flex-1">
      <!-- Mobile top bar -->
      <header class="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-bg/90 px-2 backdrop-blur lg:hidden" style="padding-top: env(safe-area-inset-top)">
        <NuxtLink to="/app" class="flex min-h-12 items-center gap-2 px-2 font-semibold">
          <Wallet :size="20" aria-hidden="true" /> Tingbits
        </NuxtLink>
        <SyncBadge class="ml-auto mr-1" />
        <NuxtLink to="/app/settings" class="icon-btn" aria-label="Settings" :aria-current="isActive('/app/settings') ? 'page' : undefined">
          <Settings :size="20" aria-hidden="true" />
        </NuxtLink>
      </header>

      <main id="main" tabindex="-1" class="mx-auto w-full max-w-3xl px-4 pb-32 pt-4 focus:outline-none lg:px-8 lg:pb-12 lg:pt-8">
        <div v-if="store.status === 'loading'" class="py-24 text-center text-sm text-muted" role="status">Loading your household…</div>
        <div v-else-if="store.status === 'unreachable'" class="card mx-auto mt-12 max-w-md p-6 text-center" role="alert">
          <CloudOff :size="28" class="mx-auto text-muted" aria-hidden="true" />
          <h1 class="mt-3 text-lg font-semibold">Can't reach Tingbits</h1>
          <p class="mt-1 text-sm text-ink-2">Check your connection. Your data is safe on the server and loads once you're back online.</p>
          <button type="button" class="btn btn-primary mt-4" @click="store.refresh()"><RefreshCw :size="18" aria-hidden="true" /> Try again</button>
        </div>
        <template v-else>
          <SubscriptionBanner />
          <slot />
        </template>
      </main>
    </div>

    <!-- Mobile tab bar with the add button in the thumb zone -->
    <nav aria-label="Main" class="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface lg:hidden">
      <ul class="mx-auto grid max-w-md grid-cols-5 items-center">
        <li v-for="n in nav.slice(0, 2)" :key="n.to">
          <NuxtLink :to="n.to" class="flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium" :class="isActive(n.to) ? 'text-ink' : 'text-muted'" :aria-current="isActive(n.to) ? 'page' : undefined">
            <component :is="n.icon" :size="22" :stroke-width="isActive(n.to) ? 2.4 : 1.8" aria-hidden="true" />{{ n.label }}
          </NuxtLink>
        </li>
        <li class="flex justify-center">
          <button type="button" class="flex size-14 -translate-y-3 items-center justify-center rounded-2xl bg-primary text-on-primary transition-transform duration-100 active:scale-95" style="box-shadow: var(--shadow)" aria-label="Add expense" @click="sheet.add()">
            <Plus :size="28" aria-hidden="true" />
          </button>
        </li>
        <li v-for="n in nav.slice(2)" :key="n.to">
          <NuxtLink :to="n.to" class="flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium" :class="isActive(n.to) ? 'text-ink' : 'text-muted'" :aria-current="isActive(n.to) ? 'page' : undefined">
            <component :is="n.icon" :size="22" :stroke-width="isActive(n.to) ? 2.4 : 1.8" aria-hidden="true" />{{ n.label }}
          </NuxtLink>
        </li>
      </ul>
    </nav>

    <EntrySheet />
    <ToastHost />
  </div>
</template>
