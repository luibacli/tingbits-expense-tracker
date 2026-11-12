import { test, expect, type Page } from '@playwright/test'

/*
 * Visual regression against the approved Direction A design (docs/CREATIVE_DIRECTION.md).
 * Baselines are macOS renders, committed in visual.spec.ts-snapshots/. Fonts render differently
 * on Linux, so CI skips these; run them locally before merging UI changes. Update baselines only
 * from an approved design change: npx playwright test tests/e2e/visual.spec.ts --update-snapshots
 */
test.skip(!!process.env.CI, 'baselines are macOS renders; run locally')

async function open(page: Page, path: string) {
  // The landing calculator counts days to payday from today; freeze the date so pixels are stable.
  await page.clock.setFixedTime(new Date('2026-11-12T10:00:00+08:00'))
  await page.goto(path, { waitUntil: 'networkidle' })
  await page.evaluate(() => document.fonts.ready)
}

test('landing: hero above the fold', async ({ page }) => {
  await open(page, '/')
  await expect(page).toHaveScreenshot('landing-hero.png', { maxDiffPixelRatio: 0.01 })
})

test('landing: pricing', async ({ page }) => {
  await open(page, '/')
  await expect(page.locator('#pricing')).toHaveScreenshot('landing-pricing.png', { maxDiffPixelRatio: 0.01 })
})

test('sign-in', async ({ page }) => {
  await open(page, '/login')
  await expect(page).toHaveScreenshot('login.png', { maxDiffPixelRatio: 0.01 })
})
