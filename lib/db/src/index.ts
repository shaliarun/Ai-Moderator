import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

const dbUrl = process.env.DATABASE_URL;

// Enable SSL when connecting to cloud-hosted databases (Supabase, Render, AWS, etc.)
const useSSL =
  process.env.NODE_ENV === "production" ||
  dbUrl.includes("supabase") ||
  dbUrl.includes("render.com") ||
  dbUrl.includes("amazonaws.com") ||
  dbUrl.includes("neon.tech");

export const pool = new Pool({
  connectionString: dbUrl,
  ...(useSSL ? { ssl: { rejectUnauthorized: false } } : {}),
});
export const db = drizzle(pool, { schema });

export * from "./schema";
