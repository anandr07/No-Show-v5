CREATE TYPE "public"."matchmaking_mode" AS ENUM('online_2p', 'online_3p');--> statement-breakpoint
CREATE TYPE "public"."ticket_status" AS ENUM('queued', 'matched', 'cancelled', 'expired');--> statement-breakpoint
CREATE TYPE "public"."online_match_status" AS ENUM('waiting', 'in_progress', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."online_join_type" AS ENUM('human_queue', 'human_reconnect', 'bot_timeout_fill');--> statement-breakpoint
CREATE TYPE "public"."bot_difficulty" AS ENUM('easy', 'normal', 'hard');--> statement-breakpoint
CREATE TYPE "public"."points_change_type" AS ENUM('win_award', 'loss_penalty', 'adjustment');--> statement-breakpoint

CREATE TABLE "player_settings" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"sound_enabled" boolean DEFAULT true NOT NULL,
	"haptics_enabled" boolean DEFAULT true NOT NULL,
	"notifications_enabled" boolean DEFAULT true NOT NULL,
	"language_code" varchar(8) DEFAULT 'en' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE "player_rank_stats" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"display_name" text DEFAULT 'Player' NOT NULL,
	"online_points_total" integer DEFAULT 0 NOT NULL,
	"online_wins" integer DEFAULT 0 NOT NULL,
	"online_losses" integer DEFAULT 0 NOT NULL,
	"online_games_played" integer DEFAULT 0 NOT NULL,
	"current_level" smallint DEFAULT 1 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE "matchmaking_tickets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"mode" "matchmaking_mode" NOT NULL,
	"region" varchar(32),
	"status" "ticket_status" DEFAULT 'queued' NOT NULL,
	"queued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"matched_at" timestamp with time zone
);--> statement-breakpoint

CREATE TABLE "bot_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bot_name" varchar(32) NOT NULL,
	"difficulty" "bot_difficulty" DEFAULT 'normal' NOT NULL,
	"behavior_seed" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "bot_profiles_bot_name_unique" UNIQUE("bot_name")
);--> statement-breakpoint

CREATE TABLE "online_matches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mode" "matchmaking_mode" NOT NULL,
	"status" "online_match_status" DEFAULT 'waiting' NOT NULL,
	"is_bot_filled" boolean DEFAULT false NOT NULL,
	"bot_fill_started_at" timestamp with time zone,
	"started_at" timestamp with time zone,
	"ended_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"winner_user_id" uuid,
	"winning_score_x" integer
);--> statement-breakpoint

CREATE TABLE "online_match_players" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"match_id" uuid NOT NULL,
	"slot_index" smallint NOT NULL,
	"user_id" uuid,
	"is_bot" boolean DEFAULT false NOT NULL,
	"bot_profile_id" uuid,
	"join_type" "online_join_type" NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE "online_match_rounds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"match_id" uuid NOT NULL,
	"round_number" integer NOT NULL,
	"started_at" timestamp with time zone,
	"ended_at" timestamp with time zone
);--> statement-breakpoint

CREATE TABLE "online_round_scores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"round_id" uuid NOT NULL,
	"match_player_id" uuid NOT NULL,
	"round_score_delta" integer NOT NULL,
	"cumulative_score" integer NOT NULL
);--> statement-breakpoint

CREATE TABLE "game_scoring_config" (
	"id" smallint PRIMARY KEY DEFAULT 1 NOT NULL,
	"loss_penalty_points" integer DEFAULT 20 NOT NULL,
	"bot_match_reduction_factor" numeric(4, 2) DEFAULT 0.50 NOT NULL,
	"level_step_points" integer DEFAULT 1000 NOT NULL,
	"max_levels" smallint DEFAULT 6 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE "online_match_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"match_id" uuid NOT NULL,
	"winner_match_player_id" uuid NOT NULL,
	"winner_user_id" uuid,
	"winner_points_base" integer NOT NULL,
	"bot_reduction_factor" numeric(4, 2) DEFAULT 0.50 NOT NULL,
	"winner_points_final" integer NOT NULL,
	"loss_penalty" integer DEFAULT 20 NOT NULL,
	"is_ranked" boolean DEFAULT true NOT NULL,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "online_match_results_match_id_unique" UNIQUE("match_id")
);--> statement-breakpoint

CREATE TABLE "online_points_ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"match_id" uuid NOT NULL,
	"change_type" "points_change_type" NOT NULL,
	"points_delta" integer NOT NULL,
	"balance_after" integer NOT NULL,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE "level_definitions" (
	"level" smallint PRIMARY KEY NOT NULL,
	"name" varchar(64) NOT NULL,
	"min_points" integer NOT NULL,
	"max_points" integer,
	CONSTRAINT "level_definitions_name_unique" UNIQUE("name")
);--> statement-breakpoint

