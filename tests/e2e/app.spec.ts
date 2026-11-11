import { test, expect, type Browser, type Page } from '@playwright/test'

// Critical journeys. Every test signs up its own household, so tests never share data.

let seq = 0
const uniqueEmail = (tag = 'u') => `${tag}-${Date.now()}-${process.pid}-${seq++}@example.com`

async function ready(page: Page, path = '/app') {
  await page.goto(path, { waitUntil: 'networkidle' })
}

async function signUp(page: Page, opts: { name?: string, skipSetup?: boolean } = {}) {
  const email = uniqueEmail()
  await ready(page, '/login')
  await page.getByRole('button', { name: 'New', exact: true }).click()
  await page.getByLabel('Your name').fill(opts.name ?? 'Luigi')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill('password123')
  await page.getByRole('button', { name: 'Create household' }).click()
  await expect(page.getByRole('heading', { name: 'Set up in 20 seconds' })).toBeVisible()
  if (opts.skipSetup !== false) await page.getByRole('button', { name: 'Skip' }).click()
  return email
}

/** The sheet slides in for 200 ms; clicking inside it before that can land on a moving target. */
async function sheetSettled(page: Page) {
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await dialog.evaluate((d) => Promise.all(d.getAnimations({ subtree: true }).map((a) => a.finished)))
}

async function addExpense(page: Page, amount: string, note: string, category: string) {
  await page.getByRole('button', { name: /Add expense/ }).first().click()
  await sheetSettled(page)
  const amountField = page.getByRole('dialog').getByLabel('Amount', { exact: true })
  await expect(amountField).toBeFocused()
  await amountField.fill(amount)
  await page.getByRole('combobox', { name: /What for/ }).fill(note)
  await page.getByRole('button', { name: category, exact: true }).click()
  await page.getByRole('button', { name: 'Save', exact: true }).click()
}

/** Wait until every queued change has reached the server. */
async function synced(page: Page) {
  await expect(page.getByText(/Saving…|waiting/)).toHaveCount(0)
  await page.waitForLoadState('networkidle')
}

const todayRegion = (page: Page) => page.getByRole('region', { name: 'Today' })

test('signed-out visitors are sent to sign in, and the API refuses them', async ({ page, request }) => {
  await ready(page, '/app/insights')
  await expect(page).toHaveURL(/\/login\?next=(%2F|\/)app(%2F|\/)insights/)
  const res = await request.get('/api/bootstrap')
  expect(res.status()).toBe(401)
  expect((await res.json()).data.code).toBe('UNAUTHENTICATED')
})

test('a new household starts in pesos, whatever the browser language', async ({ browser }) => {
  const ctx = await browser.newContext({ locale: 'en-US' })
  const page = await ctx.newPage()
  await signUp(page, { skipSetup: false })
  await expect(page.getByLabel('Currency')).toHaveValue('PHP')
  await page.getByRole('button', { name: 'Skip' }).click()
  await expect(page.getByText('₱0.00').first()).toBeVisible()
  await ctx.close()
})

test('sign up, set up, and the daily allowance appears', async ({ page }) => {
  await signUp(page, { skipSetup: false })
  await page.getByLabel(/Monthly spending budget/).fill('30000')
  await page.getByRole('button', { name: 'Start tracking' }).click()
  await expect(page.getByRole('heading', { name: 'Safe to spend today' })).toBeVisible()
})

test('sign out, then sign in again with the same account', async ({ page }) => {
  const email = await signUp(page)
  await addExpense(page, '26', 'Jeepney', 'Transport')
  await synced(page)
  await ready(page, '/app/settings')
  await page.getByRole('button', { name: 'Sign out' }).click()
  await expect(page).toHaveURL(/\/login/)
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill('wrong-password')
  await page.getByRole('button', { name: 'Sign in', exact: true }).last().click()
  await expect(page.getByRole('alert')).toContainText('Email or password is incorrect')
  await page.getByLabel('Password').fill('password123')
  await page.getByRole('button', { name: 'Sign in', exact: true }).last().click()
  await expect(todayRegion(page).getByText('Jeepney')).toBeVisible()
})

