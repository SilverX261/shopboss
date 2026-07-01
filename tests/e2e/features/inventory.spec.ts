import { test, expect } from '@playwright/test'
import { LoginPage } from '../pages/LoginPage'
import { TEST_CREDENTIALS } from '../../fixtures/auth'

test.describe('Inventory', () => {
  test.beforeEach(async ({ page }) => {
    const loginPage = new LoginPage(page)
    await loginPage.goto()
    await loginPage.login(TEST_CREDENTIALS.email, TEST_CREDENTIALS.password)
    await page.waitForURL('**/dashboard**', { timeout: 15000 })
    await page.goto('/inventory')
    await page.waitForLoadState('networkidle')
  })

  test('inventory page loads', async ({ page }) => {
    expect(page.url()).toContain('/inventory')
    const heading = page.locator('h1, h2, [data-testid="page-title"]')
    await expect(heading.first()).toBeVisible()
  })

  test('has add inventory button', async ({ page }) => {
    const addButton = page.locator('a[href*="inventory/add"], button:has-text("Add"), [data-testid="add-btn"]')
    await expect(addButton.first()).toBeVisible()
  })

  test('inventory list or empty state is visible', async ({ page }) => {
    const content = page.locator('table, [data-testid="inventory-list"], [data-testid="empty-state"], .empty-state, p:has-text("No"), p:has-text("empty")')
    await expect(content.first()).toBeVisible({ timeout: 8000 })
  })

  test('add inventory page loads', async ({ page }) => {
    await page.goto('/inventory/add')
    await page.waitForLoadState('networkidle')
    expect(page.url()).toContain('/inventory/add')
    const form = page.locator('form, [data-testid="add-form"]')
    await expect(form.first()).toBeVisible()
  })
})
