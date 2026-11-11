<script setup lang="ts">
import { onMounted, ref } from 'vue'

// Public pages. Server-rendered, so it must not touch the household store or browser-only APIs during render.
const signedInHere = ref(false)
onMounted(async () => {
  // Signed in on this browser? Then offer "Open app" instead of "Try free". Reads the cookie only (no database).
  try { signedInHere.value = (await $fetch<{ signedIn: boolean }>('/api/auth/session')).signedIn } catch { /* offline: keep the default */ }
})
</script>

<template>
  <div class="min-h-dvh">
    <a href="#main" class="skip-link">Skip to main content</a>
    <header class="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
      <NuxtLink to="/" class="flex items-center gap-2 text-lg font-semibold">
        <img src="/icon.svg" alt="" width="26" height="26" class="rounded-md">
        Tingbits
      </NuxtLink>
      <nav aria-label="Main" class="hidden items-center gap-6 text-sm text-ink-2 md:flex">
        <a href="#how" class="hover:text-ink">How it works</a>
        <a href="#family" class="hover:text-ink">For families</a>
        <a href="#pricing" class="hover:text-ink">Pricing</a>
        <a href="#faq" class="hover:text-ink">FAQ</a>
      </nav>
      <div class="flex items-center gap-1">
        <template v-if="signedInHere">
          <NuxtLink to="/app" class="btn btn-primary !min-h-[42px] text-sm">Open app</NuxtLink>
        </template>
        <template v-else>
          <NuxtLink to="/login" class="hidden min-h-11 items-center px-3 text-sm font-medium sm:inline-flex">Sign in</NuxtLink>
          <NuxtLink to="/login?mode=create" class="btn btn-primary !min-h-[42px] text-sm">Try free</NuxtLink>
        </template>
      </div>
    </header>

    <main id="main" tabindex="-1" class="focus:outline-none">
      <slot />
    </main>

    <footer class="border-t border-line">
      <div class="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-sm text-muted sm:px-6">
        <p>© 2026 Tingbits Expense Tracker</p>
        <p class="flex gap-4">
          <NuxtLink to="/login" class="hover:text-ink">Sign in</NuxtLink>
          <NuxtLink to="/login?mode=create" class="hover:text-ink">Create a household</NuxtLink>
        </p>
      </div>
    </footer>
  </div>
</template>
