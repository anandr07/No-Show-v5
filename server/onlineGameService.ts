import { initMultiplayerGame, applyGameAction, type GameAction } from "./gameState";
import type { GameState, GamePhase } from "../lib/gameEngine";
import { decideBotAction } from "./botService";

export interface OnlinePlayer {
  id: string;
  userId: string | null;
  name: string;
  isBot: boolean;
  /** Set when `isBot` — row in `bot_profiles` (online_match_players.bot_profile_id). */
  botProfileId?: string | null;
}

export interface RoundRecord {
  roundNumber: number;
  scores: { playerId: string; score: number; delta: number }[];
  endedAt: Date;
}

export interface OnlineMatchRuntime {
  id: string;
  mode: "online_2p" | "online_3p";
  players: OnlinePlayer[];
  state: GameState;
  createdAt: number;
  isBotFilled: boolean;
  /** Completed rounds captured as phase transitions through "show". */
  roundHistory: RoundRecord[];
}

export class OnlineGameService {
  private readonly matches = new Map<string, OnlineMatchRuntime>();

  createMatch(
    id: string,
    mode: "online_2p" | "online_3p",
    players: OnlinePlayer[],
    isBotFilled: boolean
  ): OnlineMatchRuntime {
    const initial = initMultiplayerGame(players.map((p) => ({ id: p.id, name: p.name })));
    const runtime: OnlineMatchRuntime = {
      id,
      mode,
      players,
      state: initial,
      createdAt: Date.now(),
      isBotFilled,
      roundHistory: [],
    };
    this.matches.set(id, runtime);
    return runtime;
  }

  getMatch(matchId: string): OnlineMatchRuntime | null {
    return this.matches.get(matchId) ?? null;
  }

  removeMatch(matchId: string) {
    this.matches.delete(matchId);
  }

  applyAction(matchId: string, action: GameAction): { state: GameState; error?: string } | null {
    const match = this.matches.get(matchId);
    if (!match) return null;

    const prevPhase = match.state.phase;
    const prevRound = match.state.round;

    const result = applyGameAction(match.state, action);
    match.state = result.state;

    // Detect transition into "show" phase — a round just completed
    if (
      prevPhase !== "show" &&
      result.state.phase === "show" &&
      result.state.roundScores.length > 0
    ) {
      match.roundHistory.push({
        roundNumber: prevRound,
        scores: result.state.roundScores.map((s) => ({ ...s })),
        endedAt: new Date(),
      });
    }

    return result;
  }

  /**
   * Play all consecutive bot sub-turns with human-feeling delays between each
   * sub-action (pick phase and throw/show phase), mirroring the VS mode timings.
   *
   * `onBroadcast` is called after EVERY individual sub-action so clients see
   * each intermediate state (bot picks a card → pause → bot throws) rather than
   * one instant jump to the final state.
   */
  async processBotTurns(
    matchId: string,
    onBroadcast: (state: GameState) => void
  ): Promise<void> {
    const match = this.matches.get(matchId);
    if (!match) return;

    const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

    let safety = 0;
    while (safety < 24) {
      safety += 1;

      // Re-read from map — another async path could have removed the match.
      if (!this.matches.get(matchId)) return;
      // Use `as GamePhase` to prevent TypeScript narrowing the union type across
      // loop iterations and await boundaries, which would cause false TS2367 errors.
      if ((match.state.phase as GamePhase) === "gameOver" || (match.state.phase as GamePhase) === "show") break;

      const current = match.state.players[match.state.currentPlayerIndex];
      if (!current) break;
      const isBot = match.players.find((p) => p.id === current.id)?.isBot;
      if (!isBot) break;

      // Delay mirrors VS mode timings (GameContext.tsx runBotTurn):
      //   pick  phase → 800 – 1 400 ms
      //   throw phase → 1 000 – 1 800 ms
      const thinkMs =
        match.state.turnPhase === "pick"
          ? 800 + Math.random() * 600
          : 1000 + Math.random() * 800;

      await delay(thinkMs);

      // Guard again after the async pause — match could have been cleaned up.
      if (!this.matches.get(matchId)) return;
      if ((match.state.phase as GamePhase) === "gameOver" || (match.state.phase as GamePhase) === "show") break;

      const prevPhase = match.state.phase as GamePhase;
      const prevRound = match.state.round;

      const botAction = decideBotAction(match.state, current.id);
      if (!botAction) break;

      const result = applyGameAction(match.state, botAction);
      match.state = result.state;

      // Track bot-triggered round completions.
      if (
        prevPhase !== "show" &&
        result.state.phase === "show" &&
        result.state.roundScores.length > 0
      ) {
        match.roundHistory.push({
          roundNumber: prevRound,
          scores: result.state.roundScores.map((s) => ({ ...s })),
          endedAt: new Date(),
        });
      }

      // Broadcast this individual sub-action so the client sees it.
      onBroadcast(result.state);

      if (result.error) break;
    }
  }
}
