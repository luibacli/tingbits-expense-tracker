<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import { X } from '@lucide/vue'

const props = defineProps<{ title: string, labelledby?: string }>()
const open = defineModel<boolean>({ required: true })
const dlg = ref<HTMLDialogElement | null>(null)
const titleId = `sheet-${Math.random().toString(36).slice(2, 8)}`

watch(open, async (v) => {
  await nextTick()
  const d = dlg.value
  if (!d) return
  if (v && !d.open) d.showModal()
  if (!v && d.open) d.close()
}, { immediate: true })

function onBackdrop(e: MouseEvent) {
  // Clicks on the dialog element itself (not its content) are clicks on the backdrop.
  if (e.target === dlg.value) open.value = false
}
</script>

<template>
  <dialog
    ref="dlg"
    class="sheet"
    :aria-labelledby="props.labelledby ?? titleId"
    @close="open = false"
    @click="onBackdrop"
  >
    <div class="flex max-h-[92dvh] flex-col">
      <header class="flex items-center justify-between gap-2 border-b border-line px-4 py-2">
        <h2 :id="titleId" class="text-base font-semibold">{{ title }}</h2>
        <button type="button" class="icon-btn" aria-label="Close" @click="open = false">
          <X :size="20" aria-hidden="true" />
        </button>
      </header>
      <div class="pb-safe overflow-y-auto overscroll-contain">
        <slot />
      </div>
    </div>
  </dialog>
</template>
