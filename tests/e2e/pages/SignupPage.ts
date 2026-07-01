import { Page, Locator } from '@playwright/test'

export class SignupPage {
  readonly page: Page
  readonly shopNameInput: Locator
  readonly emailInput: Locator
  readonly passwordInput: Locator
  readonly submitButton: Locator
  readonly errorMessage: Locator
  readonly loginLink: Locator

  constructor(page: Page) {
    this.page = page
    this.shopNameInput = page.locator('input[name="shopName"], input[placeholder*="shop"], input[placeholder*="Shop"]').first()
    this.emailInput = page.locator('input[type="email"]')
    this.passwordInput = page.locator('input[type="password"]')
    this.submitButton = page.locator('button[type="submit"]')
    this.errorMessage = page.locator('[data-testid="error-message"], .text-red-500, [role="alert"]')
    this.loginLink = page.locator('a[href*="login"]')
  }

  async goto() {
    await this.page.goto('/signup')
    await this.page.waitForLoadState('networkidle')
  }

  async signup(shopName: string, email: string, password: string) {
    await this.shopNameInput.fill(shopName)
    await this.emailInput.fill(email)
    await this.passwordInput.fill(password)
    await this.submitButton.click()
  }
}
