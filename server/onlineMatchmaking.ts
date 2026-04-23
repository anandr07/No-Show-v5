import { randomUUID } from "crypto";
import type { Express } from "express";
import { WebSocketServer, WebSocket } from "ws";
import { desc, eq, inArray, sql } from "drizzle-orm";
import {
  botProfiles,
  matchmakingTickets,
  onlineMatches,
  onlineMatchPlayers,
  onlineMatchRounds,
  onlineRoundScores,
  playerRankStats,
  onlinePointsLedger,
} from "@shared/schema";
import { getDb } from "./db";
import { OnlineGameService, type OnlinePlayer } from "./onlineGameService";
import type { GameAction } from "./gameState";
import { isValidQuickChatMessageId } from "../constants/quickChatMessages";

type Mode = "online_2p" | "online_3p";

interface QueueEntry {
  ws: WebSocket;
  userId: string;
  name: string;
  mode: Mode;
  enqueuedAt: number;
  ticketId: string;
  /** Absolute timestamp after which bots fill missing seats for this player. */
  botFillAt: number;
}

interface OnlineClient {
  ws: WebSocket;
  userId: string;
  name: string;
  matchId: string | null;
  playerId: string | null;
}

interface MatchMeta {
  matchId: string;
  dbMatchId: string;
  /** runtime playerId → DB online_match_players.id */
  playerDbIds: Map<string, string>;
  /** runtime playerId → DB online_match_players.id (alias for clarity) */
  playerDbIdByRuntime: Map<string, string>;
}

/** Random wait before bots fill: 25 – 45 seconds per player. */
const BOT_FILL_MIN_MS = 25_000;
const BOT_FILL_MAX_MS = 45_000;
const BOT_REDUCTION_FALLBACK = 0.5;

