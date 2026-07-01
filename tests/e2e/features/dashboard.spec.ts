import { test, expect } from '@playwright/test'
import { LoginPage } from '../pages/LoginPage'
import { DashboardPage } from '../pages/DashboardPage'
import { TEST_CREDENTIALS } from '../../fixtures/auth'

test.describe('Dashboard', () => {
  let dashboardPage: DashboardPage

  test.beforeEach(async ({ page }) => {
    const loginPage = new LoginPage(page)
    await loginPage.goto()
    await loginPage.login(TEST_CREDENTIALS.email, TEST_CREDENTIALS.password)
    await page.waitForURL('**/dashboard**', { timeout: 15000 })
    dashboardPage = new DashboardPage(page)
  })

  test('shows sidebar navigation', async ({ page }) => {
    await expect(dashboardPage.sidebar).toBeVisible()
  })

  test('has inventory navigation link', async ({ page }) => {
    await expect(dashboardPage.inventoryLink).toBeVisible()
  })

  test('has sales navigation link', async ({ page }) => {
    await expect(dashboardPage.salesLink).toBeVisible()
  })

  test('has udhaar navigation link', async ({ page }) => {
    await expect(dashboardPage.udhaarLink).toBeVisible()
  })

  test('navigates to inventory page', async ({ page }) => {
    await dashboardPage.inventoryLink.first().click()
    await page.waitForLoadState('networkidle')
    expect(page.url()).toContain('/inventory')
  })

  test('navigates to sales page', async ({ page }) => {
    await dashboardPage.salesLink.first().click()
    await page.waitForLoadState('networkidle')
    expect(page.url()).toContain('/sales')
  })

  test('navigates to udhaar page', async ({ page }) => {
    await dashboardPage.udhaarLink.first().click()
    await page.waitForLoadState('networkidle')
    expect(page.url()).toContain('/udhaar')
  })

  test('navigates to cash page', async ({ page }) => {
    await dashboardPage.cashLink.first().click()
    await page.waitForLoadState('networkidle')
    expect(page.url()).toContain('/cash')
  })
})
