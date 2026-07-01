import { test, expect } from '@playwright/test'
import { SignupPage } from '../pages/SignupPage'

test.describe('Signup', () => {
  let signupPage: SignupPage

  test.beforeEach(async ({ page }) => {
    signupPage = new SignupPage(page)
    await signupPage.goto()
  })

  test('shows signup form', async ({ page }) => {
    await expect(signupPage.emailInput).toBeVisible()
    await expect(signupPage.passwordInput).toBeVisible()
    await expect(signupPage.submitButton).toBeVisible()
  })

  test('shows error on missing fields', async ({ page }) => {
    await signupPage.submitButton.click()
    const emailValid = await signupPage.emailInput.evaluate(
      (el: HTMLInputElement) => el.validity.valid
    )
    expect(emailValid).toBe(false)
  })

  test('shows error on invalid email format', async ({ page }) => {
    await signupPage.emailInput.fill('notanemail')
    await signupPage.submitButton.click()
    const emailValid = await signupPage.emailInput.evaluate(
      (el: HTMLInputElement) => el.validity.valid
    )
    expect(emailValid).toBe(false)
  })

  test('has link back to login', async ({ page }) => {
    await expect(signupPage.loginLink).toBeVisible()
    await signupPage.loginLink.click()
    await expect(page).toHaveURL(/login/)
  })
})
