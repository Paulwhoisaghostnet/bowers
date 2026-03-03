import serverless from "serverless-http";
import { createApp } from "../server/app";

const FUNCTION_PREFIX = "/.netlify/functions/api";

async function main() {
  console.log("=== Testing Netlify function locally ===");
  console.log("DATABASE_URL set:", !!process.env.DATABASE_URL);
  console.log("SESSION_SECRET set:", !!process.env.SESSION_SECRET);

  try {
    console.log("Creating app...");
    const app = await createApp();
    console.log("App created successfully");

    const handler = serverless(app, {
      request: (req: any, _event: any) => {
        if (req.url.startsWith(FUNCTION_PREFIX)) {
          req.url = "/api" + req.url.slice(FUNCTION_PREFIX.length);
        }
      },
    });

    // Simulate Netlify rewrite: /api/auth/login -> /.netlify/functions/api/auth/login
    const loginEvent = {
      httpMethod: "POST",
      path: "/.netlify/functions/api/auth/login",
      rawUrl: "http://localhost:3000/api/auth/login",
      headers: {
        "content-type": "application/json",
        host: "localhost:3000",
      },
      body: JSON.stringify({ email: "test@test.com", password: "password123" }),
      isBase64Encoded: false,
    };

    console.log("\n--- Test 1: POST /api/auth/login (via Netlify rewrite path) ---");
    console.log("event.path:", loginEvent.path);
    const result1 = await handler(loginEvent, {});
    console.log("Status:", (result1 as any)?.statusCode);
    console.log("Body:", (result1 as any)?.body?.slice(0, 200));

    // Test GET /api/styles via Netlify rewrite
    const stylesEvent = {
      httpMethod: "GET",
      path: "/.netlify/functions/api/styles",
      rawUrl: "http://localhost:3000/api/styles",
      headers: { host: "localhost:3000" },
      body: null,
      isBase64Encoded: false,
    };

    console.log("\n--- Test 2: GET /api/styles (via Netlify rewrite path) ---");
    console.log("event.path:", stylesEvent.path);
    const result2 = await handler(stylesEvent, {});
    console.log("Status:", (result2 as any)?.statusCode);
    const stylesBody = (result2 as any)?.body;
    if (stylesBody) {
      const parsed = JSON.parse(stylesBody);
      console.log("Styles count:", Array.isArray(parsed) ? parsed.length : "not array");
    }

    // Test protected route (should return 401)
    const protectedEvent = {
      httpMethod: "GET",
      path: "/.netlify/functions/api/wallets",
      rawUrl: "http://localhost:3000/api/wallets",
      headers: { host: "localhost:3000" },
      body: null,
      isBase64Encoded: false,
    };

    console.log("\n--- Test 3: GET /api/wallets (protected, should be 401) ---");
    const result3 = await handler(protectedEvent, {});
    console.log("Status:", (result3 as any)?.statusCode);
    console.log("Body:", (result3 as any)?.body);

  } catch (err: any) {
    console.error("FATAL:", err.message);
    console.error(err.stack);
  }

  process.exit(0);
}

main();
