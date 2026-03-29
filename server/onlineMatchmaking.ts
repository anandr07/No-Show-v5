import { randomUUID } from "crypto";
import type { Express } from "express";
import { WebSocketServer, WebSocket } from "ws";
import { and, desc, eq, sql } from "drizzle-orm";
import {
  matchmakingTickets,
  onlineMatches,
  onlineMatchPlayers,
  playerRankStats,
  onlinePointsLedger,
} from "@shared/schema";
import { getDb } from "./db";
import { OnlineGameService, type OnlinePlayer } from "./onlineGameService";
import type { GameAction } from "./gameState";

type Mode = "online_2p" | "online_3p";

interface QueueEntry {
  ws: WebSocket;
  userId: string;
  name: string;
  mode: Mode;
  enqueuedAt: number;
  ticketId: string;
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
  playerDbIds: Map<string, string>;
}

const BOT_FILL_TIMEOUT_MS = 180_000;
const BOT_REDUCTION_FALLBACK = 0.5;

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

function randomBotName(index: number): string {
  const names = ["Falcon", "Raven", "Joker", "Ace", "Bluff", "Dealer", "Shadow"];
  return `${names[index % names.length]} Bot`;
}

export class OnlineMatchmakingService {
  private readonly clients = new Map<WebSocket, OnlineClient>();
  private readonly queue: QueueEntry[] = [];
  private readonly gameService = new OnlineGameService();
  private readonly matchMeta = new Map<string, MatchMeta>();
  private readonly timer: NodeJS.Timeout;

  constructor() {
    this.timer = setInterval(() => {
      void this.processTimeouts();
    }, 3000);
  }

