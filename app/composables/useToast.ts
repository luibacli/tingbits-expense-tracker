import { ref } from 'vue'

interface Toast {
  id: number
  message: string
  action?: { label: string, run: () => void }
}

const current = ref<Toast | null>(null)
let timer: ReturnType<typeof setTimeout> | undefined
let seq = 0

export function useToast() {
  function show(message: string, action?: Toast['action'], ms = 5000) {
    clearTimeout(timer)
    current.value = { id: ++seq, message, action }
    timer = setTimeout(() => { current.value = null }, ms)
  }
  function dismiss() {
    clearTimeout(timer)
    current.value = null
  }
  return { current, show, dismiss }
}
