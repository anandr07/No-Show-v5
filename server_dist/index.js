var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// server/index.ts
import express from "express";
import cookieParser from "cookie-parser";

// server/routes.ts
import { createServer } from "node:http";
import { WebSocketServer as WebSocketServer2, WebSocket as WebSocket2 } from "ws";

// lib/gameEngine.ts
var RANK_ORDER = {
  A: 1,
  "2": 2,
  "3": 3,
  "4": 4,
  "5": 5,
  "6": 6,
  "7": 7,
  "8": 8,
  "9": 9,
  "10": 10,
  J: 11,
  Q: 12,
  K: 13
};
function createDeck() {
  const suits = ["hearts", "diamonds", "clubs", "spades"];
  const ranks = [
    "A",
    "2",
    "3",
    "4",
    "5",
    "6",
    "7",
    "8",
    "9",
    "10",
    "J",
    "Q",
    "K"
  ];
  const deck = [];
  for (const suit of suits) {
    for (const rank of ranks) {
      deck.push({
        id: `${rank}-${suit}-${Date.now() + Math.random()}`,
        suit,
        rank,
        value: RANK_ORDER[rank]
      });
    }
  }
  return deck;
}
function shuffleDeck(deck) {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}
function sortHand(hand) {
  return [...hand].sort((a, b) => b.value - a.value);
}
function getHandScore(hand) {
  return hand.reduce((sum, c) => sum + c.value, 0);
}
function dealCards(players, deck) {
  const shuffled = shuffleDeck(deck);
  const activePlayers = players.filter((p) => p.status === "active");
  const starterIndex = Math.floor(Math.random() * activePlayers.length);
  let deckCursor = 0;
  const newPlayers = players.map((p) => ({ ...p, hand: [] }));
  activePlayers.forEach((p, idx) => {
    const count = idx === starterIndex ? 8 : 7;
    const playerInAll = newPlayers.findIndex((np) => np.id === p.id);
    newPlayers[playerInAll].hand = sortHand(
      shuffled.slice(deckCursor, deckCursor + count)
    );
    deckCursor += count;
  });
  const remaining = shuffled.slice(deckCursor);
  const openCard = remaining.length > 0 ? remaining[0] : null;
  const deckAfterOpen = remaining.length > 1 ? remaining.slice(1) : [];
  return {
    players: newPlayers,
    deck: deckAfterOpen,
    openCard,
    starterIndex: newPlayers.findIndex(
      (p) => p.id === activePlayers[starterIndex].id
    )
  };
}
function isValidThrow(cards) {
  if (cards.length === 0) return false;
  if (cards.length === 1) return true;
  if (cards.length >= 2) {
    const allSameRank = cards.every((c) => c.rank === cards[0].rank);
    if (allSameRank) return true;
  }
  if (cards.length >= 3) {
    const sorted = [...cards].sort((a, b) => a.value - b.value);
    let isSeq = true;
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].value !== sorted[i - 1].value + 1) {
        isSeq = false;
        break;
      }
    }
    if (isSeq) return true;
  }
  return false;
}
function computeShowScores(callerIndex, players) {
  const activePlayers = players.filter((p) => p.status === "active");
  const callerScore = getHandScore(activePlayers[callerIndex]?.hand ?? []);
  const lowestOther = activePlayers.filter((_, i) => i !== callerIndex).reduce(
    (min, p) => Math.min(min, getHandScore(p.hand)),
    Number.MAX_SAFE_INTEGER
  );
  const callerWon = callerScore <= lowestOther;
  return activePlayers.map((p, i) => {
    const score = getHandScore(p.hand);
    let delta;
    if (i === callerIndex) {
      delta = callerWon ? 0 : 15;
    } else {
      delta = callerWon ? Math.max(0, score - callerScore) : 0;
    }
    return { playerId: p.id, score, delta };
  });
}
function getActiveTurnOrder(players, startIndex) {
  const order = [];
  const n = players.length;
  for (let i = 0; i < n; i++) {
    const idx = (startIndex + i) % n;
    if (players[idx].status === "active") {
      order.push(idx);
    }
  }
  return order;
}
function getNextActiveIndex(players, currentIndex) {
  const n = players.length;
  for (let i = 1; i <= n; i++) {
    const idx = (currentIndex + i) % n;
    if (players[idx].status === "active") return idx;
  }
  return currentIndex;
}
var ROOM_CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
function generateRoomCode() {
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += ROOM_CODE_CHARS[Math.floor(Math.random() * ROOM_CODE_CHARS.length)];
  }
  return code;
}
function normalizeRoomCodeForJoin(input) {
  return input.trim().toUpperCase();
}
function createPlayer(name, type, id) {
  return {
    id: id ?? Date.now().toString() + Math.random().toString(36).substr(2, 9),
    name,
    type,
    hand: [],
    totalScore: 0,
    status: "active",
    isReady: type === "bot"
  };
}

