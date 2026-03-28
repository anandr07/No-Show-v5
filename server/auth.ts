import type { Express, Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { getDb } from "./db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";

const JWT_SECRET =
  process.env.JWT_SECRET ??
  process.env.SUPABASE_JWT_SECRET ??
  "no-show-dev-secret-change-in-prod";
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

export interface JwtPayload {
  sub: string;
  username: string;
  email?: string;
  display_name?: string;
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JwtPayload;
  } catch {
    return null;
  }
}

function getTokenFromRequest(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }
  const cookie = req.headers.cookie;
  if (cookie) {
    const match = cookie.match(/(?:^|;\s*)auth_token=([^;]+)/);
    if (match) return match[1];
  }
  return null;
}

export function registerAuthRoutes(app: Express) {
  app.post("/api/auth/signup", async (req: Request, res: Response) => {
    const { email, password, display_name } = req.body as {
      email?: string;
      password?: string;
      display_name?: string;
    };

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }

    const db = getDb();
    const username = email.toLowerCase().trim();

    const existing = await db.select().from(users).where(eq(users.username, username)).limit(1);
    if (existing.length > 0) {
      return res.status(409).json({ error: "An account with this email already exists" });
    }

    const hashed = await bcrypt.hash(password, 12);
    const id = randomUUID();
    const displayName = display_name?.trim() || username.split("@")[0];

    const [user] = await db
      .insert(users)
      .values({ id, username, password: hashed })
      .returning();

    const token = signToken({
      sub: user.id,
      username: user.username,
      email: user.username,
      display_name: displayName,
    });

    res.cookie("auth_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: COOKIE_MAX_AGE,
    });

    return res.status(201).json({
      user: {
        id: user.id,
        email: user.username,
        user_metadata: { display_name: displayName },
      },
      token,
    });
  });

  app.post("/api/auth/signin", async (req: Request, res: Response) => {
    const { email, password } = req.body as { email?: string; password?: string };

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const db = getDb();
    const username = email.toLowerCase().trim();
    const [user] = await db.select().from(users).where(eq(users.username, username)).limit(1);

    if (!user) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const displayName = username.split("@")[0];
    const token = signToken({
      sub: user.id,
      username: user.username,
      email: user.username,
      display_name: displayName,
    });

    res.cookie("auth_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: COOKIE_MAX_AGE,
    });

    return res.json({
      user: {
        id: user.id,
        email: user.username,
        user_metadata: { display_name: displayName },
      },
      token,
    });
  });

  app.post("/api/auth/signout", (_req: Request, res: Response) => {
    res.clearCookie("auth_token");
    return res.json({ success: true });
  });

  app.get("/api/auth/session", (req: Request, res: Response) => {
    const token = getTokenFromRequest(req);
    if (!token) {
      return res.json({ user: null, session: null });
    }

    const payload = verifyToken(token);
    if (!payload) {
      return res.json({ user: null, session: null });
    }

    return res.json({
      user: {
        id: payload.sub,
        email: payload.email ?? payload.username,
        user_metadata: { display_name: payload.display_name },
      },
      session: { access_token: token },
    });
  });
}
