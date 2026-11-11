import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// Unit tests for shared logic and server services. Services are plain TypeScript (no Nuxt auto-imports),
// so they run here directly against an in-memory MongoDB.
export default defineConfig({
  resolve: {
    alias: { '#shared': fileURLToPath(new URL('./shared', import.meta.url)) },
  },
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
    hookTimeout: 120_000,
    testTimeout: 30_000,
  },
})
