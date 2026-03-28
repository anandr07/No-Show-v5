import * as dotenv from "dotenv";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "@shared/schema";

// Load environment variables from `.env` / `.env.local` in local development.
dotenv.config();

const connectionString = process.env.DATABASE_URL;

function createDb() {
  if (!connectionString) {
    return null;
  }
  const pool = new Pool({ connectionString });
  return drizzle(pool, { schema });
}

export const db = createDb();

export function getDb() {
  if (!db) {
    throw new Error(
      "DATABASE_URL is not set. Please provision a Neon Postgres database."
    );
  }
  return db;
}