// server/gameState.ts
function initMultiplayerGame(roomPlayers2) {
  const players = roomPlayers2.map(
    (p) => createPlayer(p.name, "human", p.id)
  );
  const { players: dealt, deck, openCard, starterIndex } = dealCards(players, createDeck());
  const turnOrder = getActiveTurnOrder(dealt, starterIndex);
  const initialThrown = openCard ? [openCard] : [];
  return {
    players: dealt,
    deck,
    openCard: null,
    lastThrown: initialThrown,
    lastThrownByPlayerId: null,
    pendingThrown: null,
    currentPlayerIndex: starterIndex,
    turnPhase: "throw",
    phase: "playing",
    round: 1,
    showCallerIndex: null,
    selectedCards: [],
    canCallShow: false,
    turnsCompletedThisRound: 0,
    roundScores: [],
    winner: null,
    hasPickedThisPhase: false,
    dealerIndex: 0,
    turnOrder,
    activeCount: dealt.filter((p) => p.status === "active").length
  };
}
function getPlayerIndex(players, playerId) {
  return players.findIndex((p) => p.id === playerId);
}
function getCallerIndexInActive(players, callerPlayerId) {
  const activePlayers = players.filter((p) => p.status === "active");
  return activePlayers.findIndex((p) => p.id === callerPlayerId);
}
function applyGameAction(state, action) {
  const playerIndex = "playerId" in action && action.playerId ? getPlayerIndex(state.players, action.playerId) : -1;
  if (playerIndex < 0 && action.type !== "PLAYER_LEFT" && action.type !== "NEXT_ROUND") {
    return { state, error: "Player not found" };
  }
  switch (action.type) {
    case "THROW_CARDS": {
      if (state.phase !== "playing") return { state, error: "Not in playing phase" };
      if (state.currentPlayerIndex !== playerIndex) return { state, error: "Not your turn" };
      if (state.turnPhase !== "throw") return { state, error: "Must pick first" };
      const player = state.players[playerIndex];
      if (!player || player.status !== "active") return { state, error: "Invalid player" };
      const handCards = player.hand.filter(
        (c) => action.cards.some((ac) => ac.id === c.id)
      );
      if (handCards.length !== action.cards.length) return { state, error: "Invalid cards" };
      if (!isValidThrow(handCards)) return { state, error: "Invalid throw" };
      const remaining = player.hand.filter(
        (c) => !action.cards.find((tc) => tc.id === c.id)
      );
      const newPlayers = state.players.map(
        (p, i) => i === playerIndex ? { ...p, hand: remaining } : p
      );
      return {
        state: {
          ...state,
          players: newPlayers,
          pendingThrown: action.cards,
          turnPhase: "pick",
          selectedCards: [],
          hasPickedThisPhase: false
        }
      };
    }
    case "PICK_FROM_DECK": {
      if (state.phase !== "playing") return { state, error: "Not in playing phase" };
      if (state.currentPlayerIndex !== playerIndex) return { state, error: "Not your turn" };
      if (state.turnPhase !== "pick") return { state, error: "Must throw first" };
      const card = state.deck[0];
      if (!card) return { state, error: "Deck empty" };
      const newPlayers = state.players.map(
        (p, i) => i === playerIndex ? { ...p, hand: sortHand([...p.hand, card]) } : p
      );
      const nextIndex = getNextActiveIndex(state.players, playerIndex);
      const activePlayers = state.players.filter((p) => p.status === "active");
      const turnsCompleted = (state.turnsCompletedThisRound ?? 0) + 1;
      const canShow = turnsCompleted >= activePlayers.length;
      return {
        state: {
          ...state,
          players: newPlayers,
          deck: state.deck.slice(1),
          lastThrown: state.pendingThrown ?? [],
          lastThrownByPlayerId: action.playerId,
          pendingThrown: null,
          currentPlayerIndex: nextIndex,
          turnPhase: "throw",
          hasPickedThisPhase: true,
          turnsCompletedThisRound: turnsCompleted,
          canCallShow: state.canCallShow || canShow
        }
      };
    }
    case "PICK_FROM_THROWN": {
      if (state.phase !== "playing") return { state, error: "Not in playing phase" };
      if (state.currentPlayerIndex !== playerIndex) return { state, error: "Not your turn" };
      if (state.turnPhase !== "pick") return { state, error: "Must pick first" };
      if (state.lastThrownByPlayerId === action.playerId) {
        return { state, error: "Cannot pick your own thrown cards" };
      }
      const card = state.lastThrown.find((c) => c.id === action.cardId);
      if (!card) return { state, error: "Card not in thrown pile" };
      const remaining = state.lastThrown.filter((c) => c.id !== action.cardId);
      const newPlayers = state.players.map(
        (p, i) => i === playerIndex ? { ...p, hand: sortHand([...p.hand, card]) } : p
      );
      const nextIndex = getNextActiveIndex(state.players, playerIndex);
      const activePlayers = state.players.filter((p) => p.status === "active");
      const turnsCompleted = (state.turnsCompletedThisRound ?? 0) + 1;
      const canShow = turnsCompleted >= activePlayers.length;
      return {
        state: {
          ...state,
          players: newPlayers,
          lastThrown: state.pendingThrown ?? [],
          lastThrownByPlayerId: action.playerId,
          pendingThrown: null,
          currentPlayerIndex: nextIndex,
          turnPhase: "throw",
          hasPickedThisPhase: true,
          turnsCompletedThisRound: turnsCompleted,
          canCallShow: state.canCallShow || canShow
        }
      };
    }
    case "CALL_SHOW": {
      if (state.phase !== "playing") return { state, error: "Not in playing phase" };
      if (state.currentPlayerIndex !== playerIndex) return { state, error: "Not your turn" };
      if (state.turnPhase !== "throw") return { state, error: "Must pick first" };
      if (!state.canCallShow) return { state, error: "Show not available yet" };
      const activePlayers = state.players.filter((p) => p.status === "active");
      const callerIndexInActive = getCallerIndexInActive(state.players, action.playerId);
      if (callerIndexInActive < 0) return { state, error: "Invalid caller" };
      const scores = computeShowScores(callerIndexInActive, state.players);
      const existingEliminatedCount = state.players.filter((p) => p.status === "eliminated").length;
      let newPlayers = state.players.map((p) => {
        const score = scores.find((s) => s.playerId === p.id);
        if (!score || p.status !== "active") return p;
        const newTotal = p.totalScore + score.delta;
        return {
          ...p,
          totalScore: newTotal,
          roundScore: score.score,
          status: newTotal >= 100 ? "eliminated" : p.status
        };
      });
      const newlyEliminated = newPlayers.filter((p) => p.status === "eliminated" && p.eliminationOrder == null).sort((a, b) => b.totalScore - a.totalScore);
      newlyEliminated.forEach((p, i) => {
        const idx = newPlayers.findIndex((np) => np.id === p.id);
        if (idx >= 0) {
          newPlayers = newPlayers.map(
            (np, j) => j === idx ? { ...np, eliminationOrder: existingEliminatedCount + i + 1 } : np
          );
        }
      });
      return {
        state: {
          ...state,
          players: newPlayers,
          showCallerIndex: playerIndex,
          roundScores: scores,
          phase: "show"
        }
      };
    }
    case "NEXT_ROUND": {
      if (state.phase !== "show") return { state, error: "Not in show phase" };
      const activePlayers = state.players.filter((p) => p.status === "active");
      if (activePlayers.length <= 1) {
        const winner = activePlayers[0] ?? (state.players.length > 0 ? state.players.reduce(
          (lowest, p) => (lowest?.totalScore ?? Infinity) <= (p.totalScore ?? Infinity) ? lowest : p
        ) : null);
        return {
          state: {
            ...state,
            phase: "gameOver",
            winner
          }
        };
      }
      const { players: dealt, deck, openCard, starterIndex } = dealCards(
        state.players,
        createDeck()
      );
      const turnOrder = getActiveTurnOrder(dealt, starterIndex);
      const initialThrown = openCard ? [openCard] : [];
      return {
        state: {
          ...state,
          players: dealt,
          deck,
          openCard: null,
          lastThrown: initialThrown,
          lastThrownByPlayerId: null,
          pendingThrown: null,
          currentPlayerIndex: starterIndex,
          turnPhase: "throw",
          phase: "playing",
          round: state.round + 1,
          showCallerIndex: null,
          selectedCards: [],
          canCallShow: false,
          turnsCompletedThisRound: 0,
          roundScores: [],
          hasPickedThisPhase: false,
          turnOrder,
          activeCount: activePlayers.length
        }
      };
    }
    case "PLAYER_LEFT": {
      const newPlayers = state.players.map(
        (p) => p.id === action.playerId ? { ...p, status: "left" } : p
      );
      const stillActive = newPlayers.filter((p) => p.status === "active");
      if (stillActive.length <= 1) {
        return {
          state: {
            ...state,
            players: newPlayers,
            phase: "gameOver",
            winner: stillActive[0] ?? null
          }
        };
      }
      let newCurrentIndex = state.currentPlayerIndex;
      if (state.players[state.currentPlayerIndex]?.id === action.playerId) {
        newCurrentIndex = getNextActiveIndex(newPlayers, state.currentPlayerIndex);
      } else {
        const leftIdx = getPlayerIndex(state.players, action.playerId);
        if (leftIdx < state.currentPlayerIndex) {
          newCurrentIndex = Math.max(0, state.currentPlayerIndex - 1);
        }
      }
      return {
        state: {
          ...state,
          players: newPlayers,
          currentPlayerIndex: newCurrentIndex,
          activeCount: stillActive.length
        }
      };
    }
    default:
      return { state };
  }
}

// server/auth.ts
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

// server/db.ts
import * as dotenv from "dotenv";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";

