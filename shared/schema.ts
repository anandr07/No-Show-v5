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
  uniqueIndex,
  customType,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

// ─── Enums ────────────────────────────────────────────────────────────────

export const gameModeEnum = pgEnum("game_mode", [
  "vs_system",
  "multiplayer",
  "online",
]);

export const roomStatusEnum = pgEnum("room_status", [
  "lobby",
  "playing",
  "finished",
]);

export const playerTypeEnum = pgEnum("player_type", ["human", "bot"]);

export const playerStatusEnum = pgEnum("player_status", [
  "active",
  "eliminated",
  "left",
]);

export const gameStatusEnum = pgEnum("game_status", ["playing", "finished"]);

// ─── Profiles (extends Supabase auth.users) ────────────────────────────────

export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey(),
  displayName: text("display_name").notNull().default("Player"),
  username: text("username").unique(),
  avatarUrl: text("avatar_url"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ─── Rooms (multiplayer lobby) ────────────────────────────────────────────

export const rooms = pgTable(
  "rooms",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: varchar("code", { length: 6 }).notNull().unique(),
    ownerId: uuid("owner_id").references(() => profiles.id, { onDelete: "set null" }),
    ownerDisplayName: text("owner_display_name"),
    status: roomStatusEnum("status").notNull().default("lobby"),
    maxPlayers: integer("max_players").notNull().default(6),
    minPlayersToStart: integer("min_players_to_start").notNull().default(3),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("rooms_code_idx").on(t.code), index("rooms_status_idx").on(t.status)]
);

// ─── Room Players (lobby participants) ───────────────────────────────────

export const roomPlayers = pgTable(
  "room_players",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    roomId: uuid("room_id")
      .notNull()
      .references(() => rooms.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => profiles.id, { onDelete: "set null" }),
    displayName: text("display_name").notNull(),
    isOwner: boolean("is_owner").notNull().default(false),
    isReady: boolean("is_ready").notNull().default(false),
    seatIndex: integer("seat_index").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("room_players_room_idx").on(t.roomId),
    index("room_players_user_idx").on(t.userId),
  ]
);

// ─── Games (game sessions) ───────────────────────────────────────────────

export const games = pgTable(
  "games",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    mode: gameModeEnum("mode").notNull(),
    roomId: uuid("room_id").references(() => rooms.id, { onDelete: "set null" }),
    createdById: uuid("created_by_id").references(() => profiles.id, {
      onDelete: "set null",
    }),
    status: gameStatusEnum("status").notNull().default("playing"),
    gameState: jsonb("game_state"),
    winnerId: uuid("winner_id").references(() => profiles.id, {
      onDelete: "set null",
    }),
    roundCount: integer("round_count").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
  },
  (t) => [
    index("games_room_idx").on(t.roomId),
    index("games_status_idx").on(t.status),
    index("games_created_by_idx").on(t.createdById),
  ]
);

// ─── Game Players (participants in a game) ─────────────────────────────────

export const gamePlayers = pgTable(
  "game_players",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    gameId: uuid("game_id")
      .notNull()
      .references(() => games.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => profiles.id, { onDelete: "set null" }),
    displayName: text("display_name").notNull(),
    playerType: playerTypeEnum("player_type").notNull(),
    seatIndex: integer("seat_index").notNull(),
    status: playerStatusEnum("status").notNull().default("active"),
    totalScore: integer("total_score").notNull().default(0),
    finalPlace: integer("final_place"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("game_players_game_idx").on(t.gameId),
    index("game_players_user_idx").on(t.userId),
  ]
);

// ─── Game History (for stats/leaderboard) ──────────────────────────────────

export const gameHistory = pgTable(
  "game_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    gameId: uuid("game_id")
      .notNull()
      .references(() => games.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => profiles.id, { onDelete: "set null" }),
    displayName: text("display_name").notNull(),
    playerType: playerTypeEnum("player_type").notNull(),
    place: integer("place").notNull(),
    finalScore: integer("final_score").notNull(),
    mode: gameModeEnum("mode").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("game_history_user_idx").on(t.userId),
    index("game_history_game_idx").on(t.gameId),
    index("game_history_created_idx").on(t.createdAt),
  ]
);

// ─── Friends (placeholder for future) ──────────────────────────────────────

export const friendStatusEnum = pgEnum("friend_status", [
  "pending",
  "accepted",
  "blocked",
]);

export const friends = pgTable(
  "friends",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    friendId: uuid("friend_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    status: friendStatusEnum("status").notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("friends_user_idx").on(t.userId),
    index("friends_friend_idx").on(t.friendId),
  ]
);

// ─── Postgres enum-backed columns (labels must exist in your DB; override via AUTH_PG_* in auth) ───

const accountTypeColumn = customType<{ data: string; driverData: string }>({
  dataType() {
    return "account_type";
  },
  toDriver(value: string) {
    return value;
  },
  fromDriver(value: string) {
    return value;
  },
});

const userStatusColumn = customType<{ data: string; driverData: string }>({
  dataType() {
    return "user_status";
  },
  toDriver(value: string) {
    return value;
  },
  fromDriver(value: string) {
    return value;
  },
});

const authIdentityProviderColumn = customType<{ data: string; driverData: string }>({
  dataType() {
    // Enum *type name* in Postgres for `auth_identities.provider` (often `provider`, not `auth_provider`).
    return "provider";
  },
  toDriver(value: string) {
    return value;
  },
  fromDriver(value: string) {
    return value;
  },
});

/** Matches `public.users` (email + password_hash + enums). */
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountType: accountTypeColumn("account_type").notNull(),
  email: text("email").unique(),
  passwordHash: text("password_hash"),
  status: userStatusColumn("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
});

export const authIdentities = pgTable("auth_identities", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  provider: authIdentityProviderColumn("provider").notNull(),
  providerSubject: text("provider_subject").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── Relations ───────────────────────────────────────────────────────────

export const profilesRelations = relations(profiles, ({ many }) => ({
  roomsOwned: many(rooms),
  roomPlayers: many(roomPlayers),
  gamePlayers: many(gamePlayers),
  gamesCreated: many(games),
}));

export const roomsRelations = relations(rooms, ({ one, many }) => ({
  owner: one(profiles, {
    fields: [rooms.ownerId],
    references: [profiles.id],
  }),
  roomPlayers: many(roomPlayers),
  games: many(games),
}));

export const roomPlayersRelations = relations(roomPlayers, ({ one }) => ({
  room: one(rooms, {
    fields: [roomPlayers.roomId],
    references: [rooms.id],
  }),
  user: one(profiles, {
    fields: [roomPlayers.userId],
    references: [profiles.id],
  }),
}));

export const gamesRelations = relations(games, ({ one, many }) => ({
  room: one(rooms, {
    fields: [games.roomId],
    references: [rooms.id],
  }),
  createdBy: one(profiles, {
    fields: [games.createdById],
    references: [profiles.id],
  }),
  winner: one(profiles, {
    fields: [games.winnerId],
    references: [profiles.id],
  }),
  gamePlayers: many(gamePlayers),
}));

export const gamePlayersRelations = relations(gamePlayers, ({ one }) => ({
  game: one(games, {
    fields: [gamePlayers.gameId],
    references: [games.id],
  }),
  user: one(profiles, {
    fields: [gamePlayers.userId],
    references: [profiles.id],
  }),
}));

// ─── Insert/Select Schemas (Zod) ───────────────────────────────────────────

export const insertProfileSchema = createInsertSchema(profiles);
export const selectProfileSchema = createSelectSchema(profiles);

export const insertRoomSchema = createInsertSchema(rooms);
export const selectRoomSchema = createSelectSchema(rooms);

export const insertRoomPlayerSchema = createInsertSchema(roomPlayers);
export const selectRoomPlayerSchema = createSelectSchema(roomPlayers);

export const insertGameSchema = createInsertSchema(games);
export const selectGameSchema = createSelectSchema(games);

export const insertGamePlayerSchema = createInsertSchema(gamePlayers);
export const selectGamePlayerSchema = createSelectSchema(gamePlayers);

export const insertUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// ─── Online Ranked Mode ───────────────────────────────────────────────────

export const matchmakingModeEnum = pgEnum("matchmaking_mode", [
  "online_2p",
  "online_3p",
]);

export const ticketStatusEnum = pgEnum("ticket_status", [
  "queued",
  "matched",
  "cancelled",
  "expired",
]);

export const onlineMatchStatusEnum = pgEnum("online_match_status", [
  "waiting",
  "in_progress",
  "completed",
  "cancelled",
]);

export const onlineJoinTypeEnum = pgEnum("online_join_type", [
  "human_queue",
  "human_reconnect",
  "bot_timeout_fill",
]);

export const botDifficultyEnum = pgEnum("bot_difficulty", [
  "easy",
  "normal",
  "hard",
]);

export const pointsChangeTypeEnum = pgEnum("points_change_type", [
  "win_award",
  "loss_penalty",
  "adjustment",
]);

export const profileSettings = pgTable("player_settings", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  soundEnabled: boolean("sound_enabled").notNull().default(true),
  hapticsEnabled: boolean("haptics_enabled").notNull().default(true),
  notificationsEnabled: boolean("notifications_enabled").notNull().default(true),
  languageCode: varchar("language_code", { length: 8 }).notNull().default("en"),
  activeCardBackId: varchar("active_card_back_id", { length: 32 }).notNull().default("default"),
  activeTableTheme: varchar("active_table_theme", { length: 16 }).notNull().default("green"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Ranked / profile row — maps to `public.player_profiles` in Supabase. */
export const playerRankStats = pgTable(
  "player_profiles",
  {
    userId: uuid("user_id")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    displayName: varchar("display_name", { length: 64 }).notNull(),
    avatarUrl: text("avatar_url"),
    avatarIndex: smallint("avatar_index").notNull().default(0),
    countryCode: varchar("country_code", { length: 2 }),
    onlinePointsTotal: integer("online_points_total").notNull().default(0),
    onlineWins: integer("online_wins").notNull().default(0),
    onlineLosses: integer("online_losses").notNull().default(0),
    onlineGamesPlayed: integer("online_games_played").notNull().default(0),
    currentLevel: smallint("current_level").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("player_profiles_online_points_idx").on(t.onlinePointsTotal)]
);

export const matchmakingTickets = pgTable(
  "matchmaking_tickets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    mode: matchmakingModeEnum("mode").notNull(),
    region: varchar("region", { length: 32 }),
    status: ticketStatusEnum("status").notNull().default("queued"),
    queuedAt: timestamp("queued_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    matchedAt: timestamp("matched_at", { withTimezone: true }),
  },
  (t) => [
    index("matchmaking_tickets_mode_status_queued_idx").on(
      t.mode,
      t.status,
      t.queuedAt
    ),
    index("matchmaking_tickets_user_idx").on(t.userId),
  ]
);

export const botProfiles = pgTable("bot_profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  botName: varchar("bot_name", { length: 32 }).notNull().unique(),
  difficulty: botDifficultyEnum("difficulty").notNull().default("normal"),
  behaviorSeed: jsonb("behavior_seed").notNull().default({}),
  active: boolean("active").notNull().default(true),
});

export const onlineMatches = pgTable(
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
    winningScoreX: integer("winning_score_x"),
  },
  (t) => [index("online_matches_status_idx").on(t.status)]
);

export const onlineMatchPlayers = pgTable(
  "online_match_players",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    matchId: uuid("match_id")
      .notNull()
      .references(() => onlineMatches.id, { onDelete: "cascade" }),
    slotIndex: smallint("slot_index").notNull(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    isBot: boolean("is_bot").notNull().default(false),
    botProfileId: uuid("bot_profile_id").references(() => botProfiles.id, {
      onDelete: "set null",
    }),
    joinType: onlineJoinTypeEnum("join_type").notNull(),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("online_match_players_match_slot_unique").on(t.matchId, t.slotIndex),
    index("online_match_players_match_idx").on(t.matchId),
    index("online_match_players_user_idx").on(t.userId),
  ]
);

export const onlineMatchRounds = pgTable(
  "online_match_rounds",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    matchId: uuid("match_id")
      .notNull()
      .references(() => onlineMatches.id, { onDelete: "cascade" }),
    roundNumber: integer("round_number").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    endedAt: timestamp("ended_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("online_match_rounds_match_round_unique").on(t.matchId, t.roundNumber),
  ]
);

export const onlineRoundScores = pgTable(
  "online_round_scores",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    roundId: uuid("round_id")
      .notNull()
      .references(() => onlineMatchRounds.id, { onDelete: "cascade" }),
    matchPlayerId: uuid("match_player_id")
      .notNull()
      .references(() => onlineMatchPlayers.id, { onDelete: "cascade" }),
    roundScoreDelta: integer("round_score_delta").notNull(),
    cumulativeScore: integer("cumulative_score").notNull(),
  },
  (t) => [
    uniqueIndex("online_round_scores_round_player_unique").on(t.roundId, t.matchPlayerId),
  ]
);

