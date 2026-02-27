import { test, expect } from "@playwright/test";

test.describe("Collection and styles", () => {
  test("styles API returns contract styles", async ({ request }) => {
    const response = await request.get("/api/styles");
    expect(response.status()).toBe(200);

    const styles = await response.json();
    expect(Array.isArray(styles)).toBe(true);
    expect(styles.length).toBeGreaterThan(0);

    const first = styles[0];
    expect(first).toHaveProperty("id");
    expect(first).toHaveProperty("name");
    expect(first).toHaveProperty("description");
  });

  test("contracts API returns list", async ({ request }) => {
    const demoAddress = "tz1VSUr8wwNhLAzempoch5d6hLRiTh8Cjcjb";
    const response = await request.get(`/api/contracts/${demoAddress}`);
    expect(response.status()).toBe(200);

    const contracts = await response.json();
    expect(Array.isArray(contracts)).toBe(true);
  });

  test("collection detail page loads for valid contract", async ({ request }) => {
    const demoAddress = "tz1VSUr8wwNhLAzempoch5d6hLRiTh8Cjcjb";
    const response = await request.get(`/api/contracts/${demoAddress}`);
    const contracts = await response.json();

    if (contracts.length > 0) {
      const detailRes = await request.get(`/api/contracts/detail/${contracts[0].id}`);
      expect(detailRes.status()).toBe(200);
      const detail = await detailRes.json();
      expect(detail).toHaveProperty("name");
      expect(detail).toHaveProperty("kt1Address");
    }
  });

  test("marketplace page renders", async ({ page }) => {
    await page.goto("/marketplace");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("body")).toBeVisible();
  });
});
