import { execFile } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { promisify } from 'node:util'
import { test, expect, type Page } from '@playwright/test'
import mongoose from 'mongoose'

// Trial and subscription. Time-dependent states are set directly in the throwaway test database
// started by scripts/e2e-server.mjs (never the real one).

let seq = 0
const uniqueEmail = () => `sub-${Date.now()}-${process.pid}-${seq++}@example.com`
const DAY = 86_400_000

test.beforeAll(async () => {
  await mongoose.connect(readFileSync('node_modules/.cache/tingbits-e2e-db-uri', 'utf8'))
})
test.afterAll(async () => { await mongoose.disconnect() })

const db = () => mongoose.connection.db!
async function householdOf(email: string) {
  const user = await db().collection('users').findOne({ email })
  return user!.household as mongoose.Types.ObjectId
}
async function setDates(email: string, set: Record<string, Date | null>, unset: string[] = []) {
  await db().collection('households').updateOne({ _id: await householdOf(email) }, { $set: set, ...(unset.length ? { $unset: Object.fromEntries(unset.map((k) => [k, ''])) } : {}) })
}

async function signUp(page: Page) {
  const email = uniqueEmail()
  await page.goto('/login', { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: 'New', exact: true }).click()
  await page.getByLabel('Your name').fill('Owner')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill('password123')
  await page.getByRole('button', { name: 'Create household' }).click()
  await page.getByRole('button', { name: 'Skip' }).click()
  return email
}
async function addEntry(page: Page, note: string) {
  await page.getByRole('button', { name: /Add expense/ }).first().click()
  const dialog = page.getByRole('dialog')
  await dialog.evaluate((d) => Promise.all(d.getAnimations({ subtree: true }).map((a) => a.finished)))
  await dialog.getByLabel('Amount', { exact: true }).fill('100')
  await page.getByRole('combobox', { name: /What for/ }).fill(note)
  await page.getByRole('button', { name: 'Food & dining', exact: true }).click()
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByText('Saving…')).toHaveCount(0)
}
const reload = async (page: Page, path = '/app') => {
  await page.evaluate(() => localStorage.removeItem('tingbits:cache:v2'))
  await page.goto(path, { waitUntil: 'networkidle' })
}

test('a new household starts a 30-day free trial with no card', async ({ page }) => {
  await signUp(page)
  await page.goto('/app/settings', { waitUntil: 'networkidle' })
  await expect(page.getByTestId('plan-status')).toHaveText(/Free trial · 30 days left/)
  await expect(page.getByText('No card needed until then.')).toBeVisible()
  await expect(page.getByTestId('readonly-banner')).toHaveCount(0)
})

test('after the trial the household is read-only: view and export yes, new entries no', async ({ page }) => {
  const email = await signUp(page)
  await addEntry(page, 'Before expiry')
  await setDates(email, { trialEndsAt: new Date(Date.now() - DAY) })
  await reload(page)

  await expect(page.getByTestId('readonly-banner')).toContainText('Your free trial has ended')
  await expect(page.getByText('Before expiry')).toBeVisible()                  // still viewable
  await page.getByRole('button', { name: /Add expense/ }).first().click()      // sheet refuses to open
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByText('Subscribe in Settings to keep adding entries').first()).toBeVisible()

  // The server enforces it too, whatever the client does.
  const api = page.request
  const res = await api.post('/api/transactions', { data: { id: `x-${Date.now()}`, type: 'expense', amount: 100, categoryId: 'food', note: 'sneaky', date: '2026-11-10', memberId: null, methodId: null } })
  expect(res.status()).toBe(402)
  expect((await res.json()).data.code).toBe('SUBSCRIPTION_REQUIRED')
  expect((await api.get('/api/export')).status()).toBe(200)                     // export still allowed
  await page.goto('/app/settings', { waitUntil: 'networkidle' })
  await expect(page.getByTestId('plan-status')).toHaveText('Read-only')
})

test('a read-only household gets no automatic recurring entries', async ({ page }) => {
  const email = await signUp(page)
  await setDates(email, { trialEndsAt: new Date(Date.now() - DAY) })
  const yesterday = new Date(Date.now() - DAY).toISOString().slice(0, 10)
  await db().collection('recurrings').insertOne({ _id: `rent-${Date.now()}` as never, household: await householdOf(email), type: 'expense', amount: 1200000, categoryId: 'home', note: 'Rent while expired', memberId: null, methodId: null, frequency: 'monthly', nextDate: yesterday, auto: true, active: true })
  await reload(page, '/app/history')
  await expect(page.getByTestId('readonly-banner')).toBeVisible()
  await expect(page.getByText('Rent while expired')).toHaveCount(0)
})

test('paying (manual activation script) makes it active again', async ({ page }) => {
  const email = await signUp(page)
  await setDates(email, { trialEndsAt: new Date(Date.now() - DAY) })
  const run = (args: string[]) => promisify(execFile)(process.execPath, ['scripts/grant-subscription.mjs', email, ...args], {
    env: { ...process.env, MONGODB_URI: readFileSync('node_modules/.cache/tingbits-e2e-db-uri', 'utf8') },
  })
  const dry = await run(['1'])
  expect(dry.stdout).toContain('Dry run')
  await reload(page)
  await expect(page.getByTestId('readonly-banner')).toBeVisible()                // dry run changed nothing

  const real = await run(['1', '--yes'])
  expect(real.stdout).toContain('Done.')
  await reload(page)
  await expect(page.getByTestId('readonly-banner')).toHaveCount(0)
  await addEntry(page, 'After paying')
  await reload(page)
  await expect(page.getByText('After paying')).toBeVisible()
  await page.goto('/app/settings', { waitUntil: 'networkidle' })
  await expect(page.getByTestId('plan-status')).toHaveText('Active')
})

test('a household created before billing gets a full trial from now', async ({ page }) => {
  const email = await signUp(page)
  await setDates(email, {}, ['trialEndsAt'])
  await reload(page, '/app/settings')
  await expect(page.getByTestId('plan-status')).toHaveText(/Free trial · 30 days left/)
})

test('members see who to ask; only the owner sees the plan button', async ({ page, browser }) => {
  const email = await signUp(page)
  await page.goto('/app/settings', { waitUntil: 'networkidle' })
  const code = (await page.getByTestId('invite-code').innerText()).trim()
  await setDates(email, { trialEndsAt: new Date(Date.now() - DAY) })

  const ctx = await browser.newContext()
  const member = await ctx.newPage()
  await member.goto('/login', { waitUntil: 'networkidle' })
  await member.getByRole('button', { name: 'Join', exact: true }).click()
  await member.getByLabel('Invite code').fill(code)
  await member.getByLabel('Your name').fill('Partner')
  await member.getByLabel('Email').fill(uniqueEmail())
  await member.getByLabel('Password').fill('password123')
  await member.getByRole('button', { name: 'Join household' }).click()
  await expect(member.getByTestId('readonly-banner')).toContainText('Ask Owner to subscribe')
  await expect(member.getByTestId('readonly-banner').getByRole('link', { name: 'See plan' })).toHaveCount(0)
  await ctx.close()
})
