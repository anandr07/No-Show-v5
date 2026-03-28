import type { GameState, Player, Card } from "../lib/gameEngine";
import {
  createPlayer,
  createDeck,
  dealCards,
  sortHand,
  isValidThrow,
  getNextActiveIndex,
  getActiveTurnOrder,
  computeShowScores,
} from "../lib/gameEngine";

export type GameAction =
  | { type: "THROW_CARDS"; playerId: string; cards: Card[] }
  | { type: "PICK_FROM_DECK"; playerId: string }
  | { type: "PICK_FROM_THROWN"; playerId: string; cardId: string }
  | { type: "CALL_SHOW"; playerId: string }
  | { type: "NEXT_ROUND"; playerId?: string }
  | { type: "PLAYER_LEFT"; playerId: string };

export function initMultiplayerGame(roomPlayers: { id: string; name: string }[]): GameState {
  const players: Player[] = roomPlayers.map((p) =>
    createPlayer(p.name, "human", p.id)
  );

  const { players: dealt, deck, openCard, starterIndex } = dealCards(players, createDeck());
  const turnOrder = getActiveTurnOrder(dealt, starterIndex);
  // One card face-up in thrown pile at game start; first player picks from thrown or deck
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
    activeCount: dealt.filter((p) => p.status === "active").length,
  };
}

function getPlayerIndex(players: Player[], playerId: string): number {
  return players.findIndex((p) => p.id === playerId);
}

function getCallerIndexInActive(players: Player[], callerPlayerId: string): number {
  const activePlayers = players.filter((p) => p.status === "active");
  return activePlayers.findIndex((p) => p.id === callerPlayerId);
}

export function applyGameAction(
  state: GameState,
  action: GameAction
): { state: GameState; error?: string } {
  const playerIndex =
    "playerId" in action && action.playerId
      ? getPlayerIndex(state.players, action.playerId)
      : -1;
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

      const handCards = player.hand.filter((c) =>
        action.cards.some((ac) => ac.id === c.id)
      );
      if (handCards.length !== action.cards.length) return { state, error: "Invalid cards" };
      if (!isValidThrow(handCards)) return { state, error: "Invalid throw" };

      const remaining = player.hand.filter(
        (c) => !action.cards.find((tc) => tc.id === c.id)
      );
      const newPlayers = state.players.map((p, i) =>
        i === playerIndex ? { ...p, hand: remaining } : p
      );

      return {
        state: {
          ...state,
          players: newPlayers,
          pendingThrown: action.cards,
          turnPhase: "pick",
          selectedCards: [],
          hasPickedThisPhase: false,
        },
      };
    }

    case "PICK_FROM_DECK": {
      if (state.phase !== "playing") return { state, error: "Not in playing phase" };
      if (state.currentPlayerIndex !== playerIndex) return { state, error: "Not your turn" };
      if (state.turnPhase !== "pick") return { state, error: "Must throw first" };

      const card = state.deck[0];
      if (!card) return { state, error: "Deck empty" };

      const newPlayers = state.players.map((p, i) =>
        i === playerIndex ? { ...p, hand: sortHand([...p.hand, card]) } : p
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
          canCallShow: state.canCallShow || canShow,
        },
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
      const newPlayers = state.players.map((p, i) =>
        i === playerIndex ? { ...p, hand: sortHand([...p.hand, card]) } : p
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
          canCallShow: state.canCallShow || canShow,
        },
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
          status: newTotal >= 100 ? ("eliminated" as const) : p.status,
        };
      });
      // Assign elimination order: newly eliminated this round, sorted by totalScore desc (highest = worst)
      const newlyEliminated = newPlayers
        .filter((p) => p.status === "eliminated" && p.eliminationOrder == null)
        .sort((a, b) => b.totalScore - a.totalScore);
      newlyEliminated.forEach((p, i) => {
        const idx = newPlayers.findIndex((np) => np.id === p.id);
        if (idx >= 0) {
          newPlayers = newPlayers.map((np, j) =>
            j === idx ? { ...np, eliminationOrder: existingEliminatedCount + i + 1 } : np
          );
        }
      });

      return {
        state: {
          ...state,
          players: newPlayers,
          showCallerIndex: playerIndex,
          roundScores: scores,
          phase: "show",
        },
      };
    }

    case "NEXT_ROUND": {
      if (state.phase !== "show") return { state, error: "Not in show phase" };

      const activePlayers = state.players.filter((p) => p.status === "active");
      if (activePlayers.length <= 1) {
        const winner =
          activePlayers[0] ??
          (state.players.length > 0
            ? state.players.reduce((lowest, p) =>
                (lowest?.totalScore ?? Infinity) <= (p.totalScore ?? Infinity) ? lowest : p
              )
            : null);
        return {
          state: {
            ...state,
            phase: "gameOver",
            winner,
          },
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
          activeCount: activePlayers.length,
        },
      };
    }

    case "PLAYER_LEFT": {
      const newPlayers = state.players.map((p) =>
        p.id === action.playerId ? { ...p, status: "left" as const } : p
      );
      const stillActive = newPlayers.filter((p) => p.status === "active");

      if (stillActive.length <= 1) {
        return {
          state: {
            ...state,
            players: newPlayers,
            phase: "gameOver",
            winner: stillActive[0] ?? null,
          },
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
          activeCount: stillActive.length,
        },
      };
    }

    default:
      return { state };
  }
}