test('add an expense, edit it, delete and undo, and it is all saved on the server', async ({ page }) => {
  await signUp(page)
  await addExpense(page, '120+45', 'Lunch', 'Food & dining')
  await expect(todayRegion(page).getByRole('button', { name: /Lunch.*165\.00/ })).toBeVisible()

  await todayRegion(page).getByRole('button', { name: /Lunch/ }).click()
  await sheetSettled(page)
  await page.getByRole('dialog').getByLabel('Amount', { exact: true }).fill('200')
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(todayRegion(page).getByRole('button', { name: /Lunch.*200\.00/ })).toBeVisible()

  await todayRegion(page).getByRole('button', { name: /Lunch/ }).click()
  await sheetSettled(page)
  await page.getByRole('button', { name: 'Delete' }).click()
  await expect(todayRegion(page).getByText('Lunch')).toHaveCount(0)
  await page.getByRole('button', { name: 'Undo' }).click()
  await synced(page)

  // A fresh device (no local cache) sees the server's copy.
  await page.evaluate(() => localStorage.clear())
  await ready(page)
  await expect(todayRegion(page).getByRole('button', { name: /Lunch.*200\.00/ })).toBeVisible()
})

test('a settings change survives reloading right away', async ({ page }) => {
  await signUp(page, { skipSetup: false })
  await page.getByRole('button', { name: 'Skip' }).click()
  await page.reload({ waitUntil: 'networkidle' }) // well inside the 600 ms save delay
  await synced(page)
  await page.evaluate(() => localStorage.removeItem('tingbits:cache:v2'))
  await ready(page)
  await expect(page.getByRole('heading', { name: /Spent today|Safe to spend/ })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Set up in 20 seconds' })).toHaveCount(0)
})

test('validation explains what is missing', async ({ page }) => {
  await signUp(page)
  await page.getByRole('button', { name: /Add expense/ }).first().click()
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByText('Enter an amount above zero.')).toBeVisible()
  await expect(page.getByText('Pick a category.')).toBeVisible()
})

test('frequent entries become one-tap adds', async ({ page }) => {
  await signUp(page)
  await addExpense(page, '150', 'Coffee', 'Food & dining')
  await addExpense(page, '150', 'Coffee', 'Food & dining')
  await page.getByRole('region', { name: 'One-tap add' }).getByRole('button', { name: /Coffee/ }).click()
  await expect(todayRegion(page).getByText('Coffee')).toHaveCount(3)
})

test('history search asks the server and finds matching entries', async ({ page }) => {
  await signUp(page)
  await addExpense(page, '3120', 'Meralco', 'Bills & utilities')
  await addExpense(page, '245', 'Grab', 'Transport')
  await synced(page)
  await ready(page, '/app/history')
  await page.getByLabel('Search all entries').fill('meral')
  await expect(page.getByText('Meralco')).toBeVisible()
  await expect(page.getByText('Grab')).toHaveCount(0)
  await expect(page.getByText('Searching all time')).toBeVisible()
})

test('a manual recurring bill shows as due and can be marked paid', async ({ page }) => {
  await signUp(page)
  await ready(page, '/app/plan')
  await page.getByRole('button', { name: 'Add', exact: true }).click()
  await sheetSettled(page)
  await page.getByRole('dialog').getByLabel('Name').fill('PLDT Fiber')
  await page.getByRole('dialog').getByLabel('Amount', { exact: true }).fill('1899')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await page.getByRole('link', { name: 'Today' }).first().click()
  const due = page.getByRole('region', { name: 'Bills due' })
  await due.getByRole('button', { name: 'Mark paid' }).click()
  await expect(due).toHaveCount(0)
  await expect(todayRegion(page).getByText('PLDT Fiber')).toBeVisible()
  await synced(page)
  await page.evaluate(() => localStorage.clear())
  await ready(page)
  await expect(todayRegion(page).getByText('PLDT Fiber')).toBeVisible()
  await expect(page.getByRole('region', { name: 'Bills due' })).toHaveCount(0)
})

test('an automatic recurring item dated yesterday is posted by the server', async ({ page }) => {
  await signUp(page)
  await ready(page, '/app/plan')
  await page.getByRole('button', { name: 'Add', exact: true }).click()
  await sheetSettled(page)
  await page.getByRole('dialog').getByLabel('Name').fill('Rent')
  await page.getByRole('dialog').getByLabel('Amount', { exact: true }).fill('12000')
  const d = new Date(); d.setDate(d.getDate() - 1)
  const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  await page.getByLabel('Next due').fill(iso)
  await page.getByLabel(/Log it automatically/).check()
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await synced(page)
  await ready(page, '/app/history')
  await expect(page.getByRole('button', { name: /Rent/ })).toBeVisible()
})

