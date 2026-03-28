import { type User, type InsertUser, users } from "@shared/schema";
import { getDb } from "./db";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const db = getDb();
    const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const db = getDb();
    const [user] = await db.select().from(users).where(eq(users.username, username)).limit(1);
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const db = getDb();
    const id = randomUUID();
    const hashed = await bcrypt.hash(insertUser.password, 12);
    const [user] = await db
      .insert(users)
      .values({ id, username: insertUser.username, password: hashed })
      .returning();
    return user;
  }
}

export const storage = new DatabaseStorage();
