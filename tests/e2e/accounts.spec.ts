import { test, expect, type Browser, type Page } from '@playwright/test'

// Account management (business rules A7 to A10). Each test signs up its own household.

let seq = 0
const uniqueEmail = (tag = 'u') => `${tag}-${Date.now()}-${process.pid}-${seq++}@example.com`
const PW = 'password123'

async function ready(page: Page, path = '/app') {
  await page.goto(path, { waitUntil: 'networkidle' })
}

async function signUp(page: Page) {
  const email = uniqueEmail()
  await ready(page, '/login')
  await page.getByRole('button', { name: 'New', exact: true }).click()
  await page.getByLabel('Your name').fill('Luigi')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(PW)
  await page.getByRole('button', { name: 'Create household' }).click()
  await page.getByRole('button', { name: 'Skip' }).click()
  return email
}

async function inviteCode(page: Page) {
  await ready(page, '/app/settings')
  return (await page.getByTestId('invite-code').innerText()).trim()
}

async function join(browser: Browser, code: string) {
  const ctx = await browser.newContext()
  const page = await ctx.newPage()
  const email = uniqueEmail('partner')
  await ready(page, '/login')
  await page.getByRole('button', { name: 'Join', exact: true }).click()
  await page.getByLabel('Invite code').fill(code)
  await page.getByLabel('Your name').fill('Partner')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(PW)
  await page.getByRole('button', { name: 'Join household' }).click()
  await expect(page).toHaveURL(/\/app$/)
  return { ctx, page, email }
}

async function signIn(page: Page, email: string, password: string) {
  await ready(page, '/login')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Sign in', exact: true }).last().click()
}

const accounts = (page: Page) => page.getByTestId('accounts')