// shared/schema.ts
var schema_exports = {};
__export(schema_exports, {
  botDifficultyEnum: () => botDifficultyEnum,
  botProfiles: () => botProfiles,
  friendStatusEnum: () => friendStatusEnum,
  friends: () => friends,
  gameHistory: () => gameHistory,
  gameModeEnum: () => gameModeEnum,
  gamePlayers: () => gamePlayers,
  gamePlayersRelations: () => gamePlayersRelations,
  gameScoringConfig: () => gameScoringConfig,
  gameStatusEnum: () => gameStatusEnum,
  games: () => games,
  gamesRelations: () => gamesRelations,
  insertGamePlayerSchema: () => insertGamePlayerSchema,
  insertGameSchema: () => insertGameSchema,
  insertProfileSchema: () => insertProfileSchema,
  insertRoomPlayerSchema: () => insertRoomPlayerSchema,
  insertRoomSchema: () => insertRoomSchema,
  insertUserSchema: () => insertUserSchema,
  levelDefinitions: () => levelDefinitions,
  matchmakingModeEnum: () => matchmakingModeEnum,
  matchmakingTickets: () => matchmakingTickets,
  onlineJoinTypeEnum: () => onlineJoinTypeEnum,
  onlineMatchPlayers: () => onlineMatchPlayers,
  onlineMatchResults: () => onlineMatchResults,
  onlineMatchRounds: () => onlineMatchRounds,
  onlineMatchStatusEnum: () => onlineMatchStatusEnum,
  onlineMatches: () => onlineMatches,
  onlinePointsLedger: () => onlinePointsLedger,
  onlineRoundScores: () => onlineRoundScores,
  playerRankStats: () => playerRankStats,
  playerStatusEnum: () => playerStatusEnum,
  playerTypeEnum: () => playerTypeEnum,
  pointsChangeTypeEnum: () => pointsChangeTypeEnum,
  profileSettings: () => profileSettings,
  profiles: () => profiles,
  profilesRelations: () => profilesRelations,
  roomPlayers: () => roomPlayers,
  roomPlayersRelations: () => roomPlayersRelations,
  roomStatusEnum: () => roomStatusEnum,
  rooms: () => rooms,
  roomsRelations: () => roomsRelations,
  selectGamePlayerSchema: () => selectGamePlayerSchema,
  selectGameSchema: () => selectGameSchema,
  selectProfileSchema: () => selectProfileSchema,
  selectRoomPlayerSchema: () => selectRoomPlayerSchema,
  selectRoomSchema: () => selectRoomSchema,
  ticketStatusEnum: () => ticketStatusEnum,
  users: () => users
});
import { relations } from "drizzle-orm";
import {
  pgTable,
  uuid,
  text,
  varchar,
  integer,
  boolean,
  timestamp,
  pgEnum,
  jsonb,
  index,
  numeric,
  smallint,
  uniqueIndex
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
var gameModeEnum = pgEnum("game_mode", [
  "vs_system",
  "multiplayer",
  "online"
]);
var roomStatusEnum = pgEnum("room_status", [
  "lobby",
  "playing",
  "finished"
]);
var playerTypeEnum = pgEnum("player_type", ["human", "bot"]);
var playerStatusEnum = pgEnum("player_status", [
  "active",
  "eliminated",
  "left"
]);
var gameStatusEnum = pgEnum("game_status", ["playing", "finished"]);
var profiles = pgTable("profiles", {
  id: uuid("id").primaryKey(),
  displayName: text("display_name").notNull().default("Player"),
  username: text("username").unique(),
  avatarUrl: text("avatar_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});
var rooms = pgTable(
  "rooms",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: varchar("code", { length: 6 }).notNull().unique(),
    ownerId: uuid("owner_id").references(() => profiles.id, { onDelete: "set null" }),
    ownerDisplayName: text("owner_display_name"),
    status: roomStatusEnum("status").notNull().default("lobby"),
    maxPlayers: integer("max_players").notNull().default(6),
    minPlayersToStart: integer("min_players_to_start").notNull().default(3),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [index("rooms_code_idx").on(t.code), index("rooms_status_idx").on(t.status)]
);
var roomPlayers = pgTable(
  "room_players",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    roomId: uuid("room_id").notNull().references(() => rooms.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => profiles.id, { onDelete: "set null" }),
    displayName: text("display_name").notNull(),
    isOwner: boolean("is_owner").notNull().default(false),
    isReady: boolean("is_ready").notNull().default(false),
    seatIndex: integer("seat_index").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [
    index("room_players_room_idx").on(t.roomId),
    index("room_players_user_idx").on(t.userId)
  ]
);
var games = pgTable(
  "games",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    mode: gameModeEnum("mode").notNull(),
    roomId: uuid("room_id").references(() => rooms.id, { onDelete: "set null" }),
    createdById: uuid("created_by_id").references(() => profiles.id, {
      onDelete: "set null"
    }),
    status: gameStatusEnum("status").notNull().default("playing"),
    gameState: jsonb("game_state"),
    winnerId: uuid("winner_id").references(() => profiles.id, {
      onDelete: "set null"
    }),
    roundCount: integer("round_count").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true })
  },
  (t) => [
    index("games_room_idx").on(t.roomId),
    index("games_status_idx").on(t.status),
    index("games_created_by_idx").on(t.createdById)
  ]
);
var gamePlayers = pgTable(
  "game_players",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    gameId: uuid("game_id").notNull().references(() => games.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => profiles.id, { onDelete: "set null" }),
    displayName: text("display_name").notNull(),
    playerType: playerTypeEnum("player_type").notNull(),
    seatIndex: integer("seat_index").notNull(),
    status: playerStatusEnum("status").notNull().default("active"),
    totalScore: integer("total_score").notNull().default(0),
    finalPlace: integer("final_place"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [
    index("game_players_game_idx").on(t.gameId),
    index("game_players_user_idx").on(t.userId)
  ]
);
var gameHistory = pgTable(
  "game_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    gameId: uuid("game_id").notNull().references(() => games.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => profiles.id, { onDelete: "set null" }),
    displayName: text("display_name").notNull(),
    playerType: playerTypeEnum("player_type").notNull(),
    place: integer("place").notNull(),
    finalScore: integer("final_score").notNull(),
    mode: gameModeEnum("mode").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [
    index("game_history_user_idx").on(t.userId),
    index("game_history_game_idx").on(t.gameId),
    index("game_history_created_idx").on(t.createdAt)
  ]
);
var friendStatusEnum = pgEnum("friend_status", [
  "pending",
  "accepted",
  "blocked"
]);
var friends = pgTable(
  "friends",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
    friendId: uuid("friend_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
    status: friendStatusEnum("status").notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [
    index("friends_user_idx").on(t.userId),
    index("friends_friend_idx").on(t.friendId)
  ]
);
var users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});
var profilesRelations = relations(profiles, ({ many }) => ({
  roomsOwned: many(rooms),
  roomPlayers: many(roomPlayers),
  gamePlayers: many(gamePlayers),
  gamesCreated: many(games)
}));
var roomsRelations = relations(rooms, ({ one, many }) => ({
  owner: one(profiles, {
    fields: [rooms.ownerId],
    references: [profiles.id]
  }),
  roomPlayers: many(roomPlayers),
  games: many(games)
}));
var roomPlayersRelations = relations(roomPlayers, ({ one }) => ({
  room: one(rooms, {
    fields: [roomPlayers.roomId],
    references: [rooms.id]
  }),
  user: one(profiles, {
    fields: [roomPlayers.userId],
    references: [profiles.id]
  })
}));
var gamesRelations = relations(games, ({ one, many }) => ({
  room: one(rooms, {
    fields: [games.roomId],
    references: [rooms.id]
  }),
  createdBy: one(profiles, {
    fields: [games.createdById],
    references: [profiles.id]
  }),
  winner: one(profiles, {
    fields: [games.winnerId],
    references: [profiles.id]
  }),
  gamePlayers: many(gamePlayers)
}));
var gamePlayersRelations = relations(gamePlayers, ({ one }) => ({
  game: one(games, {
    fields: [gamePlayers.gameId],
    references: [games.id]
  }),
  user: one(profiles, {
    fields: [gamePlayers.userId],
    references: [profiles.id]
  })
}));
var insertProfileSchema = createInsertSchema(profiles);
var selectProfileSchema = createSelectSchema(profiles);
var insertRoomSchema = createInsertSchema(rooms);
var selectRoomSchema = createSelectSchema(rooms);
var insertRoomPlayerSchema = createInsertSchema(roomPlayers);
var selectRoomPlayerSchema = createSelectSchema(roomPlayers);
var insertGameSchema = createInsertSchema(games);
var selectGameSchema = createSelectSchema(games);
var insertGamePlayerSchema = createInsertSchema(gamePlayers);
var selectGamePlayerSchema = createSelectSchema(gamePlayers);
var insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true
});
var matchmakingModeEnum = pgEnum("matchmaking_mode", [
  "online_2p",
  "online_3p"
]);
var ticketStatusEnum = pgEnum("ticket_status", [
  "queued",
  "matched",
  "cancelled",
  "expired"
]);
var onlineMatchStatusEnum = pgEnum("online_match_status", [
  "waiting",
  "in_progress",
  "completed",
  "cancelled"
]);
var onlineJoinTypeEnum = pgEnum("online_join_type", [
  "human_queue",
  "human_reconnect",
  "bot_timeout_fill"
]);
var botDifficultyEnum = pgEnum("bot_difficulty", [
  "easy",
  "normal",
  "hard"
]);
var pointsChangeTypeEnum = pgEnum("points_change_type", [
  "win_award",
  "loss_penalty",
  "adjustment"
]);
var profileSettings = pgTable("player_settings", {
  userId: uuid("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  soundEnabled: boolean("sound_enabled").notNull().default(true),
  hapticsEnabled: boolean("haptics_enabled").notNull().default(true),
  notificationsEnabled: boolean("notifications_enabled").notNull().default(true),
  languageCode: varchar("language_code", { length: 8 }).notNull().default("en"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});
var playerRankStats = pgTable(
  "player_rank_stats",
  {
    userId: uuid("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
    displayName: text("display_name").notNull().default("Player"),
    onlinePointsTotal: integer("online_points_total").notNull().default(0),
    onlineWins: integer("online_wins").notNull().default(0),
    onlineLosses: integer("online_losses").notNull().default(0),
    onlineGamesPlayed: integer("online_games_played").notNull().default(0),
    currentLevel: smallint("current_level").notNull().default(1),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [index("player_rank_stats_points_idx").on(t.onlinePointsTotal)]
);
var matchmakingTickets = pgTable(
  "matchmaking_tickets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    mode: matchmakingModeEnum("mode").notNull(),
    region: varchar("region", { length: 32 }),
    status: ticketStatusEnum("status").notNull().default("queued"),
    queuedAt: timestamp("queued_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    matchedAt: timestamp("matched_at", { withTimezone: true })
  },
  (t) => [
    index("matchmaking_tickets_mode_status_queued_idx").on(
      t.mode,
      t.status,
      t.queuedAt
    ),
    index("matchmaking_tickets_user_idx").on(t.userId)
  ]
);
var botProfiles = pgTable("bot_profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  botName: varchar("bot_name", { length: 32 }).notNull().unique(),
  difficulty: botDifficultyEnum("difficulty").notNull().default("normal"),
  behaviorSeed: jsonb("behavior_seed").notNull().default({}),
  active: boolean("active").notNull().default(true)
});
var onlineMatches = pgTable(
  "online_matches",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    mode: matchmakingModeEnum("mode").notNull(),
    status: onlineMatchStatusEnum("status").notNull().default("waiting"),
    isBotFilled: boolean("is_bot_filled").notNull().default(false),
    botFillStartedAt: timestamp("bot_fill_started_at", { withTimezone: true }),
    startedAt: timestamp("started_at", { withTimezone: true }),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    winnerUserId: uuid("winner_user_id").references(() => users.id, { onDelete: "set null" }),
    winningScoreX: integer("winning_score_x")
  },
  (t) => [index("online_matches_status_idx").on(t.status)]
);
var onlineMatchPlayers = pgTable(
  "online_match_players",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    matchId: uuid("match_id").notNull().references(() => onlineMatches.id, { onDelete: "cascade" }),
    slotIndex: smallint("slot_index").notNull(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    isBot: boolean("is_bot").notNull().default(false),
    botProfileId: uuid("bot_profile_id").references(() => botProfiles.id, {
      onDelete: "set null"
    }),
    joinType: onlineJoinTypeEnum("join_type").notNull(),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [
    uniqueIndex("online_match_players_match_slot_unique").on(t.matchId, t.slotIndex),
    index("online_match_players_match_idx").on(t.matchId),
    index("online_match_players_user_idx").on(t.userId)
  ]
);
var onlineMatchRounds = pgTable(
  "online_match_rounds",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    matchId: uuid("match_id").notNull().references(() => onlineMatches.id, { onDelete: "cascade" }),
    roundNumber: integer("round_number").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    endedAt: timestamp("ended_at", { withTimezone: true })
  },
  (t) => [
    uniqueIndex("online_match_rounds_match_round_unique").on(t.matchId, t.roundNumber)
  ]
);
var onlineRoundScores = pgTable(
  "online_round_scores",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    roundId: uuid("round_id").notNull().references(() => onlineMatchRounds.id, { onDelete: "cascade" }),
    matchPlayerId: uuid("match_player_id").notNull().references(() => onlineMatchPlayers.id, { onDelete: "cascade" }),
    roundScoreDelta: integer("round_score_delta").notNull(),
    cumulativeScore: integer("cumulative_score").notNull()
  },
  (t) => [
    uniqueIndex("online_round_scores_round_player_unique").on(t.roundId, t.matchPlayerId)
  ]
);
var gameScoringConfig = pgTable("game_scoring_config", {
  id: smallint("id").primaryKey().default(1),
  lossPenaltyPoints: integer("loss_penalty_points").notNull().default(20),
  botMatchReductionFactor: numeric("bot_match_reduction_factor", {
    precision: 4,
    scale: 2
  }).notNull().default("0.50"),
  levelStepPoints: integer("level_step_points").notNull().default(1e3),
  maxLevels: smallint("max_levels").notNull().default(6),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});
var onlineMatchResults = pgTable("online_match_results", {
  id: uuid("id").primaryKey().defaultRandom(),
  matchId: uuid("match_id").notNull().unique().references(() => onlineMatches.id, { onDelete: "cascade" }),
  winnerMatchPlayerId: uuid("winner_match_player_id").notNull().references(() => onlineMatchPlayers.id, { onDelete: "restrict" }),
  winnerUserId: uuid("winner_user_id").references(() => users.id, { onDelete: "set null" }),
  winnerPointsBase: integer("winner_points_base").notNull(),
  botReductionFactor: numeric("bot_reduction_factor", { precision: 4, scale: 2 }).notNull().default("0.50"),
  winnerPointsFinal: integer("winner_points_final").notNull(),
  lossPenalty: integer("loss_penalty").notNull().default(20),
  isRanked: boolean("is_ranked").notNull().default(true),
  computedAt: timestamp("computed_at", { withTimezone: true }).notNull().defaultNow()
});
var onlinePointsLedger = pgTable(
  "online_points_ledger",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    matchId: uuid("match_id").notNull().references(() => onlineMatches.id, { onDelete: "cascade" }),
    changeType: pointsChangeTypeEnum("change_type").notNull(),
    pointsDelta: integer("points_delta").notNull(),
    balanceAfter: integer("balance_after").notNull(),
    reason: text("reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [
    index("online_points_ledger_user_created_idx").on(t.userId, t.createdAt),
    uniqueIndex("online_points_ledger_user_match_type_unique").on(
      t.userId,
      t.matchId,
      t.changeType
    )
  ]
);
var levelDefinitions = pgTable("level_definitions", {
  level: smallint("level").primaryKey(),
  name: varchar("name", { length: 64 }).notNull().unique(),
  minPoints: integer("min_points").notNull(),
  maxPoints: integer("max_points")
});

// server/db.ts
var { Pool } = pg;
dotenv.config();
function createDb() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) return null;
  const pool2 = new Pool({ connectionString });
  return drizzle(pool2, { schema: schema_exports });
}
var db = createDb();
function getDb() {
  if (!db) {
    throw new Error(
      "DATABASE_URL must be set. Create a `.env` (or `.env.local`) file in the project root with DATABASE_URL=... (see `docs/SUPABASE_SETUP.md`)."
    );
  }
  return db;
}
var pool = (() => {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) return null;
  return new Pool({ connectionString });
})();

