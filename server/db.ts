import * as dotenv from "dotenv";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

const { Pool } = pg;

// Load environment variables from `.env` / `.env.local` in local development.
// This makes `npx tsx server/index.ts` work without manually exporting DATABASE_URL.
dotenv.config();

function readConnectionString(): string | undefined {
  return process.env.DATABASE_URL ?? process.env.SUPABASE_DB_URL;
}

function createDb() {
  const connectionString = readConnectionString();
  if (!connectionString) return null;

  const pool = new Pool({ connectionString });
  return drizzle(pool, { schema });
}

// Create lazily so the server can still boot for local/offline gameplay.
const db = createDb();

export function getDb() {
  if (!db) {
    throw new Error(
      "DATABASE_URL (or SUPABASE_DB_URL) must be set. Create a `.env` (or `.env.local`) file in the project root (see `docs/SUPABASE_SETUP.md`)."
    );
  }
  return db;
}

// Kept for convenience: only usable when DATABASE_URL is set.
export const pool = (() => {
  const connectionString = readConnectionString();
  if (!connectionString) return null;
  return new Pool({ connectionString });
})();
