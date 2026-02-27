import { test, expect } from "@playwright/test";

test.describe("API health checks", () => {
  test("GET /api/styles returns 200", async ({ request }) => {
    const response = await request.get("/api/styles");
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("application/json");
  });

  test("GET /api/bowers returns 200", async ({ request }) => {
    const response = await request.get("/api/bowers");
    expect(response.status()).toBe(200);
  });

  test("GET /api/contracts/user/me requires auth", async ({ request }) => {
    const response = await request.get("/api/contracts/user/me");
    expect(response.status()).toBe(401);
  });

  test("GET /api/wallets requires auth", async ({ request }) => {
    const response = await request.get("/api/wallets");
    expect(response.status()).toBe(401);
  });

  test("GET /api/friends requires auth", async ({ request }) => {
    const response = await request.get("/api/friends");
    expect(response.status()).toBe(401);
  });

  test("GET /api/bowers/me requires auth", async ({ request }) => {
    const response = await request.get("/api/bowers/me");
    expect(response.status()).toBe(401);
  });

  test("POST /api/ipfs/upload rejects without file", async ({ request }) => {
    const response = await request.post("/api/ipfs/upload");
    expect([400, 401, 415]).toContain(response.status());
  });

  test("GET /api/contracts/detail/nonexistent returns 404", async ({ request }) => {
    const response = await request.get("/api/contracts/detail/nonexistent-id-12345");
    expect(response.status()).toBe(404);
  });
});