export const gameScoringConfig = pgTable("game_scoring_config", {
  id: smallint("id").primaryKey().default(1),
  lossPenaltyPoints: integer("loss_penalty_points").notNull().default(20),
  botMatchReductionFactor: numeric("bot_match_reduction_factor", {
    precision: 4,
    scale: 2,
  })
    .notNull()
    .default("0.50"),
  levelStepPoints: integer("level_step_points").notNull().default(1000),
  maxLevels: smallint("max_levels").notNull().default(6),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const onlineMatchResults = pgTable("online_match_results", {
  id: uuid("id").primaryKey().defaultRandom(),
  matchId: uuid("match_id")
    .notNull()
    .unique()
    .references(() => onlineMatches.id, { onDelete: "cascade" }),
  winnerMatchPlayerId: uuid("winner_match_player_id")
    .notNull()
    .references(() => onlineMatchPlayers.id, { onDelete: "restrict" }),
  winnerUserId: uuid("winner_user_id").references(() => users.id, { onDelete: "set null" }),
  winnerPointsBase: integer("winner_points_base").notNull(),
  botReductionFactor: numeric("bot_reduction_factor", { precision: 4, scale: 2 })
    .notNull()
    .default("0.50"),
  winnerPointsFinal: integer("winner_points_final").notNull(),
  lossPenalty: integer("loss_penalty").notNull().default(20),
  isRanked: boolean("is_ranked").notNull().default(true),
  computedAt: timestamp("computed_at", { withTimezone: true }).notNull().defaultNow(),
});

export const onlinePointsLedger = pgTable(
  "online_points_ledger",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    matchId: uuid("match_id")
      .notNull()
      .references(() => onlineMatches.id, { onDelete: "cascade" }),
    changeType: pointsChangeTypeEnum("change_type").notNull(),
    pointsDelta: integer("points_delta").notNull(),
    balanceAfter: integer("balance_after").notNull(),
    reason: text("reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("online_points_ledger_user_created_idx").on(t.userId, t.createdAt),
    uniqueIndex("online_points_ledger_user_match_type_unique").on(
      t.userId,
      t.matchId,
      t.changeType
    ),
  ]
);

export const levelDefinitions = pgTable("level_definitions", {
  level: smallint("level").primaryKey(),
  name: varchar("name", { length: 64 }).notNull().unique(),
  minPoints: integer("min_points").notNull(),
  maxPoints: integer("max_points"),
});

// ─── Cosmetics & Gem economy ──────────────────────────────────────────────────

const cosmeticTypeColumn = customType<{ data: string; driverData: string }>({
  dataType() { return "cosmetic_type"; },
  toDriver(v: string) { return v; },
  fromDriver(v: string) { return v; },
});

const gemTxTypeColumn = customType<{ data: string; driverData: string }>({
  dataType() { return "gem_tx_type"; },
  toDriver(v: string) { return v; },
  fromDriver(v: string) { return v; },
});

const iapPlatformColumn = customType<{ data: string; driverData: string }>({
  dataType() { return "iap_platform"; },
  toDriver(v: string) { return v; },
  fromDriver(v: string) { return v; },
});

/** One row per user — authoritative gem balance. */
export const playerGemBalance = pgTable("player_gem_balance", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  balance: integer("balance").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Immutable audit ledger: every gem credit/debit. */
export const gemTransactions = pgTable(
  "gem_transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    txType: gemTxTypeColumn("tx_type").notNull(),
    amount: integer("amount").notNull(),
    balanceAfter: integer("balance_after").notNull(),
    refId: text("ref_id"),
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("gem_transactions_user_created_idx").on(t.userId, t.createdAt)]
);

/** Records every real-money IAP. */
export const iapPurchases = pgTable(
  "iap_purchases",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    productId: varchar("product_id", { length: 64 }).notNull(),
    platform: iapPlatformColumn("platform").notNull(),
    priceUsdCents: integer("price_usd_cents").notNull(),
    gemsGranted: integer("gems_granted").notNull(),
    platformReceipt: text("platform_receipt"),
    platformOrderId: text("platform_order_id"),
    isSandbox: boolean("is_sandbox").notNull().default(false),
    refundedAt: timestamp("refunded_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("iap_purchases_user_idx").on(t.userId, t.createdAt)]
);

/** Cosmetic ownership — one row per (user, type, item). */
export const playerCosmetics = pgTable(
  "player_cosmetics",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    cosmeticType: cosmeticTypeColumn("cosmetic_type").notNull(),
    itemId: varchar("item_id", { length: 64 }).notNull(),
    gemsSpent: integer("gems_spent").notNull().default(0),
    unlockedAt: timestamp("unlocked_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("player_cosmetics_user_item_unique").on(t.userId, t.cosmeticType, t.itemId),
    index("player_cosmetics_user_idx").on(t.userId),
  ]
);

/** Read-only catalog of every purchasable item seeded in the DB. */
export const cosmeticsCatalog = pgTable(
  "cosmetics_catalog",
  {
    itemId: varchar("item_id", { length: 64 }).notNull(),
    cosmeticType: cosmeticTypeColumn("cosmetic_type").notNull(),
    title: varchar("title", { length: 128 }).notNull(),
    description: text("description"),
    gemPrice: integer("gem_price").notNull().default(0),
    isFree: boolean("is_free").notNull().default(false),
    sortOrder: smallint("sort_order").notNull().default(0),
  },
  (t) => [uniqueIndex("cosmetics_catalog_pk").on(t.itemId, t.cosmeticType)]
);
