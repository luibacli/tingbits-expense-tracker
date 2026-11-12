import { test, expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

// Automated accessibility (WCAG 2.2 AA rules in axe) and the uptime health route.

let seq = 0
const uniqueEmail = () => `a11y-${Date.now()}-${process.pid}-${seq++}@example.com`

async function axe(page: Page) {
  const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze()
  return result.violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(' | ')}`)
}

test('health route answers ok for uptime monitors', async ({ request }) => {
  const res = await request.get('/api/health')
  expect(res.status()).toBe(200)
  expect(await res.json()).toEqual({ status: 'ok' })
  expect(res.headers()['cache-control']).toContain('no-store')
})

test('landing and sign-in pages have no axe violations', async ({ page }) => {
  for (const path of ['/', '/login']) {
    await page.goto(path, { waitUntil: 'networkidle' })
    expect(await axe(page), path).toEqual([])
  }
})

test('app screens have no axe violations, in light and dark', async ({ page }) => {
  await page.goto('/login', { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: 'New', exact: true }).click()
  await page.getByLabel('Your name').fill('Luigi')
  await page.getByLabel('Email').fill(uniqueEmail())
  await page.getByLabel('Password').fill('password123')
  await page.getByRole('button', { name: 'Create household' }).click()
  await page.getByRole('button', { name: 'Skip' }).click()
  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme })
    for (const path of ['/app', '/app/history', '/app/insights', '/app/plan', '/app/settings']) {
      await page.goto(path, { waitUntil: 'networkidle' })
      expect(await axe(page), `${path} (${scheme})`).toEqual([])
    }
  }
})

test('Day Strip: one large control; keys and taps choose a day, Escape returns to today', async ({ page }) => {
  await page.goto('/login', { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: 'New', exact: true }).click()
  await page.getByLabel('Your name').fill('Luigi')
  await page.getByLabel('Email').fill(uniqueEmail())
  await page.getByLabel('Password').fill('password123')
  await page.getByRole('button', { name: 'Create household' }).click()
  await page.getByRole('button', { name: 'Skip' }).click()

  const strip = page.getByRole('slider', { name: 'Day' })
  const box = await strip.boundingBox()
  expect(box!.width).toBeGreaterThan(24)
  expect(box!.height).toBeGreaterThan(24)
  const dayHeading = page.locator('#day-heading')
  await expect(dayHeading).toHaveText('Today')

  const todayIndex = Number(await strip.getAttribute('aria-valuenow'))
  test.skip(todayIndex < 2, 'needs at least one earlier day in the budget period')
  await strip.focus()
  await page.keyboard.press('ArrowLeft')
  await expect(strip).toHaveAttribute('aria-valuenow', String(todayIndex - 1))
  await expect(dayHeading).not.toHaveText('Today')
  await expect(strip).toHaveAttribute('aria-valuetext', /: ₱/)
  await page.keyboard.press('Escape')
  await expect(dayHeading).toHaveText('Today')

  // A tap on the first day's column picks it.
  await strip.click({ position: { x: 2, y: box!.height / 2 } })
  await expect(strip).toHaveAttribute('aria-valuenow', '1')
  await expect(dayHeading).not.toHaveText('Today')
})
