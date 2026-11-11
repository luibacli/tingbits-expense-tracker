import tailwindcss from '@tailwindcss/vite'

// Public landing page (server-rendered and prerendered, indexable) + the household app under /app
// (client-rendered: every screen is private data) + Nuxt server routes over MongoDB.
// See docs/architecture.md and docs/decisions/ (ADR-007 for the split).
const csp = [
  "default-src 'self'",
  // Nuxt's SPA shell inlines its config script, so 'unsafe-inline' is needed for scripts (docs/security.md).
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "manifest-src 'self'",
  "worker-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ')

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: false },
  ssr: true,
  modules: ['@pinia/nuxt'],
  css: ['~/assets/css/main.css'],
  // Private, server-only. Set NUXT_MONGODB_URI (or MONGODB_URI) and NUXT_SESSION_PASSWORD in .env.
  runtimeConfig: {
    mongodbUri: '',
    sessionPassword: '',
    // Attempts allowed per IP per window for sign-in and sign-up (NUXT_AUTH_RATE_LIMIT).
    authRateLimit: 10,
  },
  routeRules: {
    '/**': {
      headers: {
        'Content-Security-Policy': csp,
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()',
        'Cross-Origin-Opener-Policy': 'same-origin',
        'Strict-Transport-Security': 'max-age=63072000',
      },
    },
    '/': { prerender: true },
    // Private screens: rendered in the browser only, and kept out of search engines.
    '/app': { ssr: false, headers: { 'X-Robots-Tag': 'noindex, nofollow' } },
    '/app/**': { ssr: false, headers: { 'X-Robots-Tag': 'noindex, nofollow' } },
    '/login': { ssr: false, headers: { 'X-Robots-Tag': 'noindex, nofollow' } },
    '/api/**': { headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } },
  },
  vite: {
    plugins: [tailwindcss()],
  },
  app: {
    head: {
      htmlAttrs: { lang: 'en' },
      title: 'Tingbits Expense Tracker',
      titleTemplate: '%s · Tingbits',
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
        { name: 'description', content: 'Tingbits Expense Tracker: know what your family can spend today, and still make it to payday. A shared family money tracker for ₱150 a month.' },
        { name: 'theme-color', content: '#f4f3ee', media: '(prefers-color-scheme: light)' },
        { name: 'theme-color', content: '#121211', media: '(prefers-color-scheme: dark)' },
        { name: 'apple-mobile-web-app-capable', content: 'yes' },
        { name: 'mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-status-bar-style', content: 'default' },
        { name: 'apple-mobile-web-app-title', content: 'Tingbits' },
      ],
      link: [
        { rel: 'manifest', href: '/manifest.webmanifest' },
        { rel: 'icon', type: 'image/svg+xml', href: '/icon.svg' },
        { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
      ],
      noscript: [{ textContent: 'Tingbits Expense Tracker needs JavaScript to run.' }],
    },
  },
  typescript: {
    strict: true,
  },
})