function randomBotFillDelay(): number {
  return BOT_FILL_MIN_MS + Math.random() * (BOT_FILL_MAX_MS - BOT_FILL_MIN_MS);
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuidParam(s: string): boolean {
  return UUID_RE.test(s);
}

function send(ws: WebSocket, payload: object) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

/** Fallback names if `bot_profiles` is empty or DB unavailable (dev). */
const FALLBACK_BOT_NAMES = [
  "AryanBluff", "RohanAce", "DesiDealer", "KarthikKing", "LuckyLaksh",
  "ShivamShuffle", "RajaRummy", "TurboTushar", "BluffingBhai", "SneakySanjay",
];

function pickFallbackBotName(usedNames: Set<string>): string {
  const available = FALLBACK_BOT_NAMES.filter((n) => !usedNames.has(n));
  const pool = available.length > 0 ? available : FALLBACK_BOT_NAMES;
  return pool[Math.floor(Math.random() * pool.length)];
}

export class OnlineMatchmakingService {
  private readonly clients = new Map<WebSocket, OnlineClient>();
  private readonly queue: QueueEntry[] = [];
  private readonly gameService = new OnlineGameService();
  private readonly matchMeta = new Map<string, MatchMeta>();
  private readonly timer: ReturnType<typeof setInterval>;

  constructor() {
    // Poll every second so bot-fill fires within 1s of the player's personal timer.
    this.timer = setInterval(() => {
      void this.processTimeouts();
    }, 1000);
  }

  register(app: Express, wss: WebSocketServer) {
    wss.on("connection", (ws) => this.handleConnection(ws));

    // ── Leaderboard ────────────────────────────────────────────────────────────
    app.get("/api/online/leaderboard", async (_req, res) => {
      try {
        const db = getDb();
        const rows = await db.execute(sql`
          SELECT * FROM v_online_global_leaderboard
          ORDER BY global_rank ASC
          LIMIT 100
        `);
        return res.json({ leaderboard: rows.rows ?? [] });
      } catch {
        return res.status(500).json({ error: "Failed to load leaderboard" });
      }
    });

    // ── Player profile + ledger ────────────────────────────────────────────────
    app.get("/api/online/profile/:userId", async (req, res) => {
      try {
        const userId = req.params.userId?.trim() ?? "";
        if (!isUuidParam(userId)) {
          return res.status(400).json({ error: "invalid_user_id", stats: null, recentLedger: [] });
        }
        const db = getDb();
        const [stats] = await db
          .select()
          .from(playerRankStats)
          .where(eq(playerRankStats.userId, userId))
          .limit(1);

        const lastEntries = await db
          .select()
          .from(onlinePointsLedger)
          .where(eq(onlinePointsLedger.userId, userId))
          .orderBy(desc(onlinePointsLedger.createdAt))
          .limit(20);

        const statsOut = stats
          ? {
              display_name: stats.displayName,
              online_points_total: stats.onlinePointsTotal,
              online_wins: stats.onlineWins,
              online_losses: stats.onlineLosses,
              online_games_played: stats.onlineGamesPlayed,
              current_level: stats.currentLevel,
            }
          : null;

        return res.json({ stats: statsOut, recentLedger: lastEntries });
      } catch {
        return res.status(500).json({ error: "Failed to load profile" });
      }
    });

    // ── Match history ──────────────────────────────────────────────────────────
    app.get("/api/online/history/:userId", async (req, res) => {
      try {
        const userId = req.params.userId?.trim() ?? "";
        if (!isUuidParam(userId)) {
          return res.status(400).json({ error: "invalid_user_id", games: [] });
        }
        const limitRaw = parseInt(String(req.query.limit ?? "40"), 10);
        const limit = Math.min(100, Math.max(1, Number.isFinite(limitRaw) ? limitRaw : 40));

        const db = getDb();
        const userUuid = sql.raw(`'${userId}'::uuid`);
        const result = await db.execute(sql`
          SELECT
            m.id                    AS match_id,
            m.mode::text            AS mode,
            m.ended_at              AS ended_at,
            m.is_bot_filled         AS is_bot_filled,
            m.winner_user_id        AS winner_user_id,
            COALESCE(SUM(l.points_delta), 0)::int AS points_delta
          FROM online_match_players omp
          INNER JOIN online_matches m ON m.id = omp.match_id
          LEFT JOIN online_points_ledger l
            ON l.match_id = m.id AND l.user_id = ${userUuid}
          WHERE omp.user_id = ${userUuid}
            AND omp.is_bot  = false
            AND m.status    = 'completed'
          GROUP BY m.id, m.mode, m.ended_at, m.is_bot_filled, m.winner_user_id, m.created_at
          ORDER BY m.ended_at DESC NULLS LAST, m.created_at DESC
          LIMIT ${sql.raw(String(limit))}
        `);

        const rawRows = (result.rows ?? []) as Record<string, unknown>[];
        const games = rawRows.map((r) => {
          const wid = r.winner_user_id;
          const won = wid != null && String(wid).toLowerCase() === userId.toLowerCase();
          return {
            match_id: String(r.match_id),
            mode: String(r.mode),
            ended_at: r.ended_at ? new Date(String(r.ended_at)).toISOString() : null,
            is_bot_filled: Boolean(r.is_bot_filled),
            won,
            points_delta: Number(r.points_delta ?? 0),
          };
        });

        return res.json({ games });
      } catch {
        return res.status(500).json({ error: "Failed to load history", games: [] });
      }
    });
  }

  // ── WebSocket handlers ───────────────────────────────────────────────────────

  private handleConnection(ws: WebSocket) {
    // Keepalive: Render's reverse proxy closes idle WS connections after ~55 s.
    // Ping every 25 s to keep the connection alive during matchmaking waits.
    const keepAlive = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.ping();
      } else {
        clearInterval(keepAlive);
      }
    }, 25_000);

    ws.on("pong", () => { /* connection confirmed alive */ });

    ws.on("message", (raw) => {
      try {
        const msg = JSON.parse(raw.toString()) as { type: string; [key: string]: unknown };
        void this.handleMessage(ws, msg);
      } catch {
        send(ws, { type: "ONLINE_ERROR", message: "Invalid message payload" });
      }
    });

    ws.on("close", () => {
      clearInterval(keepAlive);
      this.removeFromQueueByWs(ws);
      this.clients.delete(ws);
    });
  }

  private async handleMessage(ws: WebSocket, msg: { type: string; [key: string]: unknown }) {
    if (msg.type === "QUEUE_JOIN") {
      const mode = msg.mode as Mode;
      const name = String(msg.playerName ?? "Player").trim() || "Player";
      const userId = String(msg.userId ?? "").trim();

      if (!userId || (mode !== "online_2p" && mode !== "online_3p")) {
        send(ws, { type: "ONLINE_ERROR", message: "Invalid queue request" });
        return;
      }

      this.clients.set(ws, { ws, userId, name, matchId: null, playerId: null });
      await this.ensureRankStats(userId, name);
      await this.enqueue(ws, userId, name, mode);
      await this.tryMatch(mode);
      return;
    }

    if (msg.type === "QUEUE_CANCEL") {
      await this.cancelQueueByWs(ws);
      return;
    }

    if (msg.type === "ONLINE_ACTION") {
      const client = this.clients.get(ws);
      if (!client?.matchId || !client.playerId) return;

      const action = msg.action as GameAction;
      if (!action || typeof action !== "object") return;
      action.playerId = client.playerId;

      const result = this.gameService.applyAction(client.matchId, action);
      if (!result) {
        send(ws, { type: "ONLINE_ERROR", message: "Match not found" });
        return;
      }
      if (result.error) {
        send(ws, { type: "GAME_ACTION_ERROR", message: result.error });
        return;
      }
      this.broadcastMatchState(client.matchId, result.state);
      await this.gameService.processBotTurns(client.matchId, (state) => {
        this.broadcastMatchState(client.matchId!, state);
      });
      await this.tryFinalizeMatch(client.matchId);
      return;
    }

    if (msg.type === "ONLINE_QUICK_CHAT") {
      const client = this.clients.get(ws);
      if (!client?.matchId || !client.playerId) return;
      const messageId = Number(msg.messageId);
      if (!isValidQuickChatMessageId(messageId)) return;
      for (const c of this.clients.values()) {
        if (c.matchId === client.matchId) {
          send(c.ws, {
            type: "ONLINE_QUICK_CHAT",
            playerId: client.playerId,
            messageId,
          });
        }
      }
      return;
    }
  }

  // ── Queue management ─────────────────────────────────────────────────────────

  private async enqueue(ws: WebSocket, userId: string, name: string, mode: Mode) {
    this.removeFromQueueByWs(ws);
    const ticketId = randomUUID();
    const now = Date.now();
    const botFillAt = now + randomBotFillDelay();
    this.queue.push({ ws, userId, name, mode, enqueuedAt: now, ticketId, botFillAt });

    try {
      const db = getDb();
      await db.insert(matchmakingTickets).values({
        id: ticketId,
        userId,
        mode,
        status: "queued",
        queuedAt: new Date(now),
        expiresAt: new Date(botFillAt),
      });
    } catch {
      // Local dev can continue with in-memory queue
    }

    const maxWaitSeconds = Math.round((botFillAt - now) / 1000);
    send(ws, { type: "QUEUE_STATUS", status: "queued", mode, waitSeconds: 0, maxWaitSeconds });
  }

  private removeFromQueueByWs(ws: WebSocket) {
    const idx = this.queue.findIndex((q) => q.ws === ws);
    if (idx >= 0) this.queue.splice(idx, 1);
  }

  private async cancelQueueByWs(ws: WebSocket) {
    const entry = this.queue.find((q) => q.ws === ws);
    this.removeFromQueueByWs(ws);

    if (entry) {
      try {
        const db = getDb();
        await db
          .update(matchmakingTickets)
          .set({ status: "cancelled" })
          .where(eq(matchmakingTickets.id, entry.ticketId));
      } catch {
        // ignore
      }
    }

    send(ws, { type: "QUEUE_STATUS", status: "cancelled" });
  }

  private async tryMatch(mode: Mode) {
    const required = mode === "online_2p" ? 3 : 4;
    const entries = this.queue.filter((q) => q.mode === mode);
    if (entries.length < required) return;

    const selected = entries.slice(0, required);
    selected.forEach((s) => this.removeFromQueueByWs(s.ws));
    await this.startMatch(mode, selected, false);
  }

  private async processTimeouts() {
    const now = Date.now();
    const modes: Mode[] = ["online_2p", "online_3p"];

    for (const mode of modes) {
      const required = mode === "online_2p" ? 3 : 4;

      // Keep matching until no more expired groups remain for this mode.
      while (true) {
        // Re-read the queue each iteration since startMatch may mutate it.
        const queueForMode = this.queue
          .filter((q) => q.mode === mode)
          .sort((a, b) => a.enqueuedAt - b.enqueuedAt);

        if (queueForMode.length === 0) break;

        // Find the oldest player whose personal bot-fill timer has expired.
        const expiredIdx = queueForMode.findIndex((q) => now >= q.botFillAt);
        if (expiredIdx < 0) break; // No one has expired yet — stop checking this mode.

        // Take up to `required` humans starting from the first expired player,
        // preferring those who have been waiting longest.
        const humanCount = Math.min(required, queueForMode.length);
        const selected = queueForMode.slice(0, humanCount);
        selected.forEach((s) => this.removeFromQueueByWs(s.ws));

        try {
          await this.startMatch(mode, selected, true);
        } catch (err) {
          console.error("[matchmaking] startMatch failed:", err);
        }
      }
    }
  }

  // ── Match lifecycle ──────────────────────────────────────────────────────────

  /**
   * Random active rows from `bot_profiles`. Prefers names not already at the table
   * (human display names); may reuse names only if needed to fill seats.
   */
  private async fetchBotProfilesForMatch(
    count: number,
    usedNames: Set<string>
  ): Promise<{ name: string; botProfileId: string }[]> {
    if (count <= 0) return [];
    try {
      const db = getDb();
      const rows = await db
        .select({ id: botProfiles.id, botName: botProfiles.botName })
        .from(botProfiles)
        .where(eq(botProfiles.active, true));

      if (rows.length === 0) return [];

      const shuffled = [...rows];
      for (let i = shuffled.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }

      const out: { name: string; botProfileId: string }[] = [];
      const usedIds = new Set<string>();

      for (const r of shuffled) {
        if (out.length >= count) break;
        if (usedIds.has(r.id)) continue;
        if (usedNames.has(r.botName)) continue;
        usedIds.add(r.id);
        out.push({ name: r.botName, botProfileId: r.id });
      }

      for (const r of shuffled) {
        if (out.length >= count) break;
        if (usedIds.has(r.id)) continue;
        usedIds.add(r.id);
        out.push({ name: r.botName, botProfileId: r.id });
      }

      return out;
    } catch {
      return [];
    }
  }

  private async startMatch(mode: Mode, humans: QueueEntry[], allowBots: boolean) {
    try {
      await this._startMatchInner(mode, humans, allowBots);
    } catch (err) {
      console.error("[matchmaking] _startMatchInner threw — notifying affected clients:", err);
      for (const h of humans) {
        send(h.ws, { type: "ONLINE_ERROR", message: "Failed to start match, please re-queue." });
      }
    }
  }

  private async _startMatchInner(mode: Mode, humans: QueueEntry[], allowBots: boolean) {
    const required = mode === "online_2p" ? 3 : 4;
    const matchId = randomUUID();
    const players: OnlinePlayer[] = humans.map((h) => ({
      id: randomUUID(),
      userId: h.userId,
      name: h.name,
      isBot: false,
    }));

    if (allowBots && players.length < required) {
      const missing = required - players.length;
      const usedNames = new Set(players.map((p) => p.name));
      const dbBots = await this.fetchBotProfilesForMatch(missing, usedNames);
      const bots: { name: string; botProfileId: string | null }[] = dbBots.map((b) => ({
        name: b.name,
        botProfileId: b.botProfileId,
      }));
      for (const b of dbBots) usedNames.add(b.name);
      while (bots.length < missing) {
        const n = pickFallbackBotName(usedNames);
        usedNames.add(n);
        bots.push({ name: n, botProfileId: null });
      }
      for (let i = 0; i < missing; i += 1) {
        const b = bots[i];
        players.push({
          id: randomUUID(),
          userId: null,
          name: b.name,
          isBot: true,
          botProfileId: b.botProfileId,
        });
      }
    }

    const runtime = this.gameService.createMatch(
      matchId,
      mode,
      players,
      allowBots && players.some((p) => p.isBot)
    );

    const dbMeta = await this.persistMatch(matchId, mode, players, humans, runtime.isBotFilled);
    if (dbMeta) {
      this.matchMeta.set(matchId, dbMeta);
    }

    for (const human of humans) {
      const client = this.clients.get(human.ws);
      if (!client) continue;
      const me = players.find((p) => p.userId === client.userId && !p.isBot);
      client.matchId = matchId;
      client.playerId = me?.id ?? null;
      send(human.ws, {
        type: "MATCH_FOUND",
        matchId,
        mode,
        isBotFilled: runtime.isBotFilled,
        playerId: client.playerId,
        players: players.map((p) => ({ id: p.id, name: p.name, isBot: p.isBot })),
        state: runtime.state,
      });
    }

    // If the very first player is a bot, let them play with natural delays.
    await this.gameService.processBotTurns(matchId, (state) => {
      this.broadcastMatchState(matchId, state);
    });
  }

  private broadcastMatchState(matchId: string, state: unknown) {
    for (const client of this.clients.values()) {
      if (client.matchId === matchId) {
        send(client.ws, { type: "ONLINE_STATE_UPDATE", state });
      }
    }
  }

  // ── DB helpers ───────────────────────────────────────────────────────────────

  private async ensureRankStats(userId: string, displayName: string) {
    try {
      const db = getDb();
      await db
        .insert(playerRankStats)
        .values({ userId, displayName: displayName || "Player" })
        .onConflictDoNothing();
    } catch {
      // ignore in no-db dev mode
    }
  }

  private async persistMatch(
    matchId: string,
    mode: Mode,
    players: OnlinePlayer[],
    humans: QueueEntry[],
    isBotFilled: boolean
  ): Promise<MatchMeta | null> {
    try {
      const db = getDb();

      await db.insert(onlineMatches).values({
        id: matchId,
        mode,
        status: "in_progress",
        isBotFilled,
        botFillStartedAt: isBotFilled ? new Date() : null,
        startedAt: new Date(),
      });

      const playerDbIds = new Map<string, string>();
      for (let i = 0; i < players.length; i += 1) {
        const p = players[i];
        const dbId = randomUUID();
        playerDbIds.set(p.id, dbId);
        await db.insert(onlineMatchPlayers).values({
          id: dbId,
          matchId,
          slotIndex: i,
          userId: p.userId,
          isBot: p.isBot,
          botProfileId: p.isBot ? (p.botProfileId ?? null) : null,
          joinType: p.isBot ? "bot_timeout_fill" : "human_queue",
          joinedAt: new Date(),
        });
      }

      // ── Fix: scope ticket update to only the matched human ticket IDs ─────────
      const humanTicketIds = humans.map((h) => h.ticketId).filter(Boolean);
      if (humanTicketIds.length > 0) {
        await db
          .update(matchmakingTickets)
          .set({ status: "matched", matchedAt: new Date() })
          .where(inArray(matchmakingTickets.id, humanTicketIds));
      }

      return { matchId, dbMatchId: matchId, playerDbIds, playerDbIdByRuntime: playerDbIds };
    } catch {
      return null;
    }
  }

  /** Persist round-by-round scores to online_match_rounds + online_round_scores. */
  private async persistRoundHistory(matchId: string, meta: MatchMeta) {
    const match = this.gameService.getMatch(matchId);
    if (!match || match.roundHistory.length === 0) return;

    try {
      const db = getDb();
      for (const record of match.roundHistory) {
        const roundDbId = randomUUID();
        await db.insert(onlineMatchRounds).values({
          id: roundDbId,
          matchId,
          roundNumber: record.roundNumber,
          startedAt: null,
          endedAt: record.endedAt,
        });

        for (const scoreEntry of record.scores) {
          const dbPlayerId = meta.playerDbIds.get(scoreEntry.playerId);
          if (!dbPlayerId) continue;
          await db.insert(onlineRoundScores).values({
            roundId: roundDbId,
            matchPlayerId: dbPlayerId,
            roundScoreDelta: scoreEntry.delta,
            cumulativeScore: scoreEntry.score,
          }).onConflictDoNothing();
        }
      }
    } catch {
      // Non-critical: game is still finalized; round data is analytics only
    }
  }

  private async tryFinalizeMatch(matchId: string) {
    const match = this.gameService.getMatch(matchId);
    if (!match || match.state.phase !== "gameOver") return;

    const winner = match.state.winner;
    if (!winner) return;

    const meta = this.matchMeta.get(matchId);
    if (!meta) {
      this.gameService.removeMatch(matchId);
      return;
    }

    const winnerDbPlayerId = meta.playerDbIds.get(winner.id);
    if (!winnerDbPlayerId) {
      this.gameService.removeMatch(matchId);
      return;
    }

    const winnerScoreX = Math.max(0, Math.min(99, winner.totalScore ?? 0));

    // Persist per-round data before finalizing
    await this.persistRoundHistory(matchId, meta);

    try {
      const db = getDb();
      await db.execute(
        sql`SELECT finalize_online_match(${matchId}::uuid, ${winnerDbPlayerId}::uuid, ${winnerScoreX})`
      );
    } catch {
      // Fallback: at least mark match completed so it doesn't stay in_progress
      try {
        const db = getDb();
        await db
          .update(onlineMatches)
          .set({ status: "completed", endedAt: new Date() })
          .where(eq(onlineMatches.id, matchId));
      } catch {
        // ignore
      }
    }

    // Notify all match clients
    for (const client of this.clients.values()) {
      if (client.matchId === matchId) {
        send(client.ws, {
          type: "ONLINE_MATCH_FINISHED",
          winnerId: winner.id,
          winnerName: winner.name,
          isBotFilled: match.isBotFilled,
          pointsReductionFactor: match.isBotFilled ? BOT_REDUCTION_FALLBACK : 1,
        });
      }
    }

    this.matchMeta.delete(matchId);
    this.gameService.removeMatch(matchId);
  }
}
