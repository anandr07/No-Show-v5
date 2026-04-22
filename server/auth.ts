import type { Express, Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { getDb } from "./db";
import {
  authIdentities,
  playerRankStats,
  profileSettings,
  playerGemBalance,
  users,
} from "@shared/schema";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";

function resolveJwtSecret(): string {
  const candidates = [
    process.env.JWT_SECRET,
    process.env.SUPABASE_JWT_SECRET,
  ];
  for (const c of candidates) {
    const v = c?.trim();
    // Skip empty strings and unfilled placeholders like "[YOUR_...]"
    if (v && !v.startsWith("[")) return v;
  }
  return "no-show-dev-secret-change-in-prod";
}

const JWT_SECRET = resolveJwtSecret();
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

/** Must match a label in Postgres enum `public.account_type`. */
function signupAccountType(): string {
  const v = process.env.AUTH_PG_ACCOUNT_TYPE?.trim();
  if (v && /^[\w-]+$/.test(v)) return v;
  // Common in custom schemas (value "email" is often absent on this enum).
  return "registered";
}

/** Must match a label in Postgres enum behind `auth_identities.provider`. */
function signupAuthProvider(): string {
  const v = process.env.AUTH_PG_AUTH_PROVIDER?.trim();
  if (v && /^[\w-]+$/.test(v)) return v;
  // Common for password-based signup (value "password" is often absent).
  return "email";
}

/** Must match a label in Postgres enum `public.user_status`. */
function signupUserStatus(): string {
  const v = process.env.AUTH_PG_USER_STATUS?.trim();
  if (v && /^[\w-]+$/.test(v)) return v;
  return "active";
}

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

function pgUniqueViolation(err: unknown): boolean {
  return typeof err === "object" && err !== null && "code" in err && (err as { code: string }).code === "23505";
}

function formatPgError(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  const o = err as { message?: string; detail?: string; hint?: string };
  return [o.message, o.detail, o.hint].filter(Boolean).join(" — ");
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
    const emailNorm = email.toLowerCase().trim();
    const rawName = display_name?.trim() || emailNorm.split("@")[0] || "Player";
    const displayName = rawName.slice(0, 64);
    const hashed = await bcrypt.hash(password, 12);
    const userId = randomUUID();
    const accountType = signupAccountType();
    const authProvider = signupAuthProvider();
    const userStatus = signupUserStatus();

    try {
      await db.transaction(async (tx) => {
        await tx.insert(users).values({
          id: userId,
          accountType,
          email: emailNorm,
          passwordHash: hashed,
          status: userStatus,
        });

        await tx.insert(authIdentities).values({
          userId,
          provider: authProvider,
          providerSubject: emailNorm,
        });

        await tx.insert(playerRankStats).values({
          userId,
          displayName,
        });

        await tx.insert(profileSettings).values({ userId }).onConflictDoNothing();

        await tx.insert(playerGemBalance).values({ userId, balance: 100 }).onConflictDoNothing();
      });
    } catch (err) {
      if (pgUniqueViolation(err)) {
        const msg = String((err as { detail?: string }).detail ?? "");
        if (msg.includes("email") || msg.includes("(email)")) {
          return res.status(409).json({ error: "An account with this email already exists" });
        }
        if (msg.includes("display_name")) {
          return res.status(409).json({ error: "That display name is already taken" });
        }
        return res.status(409).json({ error: "Sign up conflict (duplicate value)" });
      }
      console.error("[auth/signup]", err);
      const pgMsg = formatPgError(err);
      return res.status(500).json({
        error: pgMsg
          ? `Could not create account: ${pgMsg}. Set AUTH_PG_ACCOUNT_TYPE / AUTH_PG_AUTH_PROVIDER / AUTH_PG_USER_STATUS to valid enum labels for your database if needed.`
          : "Could not create account. Check server logs.",
      });
    }

    const token = signToken({
      sub: userId,
      username: emailNorm,
      email: emailNorm,
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
        id: userId,
        email: emailNorm,
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
    const emailNorm = email.toLowerCase().trim();
    const [user] = await db.select().from(users).where(eq(users.email, emailNorm)).limit(1);

    if (!user?.passwordHash) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const [profile] = await db
      .select()
      .from(playerRankStats)
      .where(eq(playerRankStats.userId, user.id))
      .limit(1);
    const displayName = profile?.displayName ?? emailNorm.split("@")[0];

    await db
      .update(users)
      .set({ lastLoginAt: new Date(), updatedAt: new Date() })
      .where(eq(users.id, user.id));

    const token = signToken({
      sub: user.id,
      username: user.email ?? emailNorm,
      email: user.email ?? emailNorm,
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
        email: user.email ?? emailNorm,
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
