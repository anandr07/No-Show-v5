import type { Express } from "express";
import { createServer, type Server } from "node:http";
import { parse as parseUrl } from "node:url";
import { WebSocketServer, WebSocket } from "ws";
import { generateRoomCode, normalizeRoomCodeForJoin } from "../lib/gameEngine";
import {
  initMultiplayerGame,
  applyGameAction,
  type GameAction,
} from "./gameState";
import { registerAuthRoutes } from "./auth";
import { OnlineMatchmakingService } from "./onlineMatchmaking";
import { isSupabaseConfigured } from "./supabase";
import { isValidQuickChatMessageId } from "../constants/quickChatMessages";

interface RoomPlayer {
  id: string;
  name: string;
  isReady: boolean;
  isOwner: boolean;
  ws: WebSocket;
}

interface Room {
  code: string;
  players: RoomPlayer[];
  gameState: unknown;
  phase: "lobby" | "playing" | "finished";
  pendingDeletion?: NodeJS.Timeout;
}

const rooms = new Map<string, Room>();
const ROOM_EMPTY_GRACE_MS = 60_000;

function broadcast(room: Room, message: object, excludeId?: string) {
  const data = JSON.stringify(message);
  room.players.forEach((p) => {
    if (p.id !== excludeId && p.ws.readyState === WebSocket.OPEN) {
      p.ws.send(data);
    }
  });
}

function broadcastToAll(room: Room, message: object) {
  const data = JSON.stringify(message);
  room.players.forEach((p) => {
    if (p.ws.readyState === WebSocket.OPEN) {
      p.ws.send(data);
    }
  });
}

function getRoomInfo(room: Room) {
  return {
    code: room.code,
    phase: room.phase,
    players: room.players.map((p) => ({
      id: p.id,
      name: p.name,
      isReady: p.isReady,
      isOwner: p.isOwner,
    })),
  };
}

