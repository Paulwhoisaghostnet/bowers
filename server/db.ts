import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

const connectionString =
  process.env.DATABASE_URL ||
  process.env.NETLIFY_DATABASE_URL ||
  process.env.NETLIFY_DATABASE_URL_UNPOOLED;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL (or NETLIFY_DATABASE_URL) must be set.",
  );
}

export const pool = new pg.Pool({ connectionString });

export const db = drizzle(pool, { schema });