async function joinWithInvite(browser: Browser, code: string) {
  const ctx = await browser.newContext()
  const page = await ctx.newPage()
  await ready(page, '/login')
  await page.getByRole('button', { name: 'Join', exact: true }).click()
  await page.getByLabel('Invite code').fill(code)
  await page.getByLabel('Your name').fill('Partner')
  await page.getByLabel('Email').fill(uniqueEmail('partner'))
  await page.getByLabel('Password').fill('password123')
  await page.getByRole('button', { name: 'Join household' }).click()
  return { ctx, page }
}

test('a partner joins with the invite code and shares the same ledger', async ({ page, browser }) => {
  await signUp(page)
  await addExpense(page, '2340', 'Puregold', 'Groceries')
  await synced(page)
  await ready(page, '/app/settings')
  const code = (await page.getByTestId('invite-code').innerText()).trim()

  const partner = await joinWithInvite(browser, code)
  await expect(todayRegion(partner.page).getByText('Puregold')).toBeVisible()
  await addExpense(partner.page, '180', 'Lunch', 'Food & dining')
  await synced(partner.page)

  await ready(page)
  await expect(todayRegion(page).getByText('Lunch')).toBeVisible()
  await todayRegion(page).getByRole('button', { name: /Lunch/ }).click()
  await sheetSettled(page)
  await expect(page.getByText('Added by Partner')).toBeVisible()
  await partner.ctx.close()
})

test('a different household cannot see the data', async ({ page, browser }) => {
  await signUp(page)
  await addExpense(page, '999', 'Private thing', 'Shopping')
  await synced(page)
  const other = await browser.newContext()
  const otherPage = await other.newPage()
  await signUp(otherPage, { name: 'Stranger' })
  await ready(otherPage, '/app/history')
  await otherPage.getByLabel('Search all entries').fill('Private')
  await expect(otherPage.getByText('No entries match.')).toBeVisible()
  await other.close()
})

test('works offline: changes wait on the device and sync when back online', async ({ page, context }) => {
  await signUp(page)
  await synced(page)
  await context.setOffline(true)
  await addExpense(page, '45', 'Taho', 'Food & dining')
  await expect(todayRegion(page).getByText('Taho')).toBeVisible()
  await expect(page.locator('[role=status]:visible', { hasText: /Offline, \d+ changes? waiting/ })).toBeVisible()
  await context.setOffline(false)
  await page.evaluate(() => window.dispatchEvent(new Event('online')))
  await synced(page)
  await page.evaluate(() => localStorage.clear())
  await ready(page)
  await expect(todayRegion(page).getByText('Taho')).toBeVisible()
})

test('data from the earlier offline-only version can be added to the household', async ({ page }) => {
  await signUp(page)
  await page.evaluate(() => {
    const d = new Date(); const pad = (n: number) => String(n).padStart(2, '0')
    const today = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
    localStorage.setItem('bacli-expenses:v1', JSON.stringify({
      version: 1,
      transactions: [{ id: 'legacy-1', type: 'expense', amount: 56000, categoryId: 'health', note: 'Mercury Drug', date: today, memberId: 'me', methodId: 'cash', recurringId: null, createdAt: 1 }],
      categories: [], members: [{ id: 'me', name: 'Me' }], methods: [], recurring: [], settings: {},
    }))
  })
  await ready(page, '/app/settings')
  await page.getByRole('button', { name: 'Add them to the household' }).click()
  await page.getByRole('button', { name: 'Add entries' }).click()
  await expect(page.getByText(/Added 1 entries/)).toBeVisible()
  await ready(page)
  await expect(todayRegion(page).getByText('Mercury Drug')).toBeVisible()
})

