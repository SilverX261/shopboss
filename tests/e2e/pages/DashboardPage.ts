import { Page, Locator } from '@playwright/test'

export class DashboardPage {
  readonly page: Page
  readonly sidebar: Locator
  readonly inventoryLink: Locator
  readonly salesLink: Locator
  readonly udhaarLink: Locator
  readonly cashLink: Locator
  readonly workersLink: Locator
  readonly reportsLink: Locator
  readonly settingsLink: Locator

  constructor(page: Page) {
    this.page = page
    this.sidebar = page.locator('nav, aside, [data-testid="sidebar"]').first()
    this.inventoryLink = page.locator('a[href*="inventory"]')
    this.salesLink = page.locator('a[href*="sales"]')
    this.udhaarLink = page.locator('a[href*="udhaar"]')
    this.cashLink = page.locator('a[href*="cash"]')
    this.workersLink = page.locator('a[href*="workers"]')
    this.reportsLink = page.locator('a[href*="reports"]')
    this.settingsLink = page.locator('a[href*="settings"]')
  }

  async goto() {
    await this.page.goto('/dashboard')
    await this.page.waitForLoadState('networkidle')
  }

  async isLoggedIn() {
    const url = this.page.url()
    return url.includes('/dashboard') && !url.includes('/login')
  }
}
