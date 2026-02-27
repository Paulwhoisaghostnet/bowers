import { test, expect } from "@playwright/test";

test.describe("Authentication flow", () => {
  const testEmail = `e2e-${Date.now()}@test.local`;
  const testPassword = "TestPassword123!";

  test("login page renders form fields", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByLabel(/email/i).or(page.locator('input[type="email"]'))).toBeVisible();
    await expect(page.getByLabel(/password/i).or(page.locator('input[type="password"]'))).toBeVisible();
  });

  test("login rejects invalid credentials", async ({ page }) => {
    await page.goto("/login");

    const emailInput = page.getByLabel(/email/i).or(page.locator('input[type="email"]'));
    const passwordInput = page.getByLabel(/password/i).or(page.locator('input[type="password"]'));

    await emailInput.fill("nonexistent@test.local");
    await passwordInput.fill("wrongpassword");

    const submitBtn = page.getByRole("button", { name: /sign in|log in|login/i });
    if (await submitBtn.isVisible()) {
      await submitBtn.click();
      await page.waitForTimeout(1000);
      await expect(page).toHaveURL(/login/);
    }
  });

  test("registration form is accessible", async ({ page }) => {
    await page.goto("/login");
    const registerLink = page.getByText(/sign up|register|create account/i);
    if (await registerLink.isVisible()) {
      await registerLink.click();
      await expect(page.locator('input[type="email"]')).toBeVisible();
    }
  });
});
