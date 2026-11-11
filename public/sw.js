// Offline support. The app shell is cached so the tracker opens with no signal (jeepney, elevator, basement).
// Pages: network first, cached shell when offline. Hashed build assets (/_nuxt/): cache first.
// API calls are never cached here (see below).
const CACHE = 'tingbits-v4'
// '/' is the public landing page; '/app' is the app shell every /app/* screen boots from.
const SHELL = ['/', '/app', '/manifest.webmanifest', '/icon.svg', '/icon-192.png', '/icon-512.png']
const shellFor = (path) => (path === '/app' || path.startsWith('/app/') ? '/app' : '/')

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  const url = new URL(req.url)
  if (req.method !== 'GET' || url.origin !== self.location.origin) return
  // Never cache the API: it holds private, changing data and the app keeps its own offline copy.
  if (url.pathname.startsWith('/api/')) return

  if (req.mode === 'navigate') {
    const shell = shellFor(url.pathname)
    event.respondWith(
      fetch(req)
        .then((res) => {
          // Only the two entry pages are cached; any /app/* response is the same app shell.
          if (res.ok && (url.pathname === '/' || shell === '/app')) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(shell, copy)) }
          return res
        })
        .catch(() => caches.match(shell).then((r) => r || Response.error())),
    )
    return
  }

  if (url.pathname.startsWith('/_nuxt/')) {
    event.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)) }
        return res
      })),
    )
    return
  }

  event.respondWith(
    caches.match(req).then((hit) => {
      const network = fetch(req).then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)) }
        return res
      }).catch(() => hit)
      return hit || network
    }),
  )
})