ALTER TABLE "player_settings" ADD CONSTRAINT "player_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_rank_stats" ADD CONSTRAINT "player_rank_stats_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matchmaking_tickets" ADD CONSTRAINT "matchmaking_tickets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "online_matches" ADD CONSTRAINT "online_matches_winner_user_id_users_id_fk" FOREIGN KEY ("winner_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "online_match_players" ADD CONSTRAINT "online_match_players_match_id_online_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."online_matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "online_match_players" ADD CONSTRAINT "online_match_players_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "online_match_players" ADD CONSTRAINT "online_match_players_bot_profile_id_bot_profiles_id_fk" FOREIGN KEY ("bot_profile_id") REFERENCES "public"."bot_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "online_match_rounds" ADD CONSTRAINT "online_match_rounds_match_id_online_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."online_matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "online_round_scores" ADD CONSTRAINT "online_round_scores_round_id_online_match_rounds_id_fk" FOREIGN KEY ("round_id") REFERENCES "public"."online_match_rounds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "online_round_scores" ADD CONSTRAINT "online_round_scores_match_player_id_online_match_players_id_fk" FOREIGN KEY ("match_player_id") REFERENCES "public"."online_match_players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "online_match_results" ADD CONSTRAINT "online_match_results_match_id_online_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."online_matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "online_match_results" ADD CONSTRAINT "online_match_results_winner_match_player_id_online_match_players_id_fk" FOREIGN KEY ("winner_match_player_id") REFERENCES "public"."online_match_players"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "online_match_results" ADD CONSTRAINT "online_match_results_winner_user_id_users_id_fk" FOREIGN KEY ("winner_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "online_points_ledger" ADD CONSTRAINT "online_points_ledger_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "online_points_ledger" ADD CONSTRAINT "online_points_ledger_match_id_online_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."online_matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint

CREATE INDEX "player_rank_stats_points_idx" ON "player_rank_stats" USING btree ("online_points_total");--> statement-breakpoint
CREATE INDEX "matchmaking_tickets_mode_status_queued_idx" ON "matchmaking_tickets" USING btree ("mode","status","queued_at");--> statement-breakpoint
CREATE INDEX "matchmaking_tickets_user_idx" ON "matchmaking_tickets" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "online_matches_status_idx" ON "online_matches" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "online_match_players_match_slot_unique" ON "online_match_players" USING btree ("match_id","slot_index");--> statement-breakpoint
CREATE INDEX "online_match_players_match_idx" ON "online_match_players" USING btree ("match_id");--> statement-breakpoint
CREATE INDEX "online_match_players_user_idx" ON "online_match_players" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "online_match_rounds_match_round_unique" ON "online_match_rounds" USING btree ("match_id","round_number");--> statement-breakpoint
CREATE UNIQUE INDEX "online_round_scores_round_player_unique" ON "online_round_scores" USING btree ("round_id","match_player_id");--> statement-breakpoint
CREATE INDEX "online_points_ledger_user_created_idx" ON "online_points_ledger" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "online_points_ledger_user_match_type_unique" ON "online_points_ledger" USING btree ("user_id","match_id","change_type");--> statement-breakpoint

INSERT INTO "game_scoring_config" ("id", "loss_penalty_points", "bot_match_reduction_factor", "level_step_points", "max_levels")
VALUES (1, 20, 0.50, 1000, 6)
ON CONFLICT ("id") DO NOTHING;--> statement-breakpoint

INSERT INTO "level_definitions" ("level", "name", "min_points", "max_points") VALUES
(1, 'Beginner Table', 0, 999),
(2, 'Chip Collector', 1000, 1999),
(3, 'High Roller', 2000, 2999),
(4, 'Elite Gambler', 3000, 3999),
(5, 'Kingpin', 4000, 4999),
(6, 'Legend of the Table', 5000, NULL)
ON CONFLICT ("level") DO NOTHING;--> statement-breakpoint

CREATE OR REPLACE VIEW "v_online_global_leaderboard" AS
SELECT
  prs.user_id,
  prs.display_name,
  prs.online_points_total,
  prs.current_level,
  prs.online_wins,
  prs.online_losses,
  prs.online_games_played,
  RANK() OVER (
    ORDER BY prs.online_points_total DESC, prs.updated_at ASC
  ) AS global_rank
FROM player_rank_stats prs;--> statement-breakpoint

CREATE OR REPLACE FUNCTION calc_level_from_points(p_points INTEGER)
RETURNS SMALLINT AS $$
DECLARE
  lvl SMALLINT;
BEGIN
  SELECT ld.level
  INTO lvl
  FROM level_definitions ld
  WHERE p_points >= ld.min_points
    AND (ld.max_points IS NULL OR p_points <= ld.max_points)
  ORDER BY ld.level DESC
  LIMIT 1;

  RETURN COALESCE(lvl, 1);
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint

CREATE OR REPLACE FUNCTION finalize_online_match(
  p_match_id UUID,
  p_winner_match_player_id UUID,
  p_winning_score_x INTEGER
)
RETURNS VOID AS $$
DECLARE
  v_is_bot_filled BOOLEAN;
  v_winner_user_id UUID;
  v_winner_is_bot BOOLEAN;
  v_bot_factor NUMERIC(4,2);
  v_loss_penalty INTEGER;
  v_winner_points_base INTEGER;
  v_winner_points_final INTEGER;
BEGIN
  IF p_winning_score_x < 0 OR p_winning_score_x > 99 THEN
    RAISE EXCEPTION 'winning_score_x must be between 0 and 99';
  END IF;

  SELECT is_bot_filled INTO v_is_bot_filled
  FROM online_matches
  WHERE id = p_match_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Match not found';
  END IF;

  SELECT user_id, is_bot INTO v_winner_user_id, v_winner_is_bot
  FROM online_match_players
  WHERE id = p_winner_match_player_id AND match_id = p_match_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Winner player not found for this match';
  END IF;

  SELECT bot_match_reduction_factor, loss_penalty_points
  INTO v_bot_factor, v_loss_penalty
  FROM game_scoring_config
  WHERE id = 1;

  v_winner_points_base := 100 - p_winning_score_x;
  IF v_is_bot_filled THEN
    v_winner_points_final := FLOOR(v_winner_points_base * v_bot_factor);
  ELSE
    v_winner_points_final := v_winner_points_base;
  END IF;

  UPDATE online_matches
  SET status = 'completed',
      ended_at = now(),
      winner_user_id = v_winner_user_id,
      winning_score_x = p_winning_score_x
  WHERE id = p_match_id;

  INSERT INTO online_match_results (
    match_id,
    winner_match_player_id,
    winner_user_id,
    winner_points_base,
    bot_reduction_factor,
    winner_points_final,
    loss_penalty,
    is_ranked
  ) VALUES (
    p_match_id,
    p_winner_match_player_id,
    v_winner_user_id,
    v_winner_points_base,
    CASE WHEN v_is_bot_filled THEN v_bot_factor ELSE 1.00 END,
    CASE WHEN v_winner_is_bot THEN 0 ELSE v_winner_points_final END,
    v_loss_penalty,
    TRUE
  );

  IF v_winner_is_bot = FALSE THEN
    INSERT INTO online_points_ledger (user_id, match_id, change_type, points_delta, balance_after, reason)
    SELECT
      prs.user_id,
      p_match_id,
      'win_award',
      v_winner_points_final,
      prs.online_points_total + v_winner_points_final,
      CASE WHEN v_is_bot_filled THEN 'win_award_bot_reduced' ELSE 'win_award_standard' END
    FROM player_rank_stats prs
    WHERE prs.user_id = v_winner_user_id;

    UPDATE player_rank_stats
    SET
      online_points_total = online_points_total + v_winner_points_final,
      online_wins = online_wins + 1,
      online_games_played = online_games_played + 1,
      current_level = calc_level_from_points(online_points_total + v_winner_points_final),
      updated_at = now()
    WHERE user_id = v_winner_user_id;
  END IF;

  INSERT INTO online_points_ledger (user_id, match_id, change_type, points_delta, balance_after, reason)
  SELECT
    prs.user_id,
    p_match_id,
    'loss_penalty',
    -v_loss_penalty,
    prs.online_points_total - v_loss_penalty,
    'loss_penalty_online_mode'
  FROM player_rank_stats prs
  JOIN online_match_players omp ON omp.user_id = prs.user_id
  WHERE omp.match_id = p_match_id
    AND omp.is_bot = FALSE
    AND omp.id <> p_winner_match_player_id;

  UPDATE player_rank_stats prs
  SET
    online_points_total = prs.online_points_total - v_loss_penalty,
    online_losses = prs.online_losses + 1,
    online_games_played = prs.online_games_played + 1,
    current_level = calc_level_from_points(prs.online_points_total - v_loss_penalty),
    updated_at = now()
  FROM online_match_players omp
  WHERE omp.user_id = prs.user_id
    AND omp.match_id = p_match_id
    AND omp.is_bot = FALSE
    AND omp.id <> p_winner_match_player_id;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint

