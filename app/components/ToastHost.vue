<script setup lang="ts">
const { current, dismiss } = useToast()

function runAction() {
  current.value?.action?.run()
  dismiss()
}
</script>

<template>
  <div class="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex justify-center px-4 lg:bottom-6" role="status" aria-live="polite">
    <div
      v-if="current"
      :key="current.id"
      class="toast-in pointer-events-auto flex max-w-md items-center gap-3 rounded-xl bg-primary py-2 pl-4 pr-2 text-sm text-on-primary"
      style="box-shadow: var(--shadow)"
    >
      <span>{{ current.message }}</span>
      <button v-if="current.action" type="button" class="min-h-10 rounded-lg px-3 font-semibold underline underline-offset-2" @click="runAction">
        {{ current.action.label }}
      </button>
    </div>
  </div>
</template>
