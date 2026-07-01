import { test, expect } from '@playwright/test'
import { LoginPage } from '../pages/LoginPage'
import { TEST_CREDENTIALS } from '../../fixtures/auth'

test.describe('Login', () => {
  let loginPage: LoginPage

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page)
    await loginPage.goto()
  })

  test('shows login form', async ({ page }) => {
    await expect(loginPage.emailInput).toBeVisible()
    await expect(loginPage.passwordInput).toBeVisible()
    await expect(loginPage.submitButton).toBeVisible()
  })

  test('shows error on invalid credentials', async ({ page }) => {
    await loginPage.login('wrong@example.com', 'wrongpassword')
    await expect(loginPage.errorMessage).toBeVisible({ timeout: 8000 })
  })

  test('redirects to dashboard on valid login', async ({ page }) => {
    await loginPage.login(TEST_CREDENTIALS.email, TEST_CREDENTIALS.password)
    await page.waitForURL('**/dashboard**', { timeout: 15000 })
    expect(page.url()).toContain('/dashboard')
  })

  test('has link to signup page', async ({ page }) => {
    await expect(loginPage.signupLink).toBeVisible()
    await loginPage.signupLink.click()
    await expect(page).toHaveURL(/signup/)
  })

  test('has link to forgot password', async ({ page }) => {
    await expect(loginPage.forgotPasswordLink).toBeVisible()
  })
})
