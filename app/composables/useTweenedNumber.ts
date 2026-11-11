import { onBeforeUnmount, ref, watch } from 'vue'

/**
 * A number that settles on its new value over a short time instead of jumping (motion signature:
 * the safe-to-spend figure). The first value shows immediately; only changes animate. Instant under
 * reduced motion or when the page is hidden. Pair the visible number with an sr-only final value,
 * so screen readers never hear the in-between numbers.
 */
export function useTweenedNumber(source: () => number, ms = 450) {
  const shown = ref(source())
  let raf = 0
  watch(source, (to) => {
    cancelAnimationFrame(raf)
    const from = shown.value
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches || document.visibilityState !== 'visible'
    if (from === to || still) { shown.value = to; return }
    const start = performance.now()
    const step = (now: number) => {
      const p = Math.min(1, (now - start) / ms)
      const eased = 1 - (1 - p) ** 3
      shown.value = Math.round(from + (to - from) * eased)
      if (p < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
  })
  onBeforeUnmount(() => cancelAnimationFrame(raf))
  return shown
}