test('backup file from one household imports into another', async ({ page, browser }) => {
  await signUp(page)
  await addExpense(page, '560', 'Watsons', 'Health')
  await synced(page)
  await ready(page, '/app/settings')
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('link', { name: /Back up/ }).click()])
  const file = await download.path()

  const ctx = await browser.newContext()
  const fresh = await ctx.newPage()
  await signUp(fresh, { name: 'Other' })
  await ready(fresh, '/app/settings')
  await fresh.getByLabel('Backup file').setInputFiles(file)
  await fresh.getByRole('button', { name: 'Add entries' }).click()
  await expect(fresh.getByText(/Added 1 entries/)).toBeVisible()
  await ready(fresh)
  await expect(todayRegion(fresh).getByText('Watsons')).toBeVisible()
  await ctx.close()
})

test('import rejects a file that is not a backup', async ({ page }) => {
  await signUp(page)
  await ready(page, '/app/settings')
  await page.getByLabel('Backup file').setInputFiles({ name: 'x.json', mimeType: 'application/json', buffer: Buffer.from('{"hello":1}') })
  await expect(page.getByText('That file is not a Tingbits backup.')).toBeVisible()
})

test('every screen renders without console errors', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
  await signUp(page)
  for (const path of ['/app', '/app/history', '/app/insights', '/app/plan', '/app/settings']) await ready(page, path)
  expect(errors).toEqual([])
})

test('voice: no em dashes in visible copy', async ({ page }) => {
  await signUp(page)
  for (const path of ['/app', '/app/history', '/app/insights', '/app/plan', '/app/settings']) {
    await ready(page, path)
    expect((await page.locator('body').innerText()).includes('—'), path).toBe(false)
  }
})

test('security headers are sent and no CSP violations occur', async ({ page, request }) => {
  const h = (await request.get('/login')).headers()
  expect(h['content-security-policy']).toContain("default-src 'self'")
  expect(h['x-frame-options']).toBe('DENY')
  expect(h['x-content-type-options']).toBe('nosniff')
  await page.addInitScript(() => {
    ;(window as unknown as { __csp: string[] }).__csp = []
    document.addEventListener('securitypolicyviolation', (e) => (window as unknown as { __csp: string[] }).__csp.push(e.violatedDirective))
  })
  await signUp(page)
  for (const path of ['/', '/app', '/app/insights', '/app/settings']) {
    await ready(page, path)
    expect(await page.evaluate(() => (window as unknown as { __csp: string[] }).__csp), path).toEqual([])
  }
})

test('cross-site form posts to the API are blocked', async ({ request }) => {
  const res = await request.post('/api/auth/login', { form: { email: 'a@b.co', password: 'x' } })
  expect(res.status()).toBe(415)
})

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' })
  test('add sheet opens and works', async ({ page }) => {
    await signUp(page)
    await addExpense(page, '99', 'Snack', 'Food & dining')
    await expect(page.getByText('Snack')).toBeVisible()
  })
})

/* ---------- Landing page (public) ---------- */

