// Registers the offline service worker (public/sw.js) in production builds only,
// so dev-server hot reload is never served from a stale cache.
export default defineNuxtPlugin(() => {
  if (import.meta.dev || !('serviceWorker' in navigator)) return
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => { /* offline support is best effort */ })
  })
})
