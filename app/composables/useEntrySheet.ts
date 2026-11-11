import { ref } from 'vue'
import type { Transaction, TxType } from '#shared/types'

/** Global open/close state for the add/edit entry sheet, so any screen (or the "n" key) can open it. */
const open = ref(false)
const editing = ref<Transaction | null>(null)
const preset = ref<{ type?: TxType, date?: string } | null>(null)

export function useEntrySheet() {
  return {
    open,
    editing,
    preset,
    add(p?: { type?: TxType, date?: string }) {
      editing.value = null
      preset.value = p ?? null
      open.value = true
    },
    edit(tx: Transaction) {
      editing.value = tx
      preset.value = null
      open.value = true
    },
    close() {
      open.value = false
    },
  }
}