test('the owner hands the household to a partner, then leaves', async ({ page, browser }) => {
  await signUp(page)
  const partner = await join(browser, await inviteCode(page))

  await ready(page, '/app/settings')
  await page.getByRole('button', { name: 'Make Partner the owner' }).click()
  await page.getByLabel('Your password').fill('wrong-password')
  await page.getByRole('button', { name: 'Make owner', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('That password is not right')
  await page.getByLabel('Your password').fill(PW)
  await page.getByRole('button', { name: 'Make owner', exact: true }).click()
  await expect(page.getByText('Partner is now the owner')).toBeVisible()
  await expect(page.getByTestId('invite-code')).toHaveCount(0)
  await expect(accounts(page).getByRole('listitem').filter({ hasText: 'Partner' })).toContainText('Owner')

  // The new owner sees the owner tools on their next load.
  await ready(partner.page, '/app/settings')
  await expect(partner.page.getByTestId('invite-code')).toBeVisible()

  // The former owner, now a member, can delete their own account.
  await page.getByRole('button', { name: 'Delete my account' }).click()
  await expect(page.getByTestId('delete-warning')).toContainText('Entries you added stay')
  await page.getByLabel('Your password').fill(PW)
  await page.getByRole('button', { name: 'Delete my account' }).click()
  await expect(page).toHaveURL(/\/login\?deleted=account/)
  await expect(page.getByTestId('deleted-notice')).toHaveText('Your account was deleted.')

  await ready(partner.page, '/app/settings')
  await expect(accounts(partner.page).getByRole('listitem')).toHaveCount(1)
  await partner.ctx.close()
})

test('the owner removes a member, who is signed out at once', async ({ page, browser }) => {
  await signUp(page)
  const partner = await join(browser, await inviteCode(page))

  await ready(page, '/app/settings')
  await page.getByRole('button', { name: "Remove Partner's account" }).click()
  await expect(page.getByText('They can no longer sign in')).toBeVisible()
  await page.getByRole('button', { name: 'Remove account', exact: true }).click()
  await expect(page.getByText('Partner was removed from the household')).toBeVisible()
  await expect(accounts(page).getByRole('listitem')).toHaveCount(1)

  await partner.page.reload({ waitUntil: 'networkidle' })
  await expect(partner.page).toHaveURL(/\/login/)
  await signIn(partner.page, partner.email, PW)
  await expect(partner.page.getByRole('alert')).toContainText('Email or password is incorrect')
  await partner.ctx.close()
})

test('an owner who shares the household must hand it over before deleting', async ({ page, browser }) => {
  await signUp(page)
  const partner = await join(browser, await inviteCode(page))
  await ready(page, '/app/settings')
  await page.getByRole('button', { name: 'Delete my account' }).click()
  await expect(page.getByTestId('delete-blocked')).toContainText('Make someone else the owner first')
  await partner.ctx.close()
})

test('a sole owner deletes the account and the household for good', async ({ page }) => {
  const email = await signUp(page)
  await ready(page, '/app/settings')
  await page.getByRole('button', { name: 'Delete my account' }).click()
  await expect(page.getByTestId('delete-warning')).toContainText('all its entries')
  await expect(page.getByRole('button', { name: 'Delete account and household' })).toBeDisabled()
  await page.getByLabel('Your password').fill(PW)
  await page.getByRole('button', { name: 'Delete account and household' }).click()
  await expect(page).toHaveURL(/\/login\?deleted=household/)
  await expect(page.getByTestId('deleted-notice')).toHaveText('Your account and household were deleted.')
  // Nothing is left on this device, and the account is gone from the server.
  expect(await page.evaluate(() => localStorage.getItem('tingbits:cache:v2'))).toBeNull()
  await signIn(page, email, PW)
  await expect(page.getByRole('alert')).toContainText('Email or password is incorrect')
})

test('change password, then sign in with the new one', async ({ page }) => {
  const email = await signUp(page)
  await ready(page, '/app/settings')
  await page.getByRole('button', { name: 'Change password' }).click()
  await page.getByLabel('Current password').fill('wrong-password')
  await page.getByLabel('New password').fill('new-password-1')
  await page.getByRole('button', { name: 'Save password' }).click()
  await expect(page.getByText('That password is not right')).toBeVisible()
  await expect(page.getByLabel('Current password')).toHaveAttribute('aria-invalid', 'true')
  await page.getByLabel('Current password').fill(PW)
  await page.getByRole('button', { name: 'Save password' }).click()
  await expect(page.getByText('Password changed')).toBeVisible()

  await page.getByRole('button', { name: 'Sign out' }).click()
  await expect(page).toHaveURL(/\/login/)
  await signIn(page, email, 'new-password-1')
  await expect(page).toHaveURL(/\/app$/)
})

test('the account API refuses members and other households', async ({ page, browser }) => {
  await signUp(page)
  const partner = await join(browser, await inviteCode(page))
  // A member cannot remove the owner or take ownership.
  const ownerId = await page.evaluate(async () => (await (await fetch('/api/bootstrap')).json()).user.id)
  const asMember = partner.page.request
  const remove = await asMember.delete(`/api/household/accounts/${ownerId}`)
  expect(remove.status()).toBe(403)
  const take = await asMember.post('/api/household/owner', { data: { accountId: ownerId, password: PW } })
  expect(take.status()).toBe(403)
  const noConfirm = await asMember.delete('/api/me', { data: { password: PW } })
  expect(noConfirm.status()).toBe(400)
  await partner.ctx.close()
})

test('changing the password signs out other devices but keeps this one signed in', async ({ page, browser }) => {
  const email = await signUp(page)
  // A second device signed in to the same account.
  const other = await browser.newContext()
  const phone = await other.newPage()
  await signIn(phone, email, PW)
  await expect(phone).toHaveURL(/\/app$/)

  await ready(page, '/app/settings')
  await page.getByRole('button', { name: 'Change password' }).click()
  await page.getByLabel('Current password').fill(PW)
  await page.getByLabel('New password').fill('new-password-1')
  await page.getByRole('button', { name: 'Save password' }).click()
  await expect(page.getByText('Password changed')).toBeVisible()

  // The other device is sent to sign in on its next request, and its old cookie is refused.
  await phone.reload({ waitUntil: 'networkidle' })
  await expect(phone).toHaveURL(/\/login/)
  expect((await phone.request.get('/api/bootstrap')).status()).toBe(401)

  // This device stays signed in.
  await ready(page, '/app')
  await expect(page).toHaveURL(/\/app$/)
  expect((await page.request.get('/api/bootstrap')).status()).toBe(200)
  await other.close()
})
