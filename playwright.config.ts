import { defineConfig, devices } from '@playwright/test'

/**
 * End-to-end tests run against the production build (`nuxt build`) served by scripts/e2e-server.mjs,
 * which starts its own in-memory MongoDB. Projects cover Chromium, WebKit (iPhone Safari engine) and Firefox.
 * Set PW_PORT if 3100 is taken.
 */
const port = Number(process.env.PW_PORT) || 3100

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  reporter: 'list',
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-chrome', use: { ...devices['Pixel 7'] } },
    { name: 'mobile-safari', use: { ...devices['iPhone 13'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
  ],
  webServer: {
    command: `node scripts/e2e-server.mjs ${port}`,
    url: `http://127.0.0.1:${port}/login`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
})