export async function registerRoutes(app: Express): Promise<Server> {
  registerAuthRoutes(app);

  const httpServer = createServer(app);
  const onlineService = new OnlineMatchmakingService();

  // Two WebSocketServer instances must use noServer + one upgrade handler.
  // If both use { server }, every upgrade hits BOTH listeners; the non-matching
  // server calls abortHandshake() and tears down the socket (browser shows
  // "Cannot reach server", Node ws client: open then close 1006).
  const wss = new WebSocketServer({ noServer: true, path: "/ws" });
  const onlineWss = new WebSocketServer({ noServer: true, path: "/ws-online" });
  onlineService.register(app, onlineWss);

  httpServer.on("upgrade", (request, socket, head) => {
    const pathname = parseUrl(request.url ?? "", false).pathname ?? "";

    if (pathname === "/ws") {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit("connection", ws, request);
      });
      return;
    }
    if (pathname === "/ws-online") {
      onlineWss.handleUpgrade(request, socket, head, (ws) => {
        onlineWss.emit("connection", ws, request);
      });
      return;
    }

    socket.destroy();
  });

  wss.on("connection", (ws: WebSocket) => {
    let currentRoomCode: string | null = null;
    let currentPlayerId: string | null = null;

    ws.on("message", (data: Buffer) => {
      let msg: { type: string; [key: string]: unknown };
      try {
        msg = JSON.parse(data.toString());
      } catch {
        return;
      }

      if (msg.type === "CREATE_ROOM") {
        const code = generateRoomCode();
        const playerId = Date.now().toString() + Math.random().toString(36).substr(2, 6);
        const room: Room = {
          code,
          players: [
            {
              id: playerId,
              name: msg.playerName as string,
              isReady: false,
              isOwner: true,
              ws,
            },
          ],
          gameState: null,
          phase: "lobby",
        };
        rooms.set(code, room);
        currentRoomCode = code;
        currentPlayerId = playerId;

        ws.send(JSON.stringify({
          type: "ROOM_CREATED",
          playerId,
          room: getRoomInfo(room),
        }));
      }

      else if (msg.type === "JOIN_ROOM") {
        const code = normalizeRoomCodeForJoin((msg.roomCode as string) || "");
        const room = rooms.get(code);

        if (!room) {
          ws.send(JSON.stringify({ type: "ERROR", message: "Room not found" }));
          return;
        }
        if (room.phase !== "lobby") {
          ws.send(JSON.stringify({ type: "ERROR", message: "Room not available" }));
          return;
        }
        if (room.players.length >= 4) {
          ws.send(JSON.stringify({ type: "ERROR", message: "Room is full" }));
          return;
        }

        if (room.pendingDeletion) {
          clearTimeout(room.pendingDeletion);
          delete room.pendingDeletion;
        }

        const playerId = Date.now().toString() + Math.random().toString(36).substr(2, 6);
        room.players.push({
          id: playerId,
          name: msg.playerName as string,
          isReady: false,
          isOwner: false,
          ws,
        });
        currentRoomCode = code;
        currentPlayerId = playerId;

        ws.send(JSON.stringify({
          type: "ROOM_JOINED",
          playerId,
          room: getRoomInfo(room),
        }));

        // Notify owner and all existing players so everyone sees the new joiner
        broadcastToAll(room, {
          type: "ROOM_UPDATED",
          room: getRoomInfo(room),
        });
      }

      else if (msg.type === "SET_READY") {
        if (!currentRoomCode || !currentPlayerId) return;
        const room = rooms.get(currentRoomCode);
        if (!room) return;

        const player = room.players.find((p) => p.id === currentPlayerId);
        if (player) {
          player.isReady = msg.ready as boolean;
          const roomPayload = getRoomInfo(room);
          broadcastToAll(room, { type: "ROOM_UPDATED", room: roomPayload });
        }
      }

      else if (msg.type === "START_GAME") {
        if (!currentRoomCode || !currentPlayerId) return;
        const room = rooms.get(currentRoomCode);
        if (!room) return;

        const owner = room.players.find((p) => p.id === currentPlayerId);
        if (!owner?.isOwner) {
          ws.send(JSON.stringify({ type: "ERROR", message: "Only the owner can start the game" }));
          return;
        }
        if (room.players.length < 3) {
          ws.send(JSON.stringify({ type: "ERROR", message: "Need 3+ players to start" }));
          return;
        }
        if (!room.players.every((p) => p.isReady)) {
          ws.send(JSON.stringify({ type: "ERROR", message: "All players must be ready" }));
          return;
        }

        room.phase = "playing";
        const playerData = room.players.map((p) => ({ id: p.id, name: p.name }));
        room.gameState = initMultiplayerGame(playerData);

        broadcastToAll(room, {
          type: "GAME_STARTED",
          state: room.gameState,
          players: playerData,
        });
      }

      else if (msg.type === "QUICK_CHAT") {
        if (!currentRoomCode || !currentPlayerId) return;
        const room = rooms.get(currentRoomCode);
        if (!room) return;
        if (room.phase !== "playing") return;
        const messageId = Number(msg.messageId);
        if (!isValidQuickChatMessageId(messageId)) return;
        broadcastToAll(room, {
          type: "QUICK_CHAT",
          playerId: currentPlayerId,
          messageId,
        });
      }

      else if (msg.type === "GAME_ACTION") {
        if (!currentRoomCode || !currentPlayerId) return;
        const room = rooms.get(currentRoomCode);
        if (!room) return;
        if (room.phase !== "playing" || !room.gameState) return;

        const action = msg.action as GameAction & { playerId?: string };
        if (!action?.type) return;
        action.playerId = currentPlayerId;

        const { state: newState, error } = applyGameAction(
          room.gameState as Parameters<typeof applyGameAction>[0],
          action
        );

        if (error) {
          ws.send(JSON.stringify({ type: "GAME_ACTION_ERROR", message: error }));
          return;
        }

        room.gameState = newState;
        broadcastToAll(room, { type: "GAME_STATE_UPDATE", state: newState });
      }

      else if (msg.type === "GAME_QUIT") {
        if (!currentRoomCode || !currentPlayerId) return;
        const room = rooms.get(currentRoomCode);
        if (!room) return;

        const playerName = room.players.find((p) => p.id === currentPlayerId)?.name ?? "Player";

        if (room.phase === "playing" && room.gameState) {
          const { state: newState } = applyGameAction(
            room.gameState as Parameters<typeof applyGameAction>[0],
            { type: "PLAYER_LEFT", playerId: currentPlayerId }
          );
          room.gameState = newState;

          const stillActive = (newState as { players: { status: string }[] }).players.filter(
            (p: { status: string }) => p.status === "active"
          );

          broadcastToAll(room, {
            type: "PLAYER_LEFT",
            playerId: currentPlayerId,
            playerName,
            state: newState,
            lastPlayerRemaining: stillActive.length <= 1,
          });
        } else {
          room.players = room.players.filter((p) => p.id !== currentPlayerId);
          broadcast(room, {
            type: "PLAYER_LEFT",
            playerId: currentPlayerId,
            playerName,
            room: getRoomInfo(room),
          });
        }

        if (room.players.length === 0) {
          if (room.phase === "lobby") {
            room.pendingDeletion = setTimeout(() => {
              rooms.delete(currentRoomCode!);
            }, ROOM_EMPTY_GRACE_MS);
          } else {
            rooms.delete(currentRoomCode);
          }
        } else if (room.phase === "lobby") {
          broadcastToAll(room, { type: "ROOM_UPDATED", room: getRoomInfo(room) });
        }
        currentRoomCode = null;
        currentPlayerId = null;
      }

      else if (msg.type === "LEAVE_ROOM") {
        if (!currentRoomCode || !currentPlayerId) return;
        const room = rooms.get(currentRoomCode);
        if (!room) return;

        const playerName = room.players.find((p) => p.id === currentPlayerId)?.name ?? "Player";
        room.players = room.players.filter((p) => p.id !== currentPlayerId);

        broadcast(room, {
          type: "PLAYER_LEFT",
          playerId: currentPlayerId,
          playerName,
          room: room.phase === "lobby" ? getRoomInfo(room) : undefined,
        });
        if (room.players.length === 0 && room.phase === "lobby") {
          room.pendingDeletion = setTimeout(() => {
            rooms.delete(currentRoomCode!);
          }, ROOM_EMPTY_GRACE_MS);
        } else if (room.players.length > 0 && room.phase === "lobby") {
          broadcastToAll(room, { type: "ROOM_UPDATED", room: getRoomInfo(room) });
        }
        currentRoomCode = null;
        currentPlayerId = null;
      }
    });

    ws.on("close", () => {
      if (!currentRoomCode || !currentPlayerId) return;
      const room = rooms.get(currentRoomCode);
      if (!room) return;

      const playerName = room.players.find((p) => p.id === currentPlayerId)?.name ?? "Player";

      if (room.phase === "playing" && room.gameState) {
        const { state: newState } = applyGameAction(
          room.gameState as Parameters<typeof applyGameAction>[0],
          { type: "PLAYER_LEFT", playerId: currentPlayerId }
        );
        room.gameState = newState;

        const stillActive = (newState as { players: { status: string }[] }).players.filter(
          (p: { status: string }) => p.status === "active"
        );

        broadcastToAll(room, {
          type: "PLAYER_LEFT",
          playerId: currentPlayerId,
          playerName,
          state: newState,
          lastPlayerRemaining: stillActive.length <= 1,
        });
      } else {
        room.players = room.players.filter((p) => p.id !== currentPlayerId);
        broadcast(room, {
          type: "PLAYER_LEFT",
          playerId: currentPlayerId,
          playerName,
          room: getRoomInfo(room),
        });
      }

      if (room.players.length === 0) {
        if (room.phase === "lobby") {
          room.pendingDeletion = setTimeout(() => {
            rooms.delete(currentRoomCode!);
          }, ROOM_EMPTY_GRACE_MS);
        } else {
          rooms.delete(currentRoomCode);
        }
      } else if (room.phase === "lobby") {
        broadcastToAll(room, { type: "ROOM_UPDATED", room: getRoomInfo(room) });
      }
    });
  });

  app.get("/api/health", (_, res) => {
    res.json({
      status: "ok",
      rooms: rooms.size,
      supabaseConfigured: isSupabaseConfigured(),
      dbConfigured: Boolean(process.env.DATABASE_URL ?? process.env.SUPABASE_DB_URL),
    });
  });

  app.get("/api/rooms", (_, res) => {
    const codes = Array.from(rooms.keys());
    res.json({ rooms: codes, count: codes.length });
  });

  return httpServer;
}
