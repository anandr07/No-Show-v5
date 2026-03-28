import React, {
  createContext,
  useContext,
  useReducer,
  useCallback,
  useRef,
  useEffect,
} from "react";
import {
  GameState,
  Player,
  Card,
  GamePhase,
  TurnPhase,
  createPlayer,
  createDeck,
  dealCards,
  sortHand,
  isValidThrow,
  getHandScore,
  computeShowScores,
  getNextActiveIndex,
  getActiveTurnOrder,
} from "@/lib/gameEngine";
import {
  botChooseThrow,
  botChoosePick,
  botChooseCardToPick,
  botShouldCallShow,
} from "@/lib/botAI";

type Action =
  | { type: "START_GAME"; players: Player[] }
  | { type: "DEAL_DONE"; players: Player[]; deck: Card[]; openCard: Card | null; starterIndex: number }
  | { type: "SELECT_CARD"; cardId: string }
  | { type: "DESELECT_CARD"; cardId: string }
  | { type: "CLEAR_SELECTION" }
  | { type: "THROW_CARDS"; cards: Card[]; playerIndex: number }
  | { type: "PICK_FROM_DECK"; playerIndex: number; card: Card }
  | { type: "PICK_FROM_THROWN"; playerIndex: number; card: Card }
  | { type: "CALL_SHOW"; callerIndex: number }
  | { type: "RESOLVE_SHOW" }
  | { type: "NEXT_ROUND" }
  | { type: "PLAYER_LEFT"; playerId: string }
  | { type: "SET_PHASE"; phase: GamePhase }
  | { type: "BOT_THROW"; playerIndex: number; cards: Card[] }
  | { type: "BOT_PICK"; playerIndex: number; card: Card; fromDeck: boolean; fromOpen?: boolean }
  | { type: "ENABLE_SHOW" }
  | { type: "RESET" };

const initialState: GameState = {
  players: [],
  deck: [],
  openCard: null,
  lastThrown: [],
  lastThrownByPlayerId: null,
  pendingThrown: null,
  currentPlayerIndex: 0,
  turnPhase: "throw",
  phase: "idle",
  round: 1,
  showCallerIndex: null,
  selectedCards: [],
  canCallShow: false,
  turnsCompletedThisRound: 0,
  roundScores: [],
  winner: null,
  hasPickedThisPhase: false,
  dealerIndex: 0,
  turnOrder: [],
  activeCount: 0,
};