// server/auth.ts
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";
var JWT_SECRET = process.env.JWT_SECRET ?? "no-show-dev-secret-change-in-prod";
var COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1e3;
function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}
function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}
function getTokenFromRequest(req) {
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
function registerAuthRoutes(app2) {
  app2.post("/api/auth/signup", async (req, res) => {
    const { email, password, display_name } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }
    const db2 = getDb();
    const username = email.toLowerCase().trim();
    const existing = await db2.select().from(users).where(eq(users.username, username)).limit(1);
    if (existing.length > 0) {
      return res.status(409).json({ error: "An account with this email already exists" });
    }
    const hashed = await bcrypt.hash(password, 12);
    const id = randomUUID();
    const displayName = display_name?.trim() || username.split("@")[0];
    const [user] = await db2.insert(users).values({ id, username, password: hashed }).returning();
    const token = signToken({
      sub: user.id,
      username: user.username,
      email: user.username,
      display_name: displayName
    });
    res.cookie("auth_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: COOKIE_MAX_AGE
    });
    return res.status(201).json({
      user: {
        id: user.id,
        email: user.username,
        user_metadata: { display_name: displayName }
      },
      token
    });
  });
  app2.post("/api/auth/signin", async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }
    const db2 = getDb();
    const username = email.toLowerCase().trim();
    const [user] = await db2.select().from(users).where(eq(users.username, username)).limit(1);
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
      display_name: displayName
    });
    res.cookie("auth_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: COOKIE_MAX_AGE
    });
    return res.json({
      user: {
        id: user.id,
        email: user.username,
        user_metadata: { display_name: displayName }
      },
      token
    });
  });
  app2.post("/api/auth/signout", (_req, res) => {
    res.clearCookie("auth_token");
    return res.json({ success: true });
  });
  app2.get("/api/auth/session", (req, res) => {
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
        user_metadata: { display_name: payload.display_name }
      },
      session: { access_token: token }
    });
  });
}

