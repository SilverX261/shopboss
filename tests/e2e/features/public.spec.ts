import { test, expect } from '@playwright/test'

test.describe('Public pages', () => {
  test('landing page loads', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveTitle(/ShopBoss|shopboss/i)
  })

  test('landing page has login link', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    const loginLink = page.locator('a[href*="login"]')
    await expect(loginLink.first()).toBeVisible()
  })

  test('landing page has signup/get started link', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    const ctaLink = page.locator('a[href*="signup"], a[href*="register"], button:has-text("Get Started"), button:has-text("Start")')
    await expect(ctaLink.first()).toBeVisible()
  })

  test('pricing page loads', async ({ page }) => {
    await page.goto('/pricing')
    await page.waitForLoadState('networkidle')
    const pricingContent = page.locator('h1, h2, [data-testid="pricing"]')
    await expect(pricingContent.first()).toBeVisible()
  })

  test('unauthenticated access to dashboard redirects to login', async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')
    expect(page.url()).toMatch(/login|auth/)
  })
})