function gameReducer(state: GameState, action: Action): GameState {
  switch (action.type) {
    case "RESET":
      return { ...initialState };

    case "START_GAME":
      return { ...initialState, players: action.players, phase: "dealing", round: 1 };

    case "DEAL_DONE": {
      const activePlayers = action.players.filter((p) => p.status === "active");
      const turnOrder = getActiveTurnOrder(action.players, action.starterIndex);
      const initialThrown = action.openCard ? [action.openCard] : [];
      return {
        ...state,
        players: action.players,
        deck: action.deck,
        openCard: null,
        lastThrown: initialThrown,
        lastThrownByPlayerId: null,
        pendingThrown: null,
        currentPlayerIndex: action.starterIndex,
        turnPhase: "throw",
        phase: "playing",
        showCallerIndex: null,
        selectedCards: [],
        canCallShow: false,
        turnsCompletedThisRound: 0,
        roundScores: [],
        winner: null,
        hasPickedThisPhase: false,
        turnOrder,
        activeCount: activePlayers.length,
      };
    }

    case "SELECT_CARD":
      if (state.selectedCards.includes(action.cardId)) return state;
      return { ...state, selectedCards: [...state.selectedCards, action.cardId] };

    case "DESELECT_CARD":
      return {
        ...state,
        selectedCards: state.selectedCards.filter((id) => id !== action.cardId),
      };

    case "CLEAR_SELECTION":
      return { ...state, selectedCards: [] };

    case "THROW_CARDS": {
      const player = state.players[action.playerIndex];
      const remaining = player.hand.filter(
        (c) => !action.cards.find((tc) => tc.id === c.id)
      );
      const newPlayers = state.players.map((p, i) =>
        i === action.playerIndex ? { ...p, hand: remaining } : p
      );
      return {
        ...state,
        players: newPlayers,
        pendingThrown: action.cards,
        turnPhase: "pick",
        selectedCards: [],
        hasPickedThisPhase: false,
      };
    }

    case "PICK_FROM_DECK": {
      const newPlayers = state.players.map((p, i) =>
        i === action.playerIndex
          ? { ...p, hand: sortHand([...p.hand, action.card]) }
          : p
      );
      const nextIndex = getNextActiveIndex(state.players, action.playerIndex);
      const activePlayers = state.players.filter((p) => p.status === "active");
      const turnsCompleted = (state.turnsCompletedThisRound ?? 0) + 1;
      const canShow = turnsCompleted >= activePlayers.length;
      const caller = state.players[action.playerIndex];
      return {
        ...state,
        players: newPlayers,
        deck: state.deck.slice(1),
        lastThrown: state.pendingThrown ?? [],
        lastThrownByPlayerId: caller?.id ?? null,
        pendingThrown: null,
        currentPlayerIndex: nextIndex,
        turnPhase: "throw",
        hasPickedThisPhase: true,
        turnsCompletedThisRound: turnsCompleted,
        canCallShow: state.canCallShow || canShow,
      };
    }

    case "PICK_FROM_THROWN": {
      const caller = state.players[action.playerIndex];
      if (caller && state.lastThrownByPlayerId === caller.id) {
        return state;
      }
      const remaining = state.lastThrown.filter((c) => c.id !== action.card.id);
      const newPlayers = state.players.map((p, i) =>
        i === action.playerIndex
          ? { ...p, hand: sortHand([...p.hand, action.card]) }
          : p
      );
      const nextIndex = getNextActiveIndex(state.players, action.playerIndex);
      const activePlayers = state.players.filter((p) => p.status === "active");
      const turnsCompleted = (state.turnsCompletedThisRound ?? 0) + 1;
      const canShow = turnsCompleted >= activePlayers.length;
      return {
        ...state,
        players: newPlayers,
        lastThrown: state.pendingThrown ?? [],
        lastThrownByPlayerId: caller?.id ?? null,
        pendingThrown: null,
        currentPlayerIndex: nextIndex,
        turnPhase: "throw",
        hasPickedThisPhase: true,
        turnsCompletedThisRound: turnsCompleted,
        canCallShow: state.canCallShow || canShow,
      };
    }

    case "BOT_THROW": {
      const player = state.players[action.playerIndex];
      const remaining = player.hand.filter(
        (c) => !action.cards.find((tc) => tc.id === c.id)
      );
      const newPlayers = state.players.map((p, i) =>
        i === action.playerIndex ? { ...p, hand: remaining } : p
      );
      return {
        ...state,
        players: newPlayers,
        pendingThrown: action.cards,
        turnPhase: "pick",
        selectedCards: [],
      };
    }

    case "BOT_PICK": {
      let newDeck = state.deck;
      let newLastThrown = state.lastThrown;
      let newOpenCard = state.openCard;
      const newPlayers = state.players.map((p, i) => {
        if (i !== action.playerIndex) return p;
        return { ...p, hand: sortHand([...p.hand, action.card]) };
      });

      if (action.fromOpen) {
        newOpenCard = state.deck.length > 0 ? state.deck[0] : null;
        newDeck = state.deck.length > 1 ? state.deck.slice(1) : [];
      } else if (action.fromDeck) {
        newDeck = state.deck.slice(1);
      } else {
        newLastThrown = state.lastThrown.filter((c) => c.id !== action.card.id);
      }

      const nextIndex = getNextActiveIndex(state.players, action.playerIndex);
      const activePlayers = state.players.filter((p) => p.status === "active");
      const turnsCompleted = (state.turnsCompletedThisRound ?? 0) + 1;
      const canShow = turnsCompleted >= activePlayers.length;

      const caller = state.players[action.playerIndex];
      return {
        ...state,
        players: newPlayers,
        deck: newDeck,
        openCard: newOpenCard,
        lastThrown: state.pendingThrown ?? [],
        lastThrownByPlayerId: caller?.id ?? null,
        pendingThrown: null,
        currentPlayerIndex: nextIndex,
        turnPhase: "throw",
        hasPickedThisPhase: true,
        turnsCompletedThisRound: turnsCompleted,
        canCallShow: state.canCallShow || canShow,
      };
    }

    case "ENABLE_SHOW":
      return { ...state, canCallShow: true };

    case "CALL_SHOW": {
      const scores = computeShowScores(action.callerIndex, state.players);
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
        ...state,
        players: newPlayers,
        showCallerIndex: action.callerIndex,
        roundScores: scores,
        phase: "show",
      };
    }

    case "NEXT_ROUND": {
      const activePlayers = state.players.filter((p) => p.status === "active");
      if (activePlayers.length <= 1) {
        const winner =
          activePlayers[0] ??
          (state.players.length > 0
            ? state.players.reduce((lowest, p) =>
                (lowest?.totalScore ?? Infinity) <= (p.totalScore ?? Infinity) ? lowest : p
              )
            : null);
        return { ...state, phase: "gameOver", winner };
      }

      const { players: dealt, deck, openCard, starterIndex } = dealCards(
        state.players,
        createDeck()
      );
      const turnOrder = getActiveTurnOrder(dealt, starterIndex);
      const initialThrown = openCard ? [openCard] : [];
      return {
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
      };
    }

    case "PLAYER_LEFT": {
      const newPlayers = state.players.map((p) =>
        p.id === action.playerId ? { ...p, status: "left" as const } : p
      );
      const stillActive = newPlayers.filter((p) => p.status === "active");
      if (stillActive.length <= 1) {
        return { ...state, players: newPlayers, phase: "gameOver", winner: stillActive[0] ?? null };
      }
      return { ...state, players: newPlayers };
    }

    default:
      return state;
  }
}