// server/onlineMatchmaking.ts
import { randomUUID as randomUUID2 } from "crypto";
import { WebSocket } from "ws";
import { and, desc, eq as eq2, sql } from "drizzle-orm";

// server/botService.ts
function pickRandom(items) {
  if (items.length === 0) return null;
  const idx = Math.floor(Math.random() * items.length);
  return items[idx] ?? null;
}
function chooseThrowCards(hand) {
  if (hand.length === 0) return [];
  const byRank = /* @__PURE__ */ new Map();
  hand.forEach((card) => {
    const rank = card.rank;
    const existing = byRank.get(rank) ?? [];
    existing.push(card);
    byRank.set(rank, existing);
  });
  const pairOrSet = Array.from(byRank.values()).filter((cards) => cards.length >= 2).sort((a, b) => b.length - a.length)[0];
  if (pairOrSet) {
    return pairOrSet.slice(0, Math.min(pairOrSet.length, 3));
  }
  const sorted = [...hand].sort((a, b) => a.value - b.value);
  return [sorted[0]];
}
function decideBotAction(state, botId) {
  const botIndex = state.players.findIndex((p) => p.id === botId);
  if (botIndex < 0) return null;
  if (state.currentPlayerIndex !== botIndex) return null;
  if (state.players[botIndex]?.status !== "active") return null;
  const bot = state.players[botIndex];
  const handScore = bot.hand.reduce((sum, c) => sum + c.value, 0);
  if (state.turnPhase === "throw") {
    if (state.canCallShow && handScore <= 30) {
      return { type: "CALL_SHOW", playerId: botId };
    }
    const cards = chooseThrowCards(bot.hand);
    if (cards.length === 0) return null;
    return { type: "THROW_CARDS", playerId: botId, cards };
  }
  if (state.turnPhase === "pick") {
    const canPickThrown = state.lastThrown.length > 0 && (state.lastThrownByPlayerId ?? "") !== botId;
    if (canPickThrown && Math.random() > 0.45) {
      const card = pickRandom(state.lastThrown);
      if (card) {
        return { type: "PICK_FROM_THROWN", playerId: botId, cardId: card.id };
      }
    }
    return { type: "PICK_FROM_DECK", playerId: botId };
  }
  return null;
}

// server/onlineGameService.ts
var OnlineGameService = class {
  matches = /* @__PURE__ */ new Map();
  createMatch(id, mode, players, isBotFilled) {
    const initial = initMultiplayerGame(players.map((p) => ({ id: p.id, name: p.name })));
    const runtime = {
      id,
      mode,
      players,
      state: initial,
      createdAt: Date.now(),
      isBotFilled
    };
    this.matches.set(id, runtime);
    return runtime;
  }
  getMatch(matchId) {
    return this.matches.get(matchId) ?? null;
  }
  removeMatch(matchId) {
    this.matches.delete(matchId);
  }
  applyAction(matchId, action) {
    const match = this.matches.get(matchId);
    if (!match) return null;
    const result = applyGameAction(match.state, action);
    match.state = result.state;
    return result;
  }
  processBotTurns(matchId) {
    const match = this.matches.get(matchId);
    if (!match) return { progressed: false, finalState: null };
    let progressed = false;
    let safety = 0;
    while (safety < 24) {
      safety += 1;
      if (match.state.phase === "gameOver") break;
      const current = match.state.players[match.state.currentPlayerIndex];
      const isBot = match.players.find((p) => p.id === current.id)?.isBot;
      if (!current) break;
      if (!isBot) break;
      const botAction = decideBotAction(match.state, current.id);
      if (!botAction) break;
      const result = applyGameAction(match.state, botAction);
      match.state = result.state;
      progressed = true;
      if (result.error) break;
    }
    return { progressed, finalState: match.state };
  }
};

