import { type User, type InsertUser, users } from "@shared/schema";
import { getDb } from "./db";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const db = getDb();
    const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const db = getDb();
    const [user] = await db.select().from(users).where(eq(users.email, email.toLowerCase().trim())).limit(1);
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const db = getDb();
    const id = randomUUID();
    const hashed = await bcrypt.hash(insertUser.password, 12);
    const email = insertUser.email.toLowerCase().trim();
    const [user] = await db
      .insert(users)
      .values({
        id,
        accountType: process.env.AUTH_PG_ACCOUNT_TYPE?.trim() || "registered",
        email,
        passwordHash: hashed,
        status: process.env.AUTH_PG_USER_STATUS?.trim() || "active",
      })
      .returning();
    return user;
  }
}

export const storage = new DatabaseStorage();