interface GameContextValue {
  state: GameState;
  startVsGame: (playerName: string, botCount: number) => void;
  selectCard: (cardId: string) => void;
  deselectCard: (cardId: string) => void;
  clearSelection: () => void;
  throwSelectedCards: () => boolean;
  pickFromDeck: () => void;
  pickFromThrown: (card: Card) => void;
  callShow: () => void;
  nextRound: () => void;
  resetGame: () => void;
  isBotThinking: boolean;
}

const GameContext = createContext<GameContextValue | null>(null);

export function GameProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(gameReducer, initialState);
  const stateRef = useRef(state);
  stateRef.current = state;
  const botTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isBotThinking, setIsBotThinking] = React.useState(false);

  const clearBotTimer = () => {
    if (botTimerRef.current) {
      clearTimeout(botTimerRef.current);
      botTimerRef.current = null;
    }
  };

  const runBotTurn = useCallback((s: GameState) => {
    const current = s.players[s.currentPlayerIndex];
    if (!current || current.type !== "bot" || current.status !== "active") return;
    if (s.phase !== "playing") return;

    setIsBotThinking(true);

    if (s.turnPhase === "throw") {
      if (botShouldCallShow(current, s.players, s.canCallShow)) {
        botTimerRef.current = setTimeout(() => {
          setIsBotThinking(false);
          dispatch({ type: "CALL_SHOW", callerIndex: s.currentPlayerIndex });
        }, 1200 + Math.random() * 800);
        return;
      }

      const throwCards = botChooseThrow(current.hand);
      botTimerRef.current = setTimeout(() => {
        dispatch({ type: "BOT_THROW", playerIndex: s.currentPlayerIndex, cards: throwCards });
      }, 1000 + Math.random() * 800);
    } else {
      const choice = botChoosePick(current.hand, s.lastThrown);
      let card: Card | undefined;
      let fromDeck = false;
      let fromOpen = false;
      const canPickFromThrown = s.lastThrown.length > 0 && (s.lastThrownByPlayerId ?? "") !== current.id;

      if (choice === "thrown" && canPickFromThrown) {
        card = botChooseCardToPick(current.hand, s.lastThrown);
      } else {
        card = s.deck[0] ?? undefined;
        fromDeck = true;
      }

      if (!card) {
        setIsBotThinking(false);
        return;
      }

      botTimerRef.current = setTimeout(() => {
        setIsBotThinking(false);
        dispatch({
          type: "BOT_PICK",
          playerIndex: s.currentPlayerIndex,
          card,
          fromDeck,
          fromOpen,
        });
      }, 800 + Math.random() * 600);
    }
  }, []);

  useEffect(() => {
    clearBotTimer();
    if (state.phase === "playing") {
      const current = state.players[state.currentPlayerIndex];
      if (current?.type === "bot" && current.status === "active") {
        runBotTurn(state);
      } else {
        setIsBotThinking(false);
      }
    }
    return clearBotTimer;
  }, [
    state.currentPlayerIndex,
    state.turnPhase,
    state.phase,
    state.round,
  ]);

  const startVsGame = useCallback((playerName: string, botCount: number) => {
    const BOT_NAMES = ["Alex", "Sam", "Jordan", "Taylor", "Morgan", "Riley"];
    const players: Player[] = [
      createPlayer(playerName, "human"),
      ...BOT_NAMES.slice(0, botCount).map((name) => createPlayer(name, "bot")),
    ];

    dispatch({ type: "START_GAME", players });

    const { players: dealt, deck, openCard, starterIndex } = dealCards(players, createDeck());
    setTimeout(() => {
      dispatch({ type: "DEAL_DONE", players: dealt, deck, openCard, starterIndex });
    }, 800);
  }, []);

  const selectCard = useCallback((cardId: string) => {
    dispatch({ type: "SELECT_CARD", cardId });
  }, []);

  const deselectCard = useCallback((cardId: string) => {
    dispatch({ type: "DESELECT_CARD", cardId });
  }, []);

  const clearSelection = useCallback(() => {
    dispatch({ type: "CLEAR_SELECTION" });
  }, []);

  const throwSelectedCards = useCallback((): boolean => {
    const s = stateRef.current;
    const player = s.players[s.currentPlayerIndex];
    if (!player || player.type !== "human") return false;

    const selectedCards = player.hand.filter((c) => s.selectedCards.includes(c.id));
    if (!isValidThrow(selectedCards)) return false;

    dispatch({ type: "THROW_CARDS", cards: selectedCards, playerIndex: s.currentPlayerIndex });
    return true;
  }, []);

  const pickFromDeck = useCallback(() => {
    const s = stateRef.current;
    const card = s.deck[0];
    if (!card) return;
    dispatch({ type: "PICK_FROM_DECK", playerIndex: s.currentPlayerIndex, card });
  }, []);

  const pickFromThrown = useCallback((card: Card) => {
    dispatch({ type: "PICK_FROM_THROWN", playerIndex: stateRef.current.currentPlayerIndex, card });
  }, []);

  const callShow = useCallback(() => {
    const s = stateRef.current;
    if (!s.canCallShow) return;
    dispatch({ type: "CALL_SHOW", callerIndex: s.currentPlayerIndex });
  }, []);

  const nextRound = useCallback(() => {
    dispatch({ type: "NEXT_ROUND" });
  }, []);

  const resetGame = useCallback(() => {
    clearBotTimer();
    dispatch({ type: "RESET" });
  }, []);

  return (
    <GameContext.Provider
      value={{
        state,
        startVsGame,
        selectCard,
        deselectCard,
        clearSelection,
        throwSelectedCards,
        pickFromDeck,
        pickFromThrown,
        callShow,
        nextRound,
        resetGame,
        isBotThinking,
      }}
    >
      {children}
    </GameContext.Provider>
  );
}

export function useGame() {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error("useGame must be used within GameProvider");
  return ctx;
}