  register(app: Express, wss: WebSocketServer) {
    wss.on("connection", (ws) => this.handleConnection(ws));

    app.get("/api/online/leaderboard", async (_req, res) => {
      try {
        const db = getDb();
        const rows = await db.execute(sql`
          SELECT * FROM v_online_global_leaderboard
          ORDER BY global_rank ASC
          LIMIT 100
        `);
        return res.json({ leaderboard: rows.rows ?? [] });
      } catch (err) {
        return res.status(500).json({ error: "Failed to load leaderboard" });
      }
    });

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

        return res.json({
          stats: statsOut,
          recentLedger: lastEntries,
        });
      } catch {
        return res.status(500).json({ error: "Failed to load profile" });
      }
    });

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
            m.id AS match_id,
            m.mode::text AS mode,
            m.ended_at AS ended_at,
            m.is_bot_filled AS is_bot_filled,
            m.winner_user_id AS winner_user_id,
            COALESCE(SUM(l.points_delta), 0)::int AS points_delta
          FROM online_match_players omp
          INNER JOIN online_matches m ON m.id = omp.match_id
          LEFT JOIN online_points_ledger l
            ON l.match_id = m.id AND l.user_id = ${userUuid}
          WHERE omp.user_id = ${userUuid}
            AND omp.is_bot = false
            AND m.status = 'completed'
          GROUP BY m.id, m.mode, m.ended_at, m.is_bot_filled, m.winner_user_id, m.created_at
          ORDER BY m.ended_at DESC NULLS LAST, m.created_at DESC
          LIMIT ${sql.raw(String(limit))}
        `);

        const rawRows = (result.rows ?? []) as Record<string, unknown>[];
        const games = rawRows.map((r) => {
          const wid = r.winner_user_id;
          const won =
            wid != null && String(wid).toLowerCase() === userId.toLowerCase();
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

  private handleConnection(ws: WebSocket) {
    ws.on("message", (raw) => {
      try {
        const msg = JSON.parse(raw.toString()) as { type: string; [key: string]: unknown };
        void this.handleMessage(ws, msg);
      } catch {
        send(ws, { type: "ONLINE_ERROR", message: "Invalid message payload" });
      }
    });

    ws.on("close", () => {
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
      const botTurn = this.gameService.processBotTurns(client.matchId);
      if (botTurn.progressed && botTurn.finalState) {
        this.broadcastMatchState(client.matchId, botTurn.finalState);
      }
      await this.tryFinalizeMatch(client.matchId);
      return;
    }
  }

  private async enqueue(ws: WebSocket, userId: string, name: string, mode: Mode) {
    this.removeFromQueueByWs(ws);
    const ticketId = randomUUID();
    this.queue.push({
      ws,
      userId,
      name,
      mode,
      enqueuedAt: Date.now(),
      ticketId,
    });

    try {
      const db = getDb();
      await db.insert(matchmakingTickets).values({
        id: ticketId,
        userId,
        mode,
        status: "queued",
        queuedAt: new Date(),
        expiresAt: new Date(Date.now() + BOT_FILL_TIMEOUT_MS),
      });
    } catch {
      // local dev can continue with in-memory queue
    }

    send(ws, {
      type: "QUEUE_STATUS",
      status: "queued",
      mode,
      waitSeconds: 0,
    });
  }

  private removeFromQueueByWs(ws: WebSocket) {
    const idx = this.queue.findIndex((q) => q.ws === ws);
    if (idx >= 0) {
      this.queue.splice(idx, 1);
    }
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
    // online_2p = 3 players total (you + 2), online_3p = 4 players total (you + 3)
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
      const queueForMode = this.queue
        .filter((q) => q.mode === mode)
        .sort((a, b) => a.enqueuedAt - b.enqueuedAt);
      if (queueForMode.length === 0) continue;

      const oldest = queueForMode[0];
      if (now - oldest.enqueuedAt < BOT_FILL_TIMEOUT_MS) {
        continue;
      }

      const required = mode === "online_2p" ? 3 : 4;
      const humanCount = Math.min(required, queueForMode.length);
      const selected = queueForMode.slice(0, humanCount);
      selected.forEach((s) => this.removeFromQueueByWs(s.ws));
      await this.startMatch(mode, selected, true);
    }
  }

  private async startMatch(mode: Mode, humans: QueueEntry[], allowBots: boolean) {
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
      for (let i = 0; i < missing; i += 1) {
        players.push({
          id: randomUUID(),
          userId: null,
          name: randomBotName(i),
          isBot: true,
        });
      }
    }

    const runtime = this.gameService.createMatch(
      matchId,
      mode,
      players,
      allowBots && players.some((p) => p.isBot)
    );

    const dbMeta = await this.persistMatch(matchId, mode, players, runtime.isBotFilled);
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
        players: players.map((p) => ({
          id: p.id,
          name: p.name,
          isBot: p.isBot,
        })),
        state: runtime.state,
      });
    }

    const botTurn = this.gameService.processBotTurns(matchId);
    if (botTurn.progressed && botTurn.finalState) {
      this.broadcastMatchState(matchId, botTurn.finalState);
    }
  }

  private broadcastMatchState(matchId: string, state: unknown) {
    for (const client of this.clients.values()) {
      if (client.matchId === matchId) {
        send(client.ws, { type: "ONLINE_STATE_UPDATE", state });
      }
    }
  }

  private async ensureRankStats(userId: string, displayName: string) {
    try {
      const db = getDb();
      await db
        .insert(playerRankStats)
        .values({
          userId,
          displayName: displayName || "Player",
        })
        .onConflictDoNothing();
    } catch {
      // ignore in no-db dev mode
    }
  }

  private async persistMatch(
    matchId: string,
    mode: Mode,
    players: OnlinePlayer[],
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
          botProfileId: null,
          joinType: p.isBot ? "bot_timeout_fill" : "human_queue",
          joinedAt: new Date(),
        });
      }

      if (players.some((p) => !p.isBot)) {
        await db
          .update(matchmakingTickets)
          .set({ status: "matched", matchedAt: new Date() })
          .where(
            and(
              eq(matchmakingTickets.mode, mode),
              eq(matchmakingTickets.status, "queued")
            )
          );
      }

      return { matchId, dbMatchId: matchId, playerDbIds };
    } catch {
      return null;
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

    try {
      const db = getDb();
      await db.execute(
        sql`SELECT finalize_online_match(${matchId}::uuid, ${winnerDbPlayerId}::uuid, ${winnerScoreX})`
      );
    } catch {
      // Fallback to prevent runtime leak if DB finalization fails in dev without DB
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
