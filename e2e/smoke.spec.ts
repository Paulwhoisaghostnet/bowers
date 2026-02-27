import { test, expect } from "@playwright/test";

test.describe("Smoke tests", () => {
  test("landing page loads", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/Bowers/i);
    await expect(page.locator("body")).toBeVisible();
  });

  test("landing page has hero content", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText(/Deploy NFT Collections/i)).toBeVisible();
  });

  test("marketplace route loads", async ({ page }) => {
    await page.goto("/marketplace");
    await expect(page.locator("body")).toBeVisible();
    await expect(page).not.toHaveURL(/404/);
  });

  test("login route loads", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator("body")).toBeVisible();
  });

  test("no console errors on landing", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });

    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const critical = errors.filter(
      (e) => !e.includes("favicon") && !e.includes("manifest"),
    );
    expect(critical).toHaveLength(0);
  });
});
