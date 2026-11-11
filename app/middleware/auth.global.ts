// Only /app needs an account. The landing page and legal pages are public and server-rendered,
// so they never load the household store. This only decides what to show; the server enforces access.
export default defineNuxtRouteMiddleware(async (to) => {
  const isApp = to.path === '/app' || to.path.startsWith('/app/')
  if (import.meta.server || (!isApp && to.path !== '/login')) return
  const store = useLedgerStore()
  await store.init()
  if (to.path === '/login') {
    if (store.status === 'ready') return navigateTo('/app')
    return
  }
  if (store.status === 'signed-out') return navigateTo({ path: '/login', query: to.path !== '/app' ? { next: to.fullPath } : {} })
})
