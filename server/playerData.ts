/**
 * Player data REST API.
 *
 * All routes require a valid JWT Bearer token (via Authorization header or auth_token cookie).
 *
 * Routes:
 *  GET  /api/player/me          — profile + settings + gem balance + owned cosmetics
 *  PUT  /api/player/profile     — update display_name, avatar_index
 *  PUT  /api/player/settings    — update sound/haptics/notifications/active cosmetics
 *  POST /api/player/cosmetics/purchase — spend gems to unlock a card back or table theme
 *  POST /api/player/gems/grant  — (dev only) grant gems for testing
 *  GET  /api/player/gems/history — last 40 gem transactions
 */

import type { Express, Request, Response } from "express";
import { eq, and, desc, sql } from "drizzle-orm";
import { getDb } from "./db";
import { verifyToken } from "./auth";
import {
  playerRankStats,
  profileSettings,
  playerGemBalance,
  playerCosmetics,
  gemTransactions,
  iapPurchases,
  cosmeticsCatalog,
} from "@shared/schema";

// ─── Auth middleware ──────────────────────────────────────────────────────────

function requireAuth(req: Request, res: Response): string | null {
  const authHeader = req.headers.authorization;
  let token: string | null = null;
  if (authHeader?.startsWith("Bearer ")) {
    token = authHeader.slice(7);
  } else {
    const cookie = req.headers.cookie;
    if (cookie) {
      const m = cookie.match(/(?:^|;\s*)auth_token=([^;]+)/);
      if (m) token = m[1];
    }
  }
  if (!token) {
    res.status(401).json({ error: "Unauthorized" });
    return null;
  }
  const payload = verifyToken(token);
  if (!payload) {
    res.status(401).json({ error: "Invalid or expired token" });
    return null;
  }
  return payload.sub;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function ensureGemRow(userId: string) {
  const db = getDb();
  await db
    .insert(playerGemBalance)
    .values({ userId, balance: 0 })
    .onConflictDoNothing();
}

async function ensureSettingsRow(userId: string) {
  const db = getDb();
  await db.insert(profileSettings).values({ userId }).onConflictDoNothing();
}

// ─── Route registration ───────────────────────────────────────────────────────

export function registerPlayerDataRoutes(app: Express) {
  // ── GET /api/player/me ────────────────────────────────────────────────────
  // Returns the complete player snapshot: profile + settings + gems + owned cosmetics.
  app.get("/api/player/me", async (req: Request, res: Response) => {
    const userId = requireAuth(req, res);
    if (!userId) return;

    try {
      const db = getDb();
      await Promise.all([ensureGemRow(userId), ensureSettingsRow(userId)]);

      const [profile, settings, gemRow, ownedRows] = await Promise.all([
        db.select().from(playerRankStats).where(eq(playerRankStats.userId, userId)).limit(1),
        db.select().from(profileSettings).where(eq(profileSettings.userId, userId)).limit(1),
        db.select().from(playerGemBalance).where(eq(playerGemBalance.userId, userId)).limit(1),
        db.select().from(playerCosmetics).where(eq(playerCosmetics.userId, userId)),
      ]);

      const ownedCardBacks = ownedRows
        .filter((r) => r.cosmeticType === "card_back")
        .map((r) => r.itemId);
      const ownedTableThemes = ownedRows
        .filter((r) => r.cosmeticType === "table_theme")
        .map((r) => r.itemId);

      return res.json({
        profile: profile[0] ?? null,
        settings: settings[0] ?? null,
        gemBalance: gemRow[0]?.balance ?? 0,
        ownedCardBacks,
        ownedTableThemes,
      });
    } catch (err) {
      console.error("[player/me]", err);
      return res.status(500).json({ error: "Failed to load player data" });
    }
  });

  // ── PUT /api/player/profile ───────────────────────────────────────────────
  // Updates display_name and avatar_index.
  app.put("/api/player/profile", async (req: Request, res: Response) => {
    const userId = requireAuth(req, res);
    if (!userId) return;

    const { display_name, avatar_index } = req.body as {
      display_name?: string;
      avatar_index?: number;
    };

    const updates: Partial<typeof playerRankStats.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (typeof display_name === "string") {
      const name = display_name.trim().slice(0, 64);
      if (!name) return res.status(400).json({ error: "display_name cannot be empty" });
      updates.displayName = name;
    }

    if (typeof avatar_index === "number") {
      const idx = Math.max(0, Math.min(7, Math.floor(avatar_index)));
      updates.avatarIndex = idx;
    }

    try {
      const db = getDb();
      const [updated] = await db
        .update(playerRankStats)
        .set(updates)
        .where(eq(playerRankStats.userId, userId))
        .returning();

      if (!updated) {
        return res.status(404).json({ error: "Profile not found" });
      }
      return res.json({ profile: updated });
    } catch (err) {
      const e = err as { code?: string; detail?: string };
      if (e.code === "23505" && e.detail?.includes("display_name")) {
        return res.status(409).json({ error: "That display name is already taken" });
      }
      console.error("[player/profile]", err);
      return res.status(500).json({ error: "Failed to update profile" });
    }
  });

  // ── PUT /api/player/settings ──────────────────────────────────────────────
  // Updates sound/haptics/notifications and active cosmetics.
  app.put("/api/player/settings", async (req: Request, res: Response) => {
    const userId = requireAuth(req, res);
    if (!userId) return;

    const {
      sound_enabled,
      haptics_enabled,
      notifications_enabled,
      active_card_back_id,
      active_table_theme,
    } = req.body as {
      sound_enabled?: boolean;
      haptics_enabled?: boolean;
      notifications_enabled?: boolean;
      active_card_back_id?: string;
      active_table_theme?: string;
    };

    await ensureSettingsRow(userId);

    const updates: Partial<typeof profileSettings.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (typeof sound_enabled === "boolean") updates.soundEnabled = sound_enabled;
    if (typeof haptics_enabled === "boolean") updates.hapticsEnabled = haptics_enabled;
    if (typeof notifications_enabled === "boolean") updates.notificationsEnabled = notifications_enabled;

    // Validate active cosmetics: ensure user owns the item before equipping.
    if (active_card_back_id && active_card_back_id !== "default") {
      const db = getDb();
      const owned = await db
        .select()
        .from(playerCosmetics)
        .where(
          and(
            eq(playerCosmetics.userId, userId),
            eq(playerCosmetics.cosmeticType, "card_back"),
            eq(playerCosmetics.itemId, active_card_back_id)
          )
        )
        .limit(1);
      if (!owned.length) {
        return res.status(403).json({ error: "Card back not owned" });
      }
      updates.activeCardBackId = active_card_back_id;
    } else if (active_card_back_id === "default") {
      updates.activeCardBackId = "default";
    }

    if (active_table_theme && active_table_theme !== "green") {
      const db = getDb();
      const owned = await db
        .select()
        .from(playerCosmetics)
        .where(
          and(
            eq(playerCosmetics.userId, userId),
            eq(playerCosmetics.cosmeticType, "table_theme"),
            eq(playerCosmetics.itemId, active_table_theme)
          )
        )
        .limit(1);
      if (!owned.length) {
        return res.status(403).json({ error: "Table theme not owned" });
      }
      updates.activeTableTheme = active_table_theme;
    } else if (active_table_theme === "green") {
      updates.activeTableTheme = "green";
    }

    try {
      const db = getDb();
      const [updated] = await db
        .update(profileSettings)
        .set(updates)
        .where(eq(profileSettings.userId, userId))
        .returning();

      return res.json({ settings: updated });
    } catch (err) {
      console.error("[player/settings]", err);
      return res.status(500).json({ error: "Failed to update settings" });
    }
  });

  // ── POST /api/player/cosmetics/purchase ───────────────────────────────────
  // Spend gems to unlock a card back or table theme.
  // Body: { cosmetic_type: "card_back" | "table_theme", item_id: string }
  app.post("/api/player/cosmetics/purchase", async (req: Request, res: Response) => {
    const userId = requireAuth(req, res);
    if (!userId) return;

    const { cosmetic_type, item_id } = req.body as {
      cosmetic_type?: string;
      item_id?: string;
    };

    if (!cosmetic_type || !item_id) {
      return res.status(400).json({ error: "cosmetic_type and item_id are required" });
    }
    if (cosmetic_type !== "card_back" && cosmetic_type !== "table_theme") {
      return res.status(400).json({ error: "Invalid cosmetic_type" });
    }

    try {
      const db = getDb();

      // Look up price from catalog
      const [catalogItem] = await db
        .select()
        .from(cosmeticsCatalog)
        .where(
          and(
            eq(cosmeticsCatalog.itemId, item_id),
            eq(cosmeticsCatalog.cosmeticType, cosmetic_type)
          )
        )
        .limit(1);

      if (!catalogItem) {
        return res.status(404).json({ error: "Item not found in catalog" });
      }
      if (catalogItem.isFree) {
        return res.status(400).json({ error: "This item is free — no purchase needed" });
      }

      // Call the atomic DB function
      const result = await db.execute(
        sql`SELECT spend_gems_for_cosmetic(
          ${userId}::uuid,
          ${cosmetic_type}::cosmetic_type,
          ${item_id}::varchar,
          ${catalogItem.gemPrice}::integer
        ) AS result`
      );
      const outcome = (result.rows[0] as { result: string }).result;

      if (outcome === "ok") {
        // Fetch new balance
        const [gemRow] = await db
          .select()
          .from(playerGemBalance)
          .where(eq(playerGemBalance.userId, userId))
          .limit(1);
        return res.json({
          success: true,
          item_id,
          cosmetic_type,
          new_gem_balance: gemRow?.balance ?? 0,
        });
      }
      if (outcome === "already_owned") {
        return res.status(409).json({ error: "Item already owned" });
      }
      if (outcome === "insufficient_gems") {
        const [gemRow] = await db
          .select()
          .from(playerGemBalance)
          .where(eq(playerGemBalance.userId, userId))
          .limit(1);
        return res.status(402).json({
          error: "Insufficient gems",
          gem_balance: gemRow?.balance ?? 0,
          gem_price: catalogItem.gemPrice,
        });
      }
      return res.status(500).json({ error: `Unexpected outcome: ${outcome}` });
    } catch (err) {
      console.error("[player/cosmetics/purchase]", err);
      return res.status(500).json({ error: "Purchase failed" });
    }
  });

  // ── POST /api/player/gems/grant  (dev / simulate IAP) ────────────────────
  // Body: { product_id: string, gems_granted: number, price_usd_cents: number }
  app.post("/api/player/gems/grant", async (req: Request, res: Response) => {
    const userId = requireAuth(req, res);
    if (!userId) return;

    const { product_id, gems_granted, price_usd_cents } = req.body as {
      product_id?: string;
      gems_granted?: number;
      price_usd_cents?: number;
    };

    if (!product_id || typeof gems_granted !== "number" || gems_granted <= 0) {
      return res.status(400).json({ error: "product_id and gems_granted (>0) are required" });
    }

    try {
      const db = getDb();
      await ensureGemRow(userId);

      // Record the IAP
      const [iapRow] = await db
        .insert(iapPurchases)
        .values({
          userId,
          productId: product_id,
          platform: "dev_simulate",
          priceUsdCents: price_usd_cents ?? 0,
          gemsGranted: Math.floor(gems_granted),
          isSandbox: true,
        })
        .returning();

      // Atomic grant via DB function
      const result = await db.execute(
        sql`SELECT grant_gems(
          ${userId}::uuid,
          ${Math.floor(gems_granted)}::integer,
          'iap_purchase'::gem_tx_type,
          ${iapRow.id}::text,
          ${"IAP: " + product_id}::text
        ) AS new_balance`
      );
      const newBalance = (result.rows[0] as { new_balance: number }).new_balance;

      return res.json({
        success: true,
        gems_granted: Math.floor(gems_granted),
        new_gem_balance: newBalance,
      });
    } catch (err) {
      console.error("[player/gems/grant]", err);
      return res.status(500).json({ error: "Failed to grant gems" });
    }
  });

  // ── GET /api/player/gems/history ─────────────────────────────────────────
  app.get("/api/player/gems/history", async (req: Request, res: Response) => {
    const userId = requireAuth(req, res);
    if (!userId) return;

    try {
      const db = getDb();
      const rows = await db
        .select()
        .from(gemTransactions)
        .where(eq(gemTransactions.userId, userId))
        .orderBy(desc(gemTransactions.createdAt))
        .limit(40);

      return res.json({ transactions: rows });
    } catch (err) {
      console.error("[player/gems/history]", err);
      return res.status(500).json({ error: "Failed to load gem history" });
    }
  });
}
