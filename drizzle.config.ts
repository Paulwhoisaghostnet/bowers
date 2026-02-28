import "dotenv/config";
import { defineConfig } from "drizzle-kit";

const dbUrl =
  process.env.DATABASE_URL ||
  process.env.NETLIFY_DATABASE_URL_UNPOOLED ||
  process.env.NETLIFY_DATABASE_URL;

if (!dbUrl) {
  throw new Error("DATABASE_URL (or NETLIFY_DATABASE_URL_UNPOOLED) is required. See .env.example");
}

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: dbUrl,
  },
});