// server/onlineMatchmaking.ts
var BOT_FILL_TIMEOUT_MS = 18e4;
var BOT_REDUCTION_FALLBACK = 0.5;
function send(ws, payload) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}
function randomBotName(index2) {
  const names = ["Falcon", "Raven", "Joker", "Ace", "Bluff", "Dealer", "Shadow"];
  return `${names[index2 % names.length]} Bot`;
}
var OnlineMatchmakingService = class {
  clients = /* @__PURE__ */ new Map();
  queue = [];
  gameService = new OnlineGameService();
  matchMeta = /* @__PURE__ */ new Map();
  timer;
  constructor() {
    this.timer = setInterval(() => {
      void this.processTimeouts();
    }, 3e3);
  }
  register(app2, wss) {
    wss.on("connection", (ws) => this.handleConnection(ws));
    app2.get("/api/online/leaderboard", async (_req, res) => {
      try {
        const db2 = getDb();
        const rows = await db2.execute(sql`
          SELECT * FROM v_online_global_leaderboard
          ORDER BY global_rank ASC
          LIMIT 100
        `);
        return res.json({ leaderboard: rows.rows ?? [] });
      } catch (err) {
        return res.status(500).json({ error: "Failed to load leaderboard" });
      }
    });
    app2.get("/api/online/profile/:userId", async (req, res) => {
      try {
        const db2 = getDb();
        const userId = req.params.userId;
        const [stats] = await db2.select().from(playerRankStats).where(eq2(playerRankStats.userId, userId)).limit(1);
        const [lastEntries] = await Promise.all([
          db2.select().from(onlinePointsLedger).where(eq2(onlinePointsLedger.userId, userId)).orderBy(desc(onlinePointsLedger.createdAt)).limit(20)
        ]);
        return res.json({
          stats: stats ?? null,
          recentLedger: lastEntries
        });
      } catch {
        return res.status(500).json({ error: "Failed to load profile" });
      }
    });
  }
  handleConnection(ws) {
    ws.on("message", (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
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
  async handleMessage(ws, msg) {
    if (msg.type === "QUEUE_JOIN") {
      const mode = msg.mode;
      const name = String(msg.playerName ?? "Player").trim() || "Player";
      const userId = String(msg.userId ?? "").trim();
      if (!userId || mode !== "online_2p" && mode !== "online_3p") {
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
      const action = msg.action;
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
  async enqueue(ws, userId, name, mode) {
    this.removeFromQueueByWs(ws);
    const ticketId = randomUUID2();
    this.queue.push({
      ws,
      userId,
      name,
      mode,
      enqueuedAt: Date.now(),
      ticketId
    });
    try {
      const db2 = getDb();
      await db2.insert(matchmakingTickets).values({
        id: ticketId,
        userId,
        mode,
        status: "queued",
        queuedAt: /* @__PURE__ */ new Date(),
        expiresAt: new Date(Date.now() + BOT_FILL_TIMEOUT_MS)
      });
    } catch {
    }
    send(ws, {
      type: "QUEUE_STATUS",
      status: "queued",
      mode,
      waitSeconds: 0
    });
  }
  removeFromQueueByWs(ws) {
    const idx = this.queue.findIndex((q) => q.ws === ws);
    if (idx >= 0) {
      this.queue.splice(idx, 1);
    }
  }
  async cancelQueueByWs(ws) {
    const entry = this.queue.find((q) => q.ws === ws);
    this.removeFromQueueByWs(ws);
    if (entry) {
      try {
        const db2 = getDb();
        await db2.update(matchmakingTickets).set({ status: "cancelled" }).where(eq2(matchmakingTickets.id, entry.ticketId));
      } catch {
      }
    }
    send(ws, { type: "QUEUE_STATUS", status: "cancelled" });
  }
  async tryMatch(mode) {
    const required = mode === "online_2p" ? 2 : 3;
    const entries = this.queue.filter((q) => q.mode === mode);
    if (entries.length < required) return;
    const selected = entries.slice(0, required);
    selected.forEach((s) => this.removeFromQueueByWs(s.ws));
    await this.startMatch(mode, selected, false);
  }
  async processTimeouts() {
    const now = Date.now();
    const modes = ["online_2p", "online_3p"];
    for (const mode of modes) {
      const queueForMode = this.queue.filter((q) => q.mode === mode).sort((a, b) => a.enqueuedAt - b.enqueuedAt);
      if (queueForMode.length === 0) continue;
      const oldest = queueForMode[0];
      if (now - oldest.enqueuedAt < BOT_FILL_TIMEOUT_MS) {
        continue;
      }
      const required = mode === "online_2p" ? 2 : 3;
      const humanCount = Math.min(required, queueForMode.length);
      const selected = queueForMode.slice(0, humanCount);
      selected.forEach((s) => this.removeFromQueueByWs(s.ws));
      await this.startMatch(mode, selected, true);
    }
  }
  async startMatch(mode, humans, allowBots) {
    const required = mode === "online_2p" ? 2 : 3;
    const matchId = randomUUID2();
    const players = humans.map((h) => ({
      id: randomUUID2(),
      userId: h.userId,
      name: h.name,
      isBot: false
    }));
    if (allowBots && players.length < required) {
      const missing = required - players.length;
      for (let i = 0; i < missing; i += 1) {
        players.push({
          id: randomUUID2(),
          userId: null,
          name: randomBotName(i),
          isBot: true
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
          isBot: p.isBot
        })),
        state: runtime.state
      });
    }
    const botTurn = this.gameService.processBotTurns(matchId);
    if (botTurn.progressed && botTurn.finalState) {
      this.broadcastMatchState(matchId, botTurn.finalState);
    }
  }
  broadcastMatchState(matchId, state) {
    for (const client of this.clients.values()) {
      if (client.matchId === matchId) {
        send(client.ws, { type: "ONLINE_STATE_UPDATE", state });
      }
    }
  }
  async ensureRankStats(userId, displayName) {
    try {
      const db2 = getDb();
      await db2.insert(playerRankStats).values({
        userId,
        displayName: displayName || "Player"
      }).onConflictDoNothing();
    } catch {
    }
  }
  async persistMatch(matchId, mode, players, isBotFilled) {
    try {
      const db2 = getDb();
      await db2.insert(onlineMatches).values({
        id: matchId,
        mode,
        status: "in_progress",
        isBotFilled,
        botFillStartedAt: isBotFilled ? /* @__PURE__ */ new Date() : null,
        startedAt: /* @__PURE__ */ new Date()
      });
      const playerDbIds = /* @__PURE__ */ new Map();
      for (let i = 0; i < players.length; i += 1) {
        const p = players[i];
        const dbId = randomUUID2();
        playerDbIds.set(p.id, dbId);
        await db2.insert(onlineMatchPlayers).values({
          id: dbId,
          matchId,
          slotIndex: i,
          userId: p.userId,
          isBot: p.isBot,
          botProfileId: null,
          joinType: p.isBot ? "bot_timeout_fill" : "human_queue",
          joinedAt: /* @__PURE__ */ new Date()
        });
      }
      if (players.some((p) => !p.isBot)) {
        await db2.update(matchmakingTickets).set({ status: "matched", matchedAt: /* @__PURE__ */ new Date() }).where(
          and(
            eq2(matchmakingTickets.mode, mode),
            eq2(matchmakingTickets.status, "queued")
          )
        );
      }
      return { matchId, dbMatchId: matchId, playerDbIds };
    } catch {
      return null;
    }
  }
  async tryFinalizeMatch(matchId) {
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
      const db2 = getDb();
      await db2.execute(
        sql`SELECT finalize_online_match(${matchId}::uuid, ${winnerDbPlayerId}::uuid, ${winnerScoreX})`
      );
    } catch {
      try {
        const db2 = getDb();
        await db2.update(onlineMatches).set({ status: "completed", endedAt: /* @__PURE__ */ new Date() }).where(eq2(onlineMatches.id, matchId));
      } catch {
      }
    }
    for (const client of this.clients.values()) {
      if (client.matchId === matchId) {
        send(client.ws, {
          type: "ONLINE_MATCH_FINISHED",
          winnerId: winner.id,
          winnerName: winner.name,
          isBotFilled: match.isBotFilled,
          pointsReductionFactor: match.isBotFilled ? BOT_REDUCTION_FALLBACK : 1
        });
      }
    }
    this.matchMeta.delete(matchId);
    this.gameService.removeMatch(matchId);
  }
};

// server/routes.ts
var rooms2 = /* @__PURE__ */ new Map();
var ROOM_EMPTY_GRACE_MS = 6e4;
function broadcast(room, message, excludeId) {
  const data = JSON.stringify(message);
  room.players.forEach((p) => {
    if (p.id !== excludeId && p.ws.readyState === WebSocket2.OPEN) {
      p.ws.send(data);
    }
  });
}
function broadcastToAll(room, message) {
  const data = JSON.stringify(message);
  room.players.forEach((p) => {
    if (p.ws.readyState === WebSocket2.OPEN) {
      p.ws.send(data);
    }
  });
}
function getRoomInfo(room) {
  return {
    code: room.code,
    phase: room.phase,
    players: room.players.map((p) => ({
      id: p.id,
      name: p.name,
      isReady: p.isReady,
      isOwner: p.isOwner
    }))
  };
}
async function registerRoutes(app2) {
  registerAuthRoutes(app2);
  const httpServer = createServer(app2);
  const onlineService = new OnlineMatchmakingService();
  const wss = new WebSocketServer2({ server: httpServer, path: "/ws" });
  const onlineWss = new WebSocketServer2({ server: httpServer, path: "/ws-online" });
  onlineService.register(app2, onlineWss);
  wss.on("connection", (ws) => {
    let currentRoomCode = null;
    let currentPlayerId = null;
    ws.on("message", (data) => {
      let msg;
      try {
        msg = JSON.parse(data.toString());
      } catch {
        return;
      }
      if (msg.type === "CREATE_ROOM") {
        const code = generateRoomCode();
        const playerId = Date.now().toString() + Math.random().toString(36).substr(2, 6);
        const room = {
          code,
          players: [
            {
              id: playerId,
              name: msg.playerName,
              isReady: false,
              isOwner: true,
              ws
            }
          ],
          gameState: null,
          phase: "lobby"
        };
        rooms2.set(code, room);
        currentRoomCode = code;
        currentPlayerId = playerId;
        ws.send(JSON.stringify({
          type: "ROOM_CREATED",
          playerId,
          room: getRoomInfo(room)
        }));
      } else if (msg.type === "JOIN_ROOM") {
        const code = normalizeRoomCodeForJoin(msg.roomCode || "");
        const room = rooms2.get(code);
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
          name: msg.playerName,
          isReady: false,
          isOwner: false,
          ws
        });
        currentRoomCode = code;
        currentPlayerId = playerId;
        ws.send(JSON.stringify({
          type: "ROOM_JOINED",
          playerId,
          room: getRoomInfo(room)
        }));
        broadcastToAll(room, {
          type: "ROOM_UPDATED",
          room: getRoomInfo(room)
        });
      } else if (msg.type === "SET_READY") {
        if (!currentRoomCode || !currentPlayerId) return;
        const room = rooms2.get(currentRoomCode);
        if (!room) return;
        const player = room.players.find((p) => p.id === currentPlayerId);
        if (player) {
          player.isReady = msg.ready;
          const roomPayload = getRoomInfo(room);
          broadcastToAll(room, { type: "ROOM_UPDATED", room: roomPayload });
        }
      } else if (msg.type === "START_GAME") {
        if (!currentRoomCode || !currentPlayerId) return;
        const room = rooms2.get(currentRoomCode);
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
          players: playerData
        });
      } else if (msg.type === "GAME_ACTION") {
        if (!currentRoomCode || !currentPlayerId) return;
        const room = rooms2.get(currentRoomCode);
        if (!room) return;
        if (room.phase !== "playing" || !room.gameState) return;
        const action = msg.action;
        if (!action?.type) return;
        action.playerId = currentPlayerId;
        const { state: newState, error } = applyGameAction(
          room.gameState,
          action
        );
        if (error) {
          ws.send(JSON.stringify({ type: "GAME_ACTION_ERROR", message: error }));
          return;
        }
        room.gameState = newState;
        broadcastToAll(room, { type: "GAME_STATE_UPDATE", state: newState });
      } else if (msg.type === "GAME_QUIT") {
        if (!currentRoomCode || !currentPlayerId) return;
        const room = rooms2.get(currentRoomCode);
        if (!room) return;
        const playerName = room.players.find((p) => p.id === currentPlayerId)?.name ?? "Player";
        if (room.phase === "playing" && room.gameState) {
          const { state: newState } = applyGameAction(
            room.gameState,
            { type: "PLAYER_LEFT", playerId: currentPlayerId }
          );
          room.gameState = newState;
          const stillActive = newState.players.filter(
            (p) => p.status === "active"
          );
          broadcastToAll(room, {
            type: "PLAYER_LEFT",
            playerId: currentPlayerId,
            playerName,
            state: newState,
            lastPlayerRemaining: stillActive.length <= 1
          });
        } else {
          room.players = room.players.filter((p) => p.id !== currentPlayerId);
          broadcast(room, {
            type: "PLAYER_LEFT",
            playerId: currentPlayerId,
            playerName,
            room: getRoomInfo(room)
          });
        }
        if (room.players.length === 0) {
          if (room.phase === "lobby") {
            room.pendingDeletion = setTimeout(() => {
              rooms2.delete(currentRoomCode);
            }, ROOM_EMPTY_GRACE_MS);
          } else {
            rooms2.delete(currentRoomCode);
          }
        } else if (room.phase === "lobby") {
          broadcastToAll(room, { type: "ROOM_UPDATED", room: getRoomInfo(room) });
        }
        currentRoomCode = null;
        currentPlayerId = null;
      } else if (msg.type === "LEAVE_ROOM") {
        if (!currentRoomCode || !currentPlayerId) return;
        const room = rooms2.get(currentRoomCode);
        if (!room) return;
        const playerName = room.players.find((p) => p.id === currentPlayerId)?.name ?? "Player";
        room.players = room.players.filter((p) => p.id !== currentPlayerId);
        broadcast(room, {
          type: "PLAYER_LEFT",
          playerId: currentPlayerId,
          playerName,
          room: room.phase === "lobby" ? getRoomInfo(room) : void 0
        });
        if (room.players.length === 0 && room.phase === "lobby") {
          room.pendingDeletion = setTimeout(() => {
            rooms2.delete(currentRoomCode);
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
      const room = rooms2.get(currentRoomCode);
      if (!room) return;
      const playerName = room.players.find((p) => p.id === currentPlayerId)?.name ?? "Player";
      if (room.phase === "playing" && room.gameState) {
        const { state: newState } = applyGameAction(
          room.gameState,
          { type: "PLAYER_LEFT", playerId: currentPlayerId }
        );
        room.gameState = newState;
        const stillActive = newState.players.filter(
          (p) => p.status === "active"
        );
        broadcastToAll(room, {
          type: "PLAYER_LEFT",
          playerId: currentPlayerId,
          playerName,
          state: newState,
          lastPlayerRemaining: stillActive.length <= 1
        });
      } else {
        room.players = room.players.filter((p) => p.id !== currentPlayerId);
        broadcast(room, {
          type: "PLAYER_LEFT",
          playerId: currentPlayerId,
          playerName,
          room: getRoomInfo(room)
        });
      }
      if (room.players.length === 0) {
        if (room.phase === "lobby") {
          room.pendingDeletion = setTimeout(() => {
            rooms2.delete(currentRoomCode);
          }, ROOM_EMPTY_GRACE_MS);
        } else {
          rooms2.delete(currentRoomCode);
        }
      } else if (room.phase === "lobby") {
        broadcastToAll(room, { type: "ROOM_UPDATED", room: getRoomInfo(room) });
      }
    });
  });
  app2.get("/api/health", (_, res) => {
    res.json({ status: "ok", rooms: rooms2.size });
  });
  app2.get("/api/rooms", (_, res) => {
    const codes = Array.from(rooms2.keys());
    res.json({ rooms: codes, count: codes.length });
  });
  return httpServer;
}

// server/index.ts
import * as fs from "fs";
import * as path from "path";
var app = express();
var log = console.log;
function setupCors(app2) {
  app2.use((req, res, next) => {
    const origins = /* @__PURE__ */ new Set();
    if (process.env.REPLIT_DEV_DOMAIN) {
      origins.add(`https://${process.env.REPLIT_DEV_DOMAIN}`);
    }
    if (process.env.REPLIT_DOMAINS) {
      process.env.REPLIT_DOMAINS.split(",").forEach((d) => {
        origins.add(`https://${d.trim()}`);
      });
    }
    const origin = req.header("origin");
    const isLocalhost = origin?.startsWith("http://localhost:") || origin?.startsWith("http://127.0.0.1:") || origin?.startsWith("http://192.168.") || origin?.startsWith("http://10.") || origin === "null";
    if (origin && (origins.has(origin) || isLocalhost)) {
      res.header("Access-Control-Allow-Origin", origin);
      res.header(
        "Access-Control-Allow-Methods",
        "GET, POST, PUT, DELETE, OPTIONS"
      );
      res.header("Access-Control-Allow-Headers", "Content-Type");
      res.header("Access-Control-Allow-Credentials", "true");
    }
    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }
    next();
  });
}
function setupBodyParsing(app2) {
  app2.use(
    express.json({
      verify: (req, _res, buf) => {
        req.rawBody = buf;
      }
    })
  );
  app2.use(express.urlencoded({ extended: false }));
}
function setupRequestLogging(app2) {
  app2.use((req, res, next) => {
    const start = Date.now();
    const path2 = req.path;
    let capturedJsonResponse = void 0;
    const originalResJson = res.json;
    res.json = function(bodyJson, ...args) {
      capturedJsonResponse = bodyJson;
      return originalResJson.apply(res, [bodyJson, ...args]);
    };
    res.on("finish", () => {
      if (!path2.startsWith("/api")) return;
      const duration = Date.now() - start;
      let logLine = `${req.method} ${path2} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "\u2026";
      }
      log(logLine);
    });
    next();
  });
}
function getAppName() {
  try {
    const appJsonPath = path.resolve(process.cwd(), "app.json");
    const appJsonContent = fs.readFileSync(appJsonPath, "utf-8");
    const appJson = JSON.parse(appJsonContent);
    return appJson.expo?.name || "App Landing Page";
  } catch {
    return "App Landing Page";
  }
}
function serveExpoManifest(platform, res) {
  const manifestPath = path.resolve(
    process.cwd(),
    "static-build",
    platform,
    "manifest.json"
  );
  if (!fs.existsSync(manifestPath)) {
    return res.status(404).json({ error: `Manifest not found for platform: ${platform}` });
  }
  res.setHeader("expo-protocol-version", "1");
  res.setHeader("expo-sfv-version", "0");
  res.setHeader("content-type", "application/json");
  const manifest = fs.readFileSync(manifestPath, "utf-8");
  res.send(manifest);
}
function serveLandingPage({
  req,
  res,
  landingPageTemplate,
  appName
}) {
  const forwardedProto = req.header("x-forwarded-proto");
  const protocol = forwardedProto || req.protocol || "https";
  const forwardedHost = req.header("x-forwarded-host");
  const host = forwardedHost || req.get("host");
  const baseUrl = `${protocol}://${host}`;
  const expsUrl = `${host}`;
  log(`baseUrl`, baseUrl);
  log(`expsUrl`, expsUrl);
  const html = landingPageTemplate.replace(/BASE_URL_PLACEHOLDER/g, baseUrl).replace(/EXPS_URL_PLACEHOLDER/g, expsUrl).replace(/APP_NAME_PLACEHOLDER/g, appName);
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.status(200).send(html);
}
function configureExpoAndLanding(app2) {
  const templatePath = path.resolve(
    process.cwd(),
    "server",
    "templates",
    "landing-page.html"
  );
  const landingPageTemplate = fs.readFileSync(templatePath, "utf-8");
  const appName = getAppName();
  log("Serving static Expo files with dynamic manifest routing");
  app2.use((req, res, next) => {
    if (req.path.startsWith("/api")) {
      return next();
    }
    if (req.path !== "/" && req.path !== "/manifest") {
      return next();
    }
    const platform = req.header("expo-platform");
    if (platform && (platform === "ios" || platform === "android")) {
      return serveExpoManifest(platform, res);
    }
    if (req.path === "/") {
      return serveLandingPage({
        req,
        res,
        landingPageTemplate,
        appName
      });
    }
    next();
  });
  app2.use("/assets", express.static(path.resolve(process.cwd(), "assets")));
  app2.use(express.static(path.resolve(process.cwd(), "static-build")));
  log("Expo routing: Checking expo-platform header on / and /manifest");
}
function setupErrorHandler(app2) {
  app2.use((err, _req, res, next) => {
    const error = err;
    const status = error.status || error.statusCode || 500;
    const message = error.message || "Internal Server Error";
    console.error("Internal Server Error:", err);
    if (res.headersSent) {
      return next(err);
    }
    return res.status(status).json({ message });
  });
}
(async () => {
  setupCors(app);
  app.use(cookieParser());
  setupBodyParsing(app);
  setupRequestLogging(app);
  configureExpoAndLanding(app);
  const server = await registerRoutes(app);
  setupErrorHandler(app);
  const port = parseInt(process.env.PORT || "5000", 10);
  server.listen(port, "0.0.0.0", () => {
    log(`express server serving on port ${port}`);
  });
})();
