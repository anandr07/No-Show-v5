-- No-Show Card Game Database Schema
-- Run this in Supabase SQL Editor to create all tables

-- Enums
CREATE TYPE "public"."friend_status" AS ENUM('pending', 'accepted', 'blocked');
CREATE TYPE "public"."game_mode" AS ENUM('vs_system', 'multiplayer', 'online');
CREATE TYPE "public"."game_status" AS ENUM('playing', 'finished');
CREATE TYPE "public"."player_status" AS ENUM('active', 'eliminated', 'left');
CREATE TYPE "public"."player_type" AS ENUM('human', 'bot');
CREATE TYPE "public"."room_status" AS ENUM('lobby', 'playing', 'finished');

-- Profiles (extends auth.users - id comes from auth.users.id)
CREATE TABLE "public"."profiles" (
  "id" uuid PRIMARY KEY NOT NULL,
  "display_name" text DEFAULT 'Player' NOT NULL,
  "username" text UNIQUE,
  "avatar_url" text,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

-- Rooms
CREATE TABLE "public"."rooms" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "code" varchar(6) NOT NULL UNIQUE,
  "owner_id" uuid REFERENCES "public"."profiles"("id") ON DELETE SET NULL,
  "owner_display_name" text,
  "status" "room_status" DEFAULT 'lobby' NOT NULL,
  "max_players" integer DEFAULT 6 NOT NULL,
  "min_players_to_start" integer DEFAULT 3 NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

-- Room Players
CREATE TABLE "public"."room_players" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "room_id" uuid NOT NULL REFERENCES "public"."rooms"("id") ON DELETE CASCADE,
  "user_id" uuid REFERENCES "public"."profiles"("id") ON DELETE SET NULL,
  "display_name" text NOT NULL,
  "is_owner" boolean DEFAULT false NOT NULL,
  "is_ready" boolean DEFAULT false NOT NULL,
  "seat_index" integer DEFAULT 0 NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL
);

-- Games
CREATE TABLE "public"."games" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "mode" "game_mode" NOT NULL,
  "room_id" uuid REFERENCES "public"."rooms"("id") ON DELETE SET NULL,
  "created_by_id" uuid REFERENCES "public"."profiles"("id") ON DELETE SET NULL,
  "status" "game_status" DEFAULT 'playing' NOT NULL,
  "game_state" jsonb,
  "winner_id" uuid REFERENCES "public"."profiles"("id") ON DELETE SET NULL,
  "round_count" integer DEFAULT 1 NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "finished_at" timestamptz
);

-- Game Players
CREATE TABLE "public"."game_players" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "game_id" uuid NOT NULL REFERENCES "public"."games"("id") ON DELETE CASCADE,
  "user_id" uuid REFERENCES "public"."profiles"("id") ON DELETE SET NULL,
  "display_name" text NOT NULL,
  "player_type" "player_type" NOT NULL,
  "seat_index" integer NOT NULL,
  "status" "player_status" DEFAULT 'active' NOT NULL,
  "total_score" integer DEFAULT 0 NOT NULL,
  "final_place" integer,
  "created_at" timestamptz DEFAULT now() NOT NULL
);

-- Game History
CREATE TABLE "public"."game_history" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "game_id" uuid NOT NULL REFERENCES "public"."games"("id") ON DELETE CASCADE,
  "user_id" uuid REFERENCES "public"."profiles"("id") ON DELETE SET NULL,
  "display_name" text NOT NULL,
  "player_type" "player_type" NOT NULL,
  "place" integer NOT NULL,
  "final_score" integer NOT NULL,
  "mode" "game_mode" NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL
);

-- Friends
CREATE TABLE "public"."friends" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "public"."profiles"("id") ON DELETE CASCADE,
  "friend_id" uuid NOT NULL REFERENCES "public"."profiles"("id") ON DELETE CASCADE,
  "status" "friend_status" DEFAULT 'pending' NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

-- Legacy users
CREATE TABLE "public"."users" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "username" text NOT NULL UNIQUE,
  "password" text NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL
);

-- Indexes
CREATE INDEX "rooms_code_idx" ON "public"."rooms" ("code");
CREATE INDEX "rooms_status_idx" ON "public"."rooms" ("status");
CREATE INDEX "room_players_room_idx" ON "public"."room_players" ("room_id");
CREATE INDEX "room_players_user_idx" ON "public"."room_players" ("user_id");
CREATE INDEX "games_room_idx" ON "public"."games" ("room_id");
CREATE INDEX "games_status_idx" ON "public"."games" ("status");
CREATE INDEX "games_created_by_idx" ON "public"."games" ("created_by_id");
CREATE INDEX "game_players_game_idx" ON "public"."game_players" ("game_id");
CREATE INDEX "game_players_user_idx" ON "public"."game_players" ("user_id");
CREATE INDEX "game_history_user_idx" ON "public"."game_history" ("user_id");
CREATE INDEX "game_history_game_idx" ON "public"."game_history" ("game_id");
CREATE INDEX "game_history_created_idx" ON "public"."game_history" ("created_at");
CREATE INDEX "friends_user_idx" ON "public"."friends" ("user_id");
CREATE INDEX "friends_friend_idx" ON "public"."friends" ("friend_id");