test.describe('landing page', () => {
  test('is server-rendered: headline and price show without JavaScript', async ({ browser }) => {
    const ctx = await browser.newContext({ javaScriptEnabled: false })
    const page = await ctx.newPage()
    await page.goto('/')
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Know what your family can spend today')
    await expect(page.getByText('₱150').first()).toBeVisible()
    await ctx.close()
  })

  test('is indexable, while the app and sign-in are not', async ({ request }) => {
    const landing = await request.get('/')
    expect(landing.headers()['x-robots-tag']).toBeUndefined()
    expect(await landing.text()).not.toContain('noindex')
    expect((await request.get('/app')).headers()['x-robots-tag']).toContain('noindex')
    expect((await request.get('/login')).headers()['x-robots-tag']).toContain('noindex')
    expect(await (await request.get('/robots.txt')).text()).toContain('Disallow: /app')
  })

  test('describes the product and its ₱150 price to search engines', async ({ page }) => {
    await page.goto('/')
    const ld = JSON.parse(await page.locator('script[type="application/ld+json"]').innerText())
    expect(ld).toMatchObject({ '@type': 'SoftwareApplication', name: 'Tingbits Expense Tracker', offers: { price: '150', priceCurrency: 'PHP' } })
    await expect(page).toHaveTitle(/Tingbits Expense Tracker/)
  })

  test('explains the name for visitors who don’t speak Bisaya', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' })
    await expect(page.getByTestId('definition')).toContainText('the broke days before payday')
    await page.getByText('What does “tingbits” mean?').click()
    await expect(page.getByText('Bisaya (Cebuano) slang for the broke days before payday')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Goodbye, tingbits.' })).toBeVisible()
  })

  test('the calculator answers with the visitor’s own numbers', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' })
    const result = page.getByTestId('calc-result').locator('[aria-hidden="true"]') // the visible, settling number
    await page.getByLabel('Budget until payday (₱)').fill('10000')
    await page.getByLabel('Spent so far (₱)').fill('10000')
    await expect(result).toHaveText('₱0')
    await expect(page.getByText('Already over budget for this payday.')).toBeVisible()
    await page.getByLabel('Spent so far (₱)').fill('0')
    await expect(result).not.toHaveText('₱0')
  })

  test('"Start your free trial" opens the create-household form', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' })
    await page.getByRole('link', { name: 'Start your 30-day free trial' }).first().click()
    await expect(page.getByRole('heading', { name: 'Create a household' })).toBeVisible()
  })

  test('a signed-in visitor is offered "Open app"', async ({ page }) => {
    await signUp(page)
    await page.goto('/', { waitUntil: 'networkidle' })
    await page.getByRole('link', { name: 'Open app' }).click()
    await expect(page).toHaveURL(/\/app$/)
  })

  test('voice and quality: no em dashes, no console errors, no CSP violations', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
    await page.addInitScript(() => {
      ;(window as unknown as { __csp: string[] }).__csp = []
      document.addEventListener('securitypolicyviolation', (e) => (window as unknown as { __csp: string[] }).__csp.push(e.violatedDirective))
    })
    await page.goto('/', { waitUntil: 'networkidle' })
    expect((await page.locator('body').innerText()).includes('\u2014')).toBe(false)
    expect(await page.locator('.eyebrow').count()).toBeLessThanOrEqual(1)
    expect(await page.evaluate(() => (window as unknown as { __csp: string[] }).__csp)).toEqual([])
    expect(errors).toEqual([])
  })
})

/* ---------- Motion QA (kit motion/07): Level 1, functional feedback only ---------- */

test.describe('motion', () => {
  test('the safe-to-spend figure settles exactly on the real value after an entry', async ({ page }) => {
    await signUp(page, { skipSetup: false })
    await page.getByLabel(/Monthly spending budget/).fill('30000')
    await page.getByRole('button', { name: 'Start tracking' }).click()
    await addExpense(page, '500', 'Groceries run', 'Groceries')
    const hero = page.getByTestId('safe-to-spend')
    const finalText = (await hero.locator('.sr-only').innerText()).trim()
    await expect(hero.locator('[aria-hidden="true"]')).toHaveText(finalText)
  })

  test('animation causes no layout shift on the landing page or the app', async ({ page }) => {
    const cls = async () => page.evaluate(() => new Promise<number>((resolve) => {
      let total = 0
      new PerformanceObserver((list) => {
        for (const e of list.getEntries() as Array<PerformanceEntry & { value: number, hadRecentInput: boolean }>) if (!e.hadRecentInput) total += e.value
      }).observe({ type: 'layout-shift', buffered: true })
      setTimeout(() => resolve(total), 600)
    }))
    await page.goto('/', { waitUntil: 'networkidle' })
    await page.getByLabel('Spent so far (₱)').fill('25000')
    expect(await cls()).toBeLessThan(0.1)
    await signUp(page)
    await addExpense(page, '150', 'Coffee', 'Food & dining')
    expect(await cls()).toBeLessThan(0.1)
  })

  test.describe('reduced motion', () => {
    test.use({ reducedMotion: 'reduce' })
    test('nothing with text is left invisible, and numbers show their final value at once', async ({ page }) => {
      await page.goto('/', { waitUntil: 'networkidle' })
      await page.getByLabel('Spent so far (₱)').fill('0')
      const visible = page.getByTestId('calc-result').locator('[aria-hidden="true"]')
      const final = (await page.getByTestId('calc-result').locator('.sr-only').innerText()).trim()
      expect((await visible.innerText()).trim()).toBe(final)        // no tween under reduced motion
      for (const path of ['/', '/app']) {
        if (path === '/app') await signUp(page)
        else await page.goto(path, { waitUntil: 'networkidle' })
        const hidden = await page.$$eval('main *', (els) => els.filter((el) => getComputedStyle(el).opacity === '0' && el.textContent?.trim()).length)
        expect(hidden, path).toBe(0)
      }
    })
  })
})
