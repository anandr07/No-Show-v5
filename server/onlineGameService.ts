import { initMultiplayerGame, applyGameAction, type GameAction } from "./gameState";
import type { GameState } from "../lib/gameEngine";
import { decideBotAction } from "./botService";

export interface OnlinePlayer {
  id: string;
  userId: string | null;
  name: string;
  isBot: boolean;
}

export interface OnlineMatchRuntime {
  id: string;
  mode: "online_2p" | "online_3p";
  players: OnlinePlayer[];
  state: GameState;
  createdAt: number;
  isBotFilled: boolean;
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
    const result = applyGameAction(match.state, action);
    match.state = result.state;
    return result;
  }

  processBotTurns(matchId: string): { progressed: boolean; finalState: GameState | null } {
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
}
