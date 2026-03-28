import type { GameState, Card } from "../lib/gameEngine";
import type { GameAction } from "./gameState";

function pickRandom<T>(items: T[]): T | null {
  if (items.length === 0) return null;
  const idx = Math.floor(Math.random() * items.length);
  return items[idx] ?? null;
}

function chooseThrowCards(hand: Card[]): Card[] {
  if (hand.length === 0) return [];

  const byRank = new Map<string, Card[]>();
  hand.forEach((card) => {
    const rank = card.rank;
    const existing = byRank.get(rank) ?? [];
    existing.push(card);
    byRank.set(rank, existing);
  });

  const pairOrSet = Array.from(byRank.values())
    .filter((cards) => cards.length >= 2)
    .sort((a, b) => b.length - a.length)[0];

  if (pairOrSet) {
    return pairOrSet.slice(0, Math.min(pairOrSet.length, 3));
  }

  const sorted = [...hand].sort((a, b) => a.value - b.value);
  return [sorted[0]];
}

export function decideBotAction(state: GameState, botId: string): GameAction | null {
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
    const canPickThrown =
      state.lastThrown.length > 0 && (state.lastThrownByPlayerId ?? "") !== botId;
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
