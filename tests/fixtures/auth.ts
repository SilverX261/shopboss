import { test as base, Page } from '@playwright/test'

export const TEST_CREDENTIALS = {
  email: process.env.TEST_USER_EMAIL || 'test@shopboss.test',
  password: process.env.TEST_USER_PASSWORD || 'TestPassword123!',
  shopName: 'Test Shop',
}

async function loginAsOwner(page: Page) {
  await page.goto('/login')
  await page.waitForLoadState('networkidle')
  await page.locator('input[type="email"]').fill(TEST_CREDENTIALS.email)
  await page.locator('input[type="password"]').fill(TEST_CREDENTIALS.password)
  await page.locator('button[type="submit"]').click()
  await page.waitForURL('**/dashboard**', { timeout: 15000 })
}

export const test = base.extend<{ authenticatedPage: Page }>({
  authenticatedPage: async ({ page }, use) => {
    await loginAsOwner(page)
    await use(page)
  },
})

export { expect } from '@playwright/test'
